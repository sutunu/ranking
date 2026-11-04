import { unwanted } from "./artwork.ts";
import { normalize, relevance } from "./discovery.ts";
type Work = {
  id: string;
  mal?: number;
  name: string;
  aliases: string[];
  year?: number;
  format?: string;
  url?: string;
  source: string;
  provider: string;
};
const cache = new Map<
    string,
    { until: number; works: Work[]; error?: string }
  >(),
  pending = new Map<string, Promise<any>>();
const catalogIndex = new Map<string, { until: number; work: Work }>();
const quotas = new Map<string, number[]>();
let jikanQueue = Promise.resolve();
async function provider(
  provider: string,
  q: string,
): Promise<{ works: Work[]; error?: string }> {
  const key = provider + ":" + normalize(q),
    hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit;
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const times = (quotas.get(provider) || []).filter(
      (t) => t > Date.now() - 60000,
    );
    if (times.length >= 40) return { works: [], error: "rate_limited" };
    times.push(Date.now());
    quotas.set(provider, times);
    try {
      let works: Work[] = [];
      if (provider === "AniList") {
        const r = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "query($q:String){Page(perPage:24){media(search:$q,type:ANIME,isAdult:false){id idMal title{native romaji english} synonyms seasonYear format coverImage{large} siteUrl}}}",
            variables: { q },
          }),
          signal: AbortSignal.timeout(7000),
        });
        if (!r.ok) throw Error("http_" + r.status);
        const d: any = await r.json();
        if (d.errors) throw Error("api_error");
        works = (d.data?.Page?.media || []).map((m: any) => ({
          id: `anilist:${m.id}`,
          mal: m.idMal,
          name: m.title.native || m.title.romaji,
          aliases: [...Object.values(m.title), ...(m.synonyms || [])].filter(
            Boolean,
          ),
          year: m.seasonYear,
          format: m.format,
          url: m.coverImage?.large,
          source: m.siteUrl,
          provider,
        }));
      }
      if (provider === "Kitsu") {
        const u = new URL("https://kitsu.io/api/edge/anime");
        u.searchParams.set("filter[text]", q);
        u.searchParams.set("page[limit]", "20");
        const r = await fetch(u, {
          headers: { Accept: "application/vnd.api+json" },
          signal: AbortSignal.timeout(7000),
        });
        if (!r.ok) throw Error("http_" + r.status);
        const d: any = await r.json();
        works = (d.data || [])
          .filter((m: any) => !m.attributes.nsfw)
          .map((m: any) => {
            const a = m.attributes;
            return {
              id: `kitsu:${m.id}`,
              name: a.titles.ja_jp || a.canonicalTitle,
              aliases: [
                ...Object.values(a.titles),
                ...(a.abbreviatedTitles || []),
              ].filter(Boolean),
              year: Number(a.startDate?.slice(0, 4)) || undefined,
              format: a.subtype?.toUpperCase(),
              url: a.posterImage?.medium || a.posterImage?.small,
              source: `https://kitsu.app/anime/${a.slug}`,
              provider,
            };
          });
      }
      if (provider === "Jikan") {
        const previous = jikanQueue;
        let release!: () => void;
        jikanQueue = new Promise((r) => (release = r));
        await previous;
        try {
          const u = new URL("https://api.jikan.moe/v4/anime");
          u.searchParams.set("q", q);
          u.searchParams.set("limit", "20");
          u.searchParams.set("sfw", "true");
          const r = await fetch(u, { signal: AbortSignal.timeout(7000) });
          if (!r.ok) throw Error("http_" + r.status);
          const d: any = await r.json();
          works = (d.data || []).map((m: any) => ({
            id: `mal:${m.mal_id}`,
            mal: m.mal_id,
            name: m.title_japanese || m.title,
            aliases: [
              m.title,
              m.title_english,
              m.title_japanese,
              ...(m.title_synonyms || []),
            ].filter(Boolean),
            year: m.year || Number(m.aired?.from?.slice(0, 4)) || undefined,
            format: m.type?.toUpperCase(),
            url: m.images?.jpg?.image_url,
            source: m.url,
            provider,
          }));
        } finally {
          await new Promise((r) => setTimeout(r, 350));
          release();
        }
      }
      for (const work of works) {
        if (catalogIndex.size >= 1000)
          catalogIndex.delete(catalogIndex.keys().next().value!);
        catalogIndex.set(work.id, { until: Date.now() + 900000, work });
      }
      return { works };
    } catch (e) {
      return {
        works: [],
        error: e instanceof Error ? e.message : "network_error",
      };
    }
  })()
    .then((result) => {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, {
        ...result,
        until: Date.now() + (result.error ? 30000 : 900000),
      });
      return result;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
export function sameWork(a: Work, b: Work) {
  if (a.mal && b.mal) return a.mal === b.mal;
  return (
    !!a.year &&
    a.year === b.year &&
    !!a.format &&
    a.format === b.format &&
    normalize(a.name) === normalize(b.name)
  );
}
export async function animeSearch(
  q: string,
  variants: string[],
  blocked = "",
  requirePermission = false,
) {
  const terms = [
      ...new Set([variants.find((t) => t !== q) || q, q, ...variants]),
    ].slice(0, 3),
    diagnostics: any[] = [];
  let works: Work[] = [...catalogIndex.values()]
    .filter(
      (v) =>
        v.until > Date.now() &&
        v.work.aliases.some((a) => relevance(a, q) >= 80),
    )
    .map((v) => v.work);
  const exactCached = works.some((w) =>
    w.aliases.some((a) => normalize(a) === normalize(q)),
  );
  if (exactCached)
    diagnostics.push({
      provider: "catalog-cache",
      term: q,
      status: "ok",
      count: works.length,
    });
  for (const term of exactCached ? [] : terms.slice(0, 2)) {
    const results = await Promise.all(
      ["AniList", "Kitsu", "Jikan"].map(async (p) => ({
        provider: p,
        ...(await provider(p, term)),
      })),
    );
    for (const r of results) {
      diagnostics.push({
        provider: r.provider,
        term,
        status: r.error || (!r.works.length ? "not_found" : "ok"),
        count: r.works.length,
      });
      works.push(...r.works);
    }
    if (
      works.some(
        (w) => w.url && w.aliases.some((a) => normalize(a) === normalize(q)),
      )
    )
      break;
  }
  const excluded = new Set(
    blocked
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const groups: Work[][] = [];
  for (const w of works) {
    if (
      excluded.has(w.id) ||
      excluded.has(w.source) ||
      unwanted({ name: w.name })
    )
      continue;
    let g = groups.find((g) =>
      g.some((other) => sameWork(other, w) || other.id === w.id),
    );
    if (!g) groups.push((g = []));
    if (!g.some((x) => x.id === w.id)) g.push(w);
  }
  const records = groups.map((g) => ({
    workId: g[0].id,
    name:
      g.find((w) => /[\u3040-\u30ff\u3400-\u9fff]/.test(w.name))?.name ||
      g[0].name,
    aliases: [...new Set(g.flatMap((w) => w.aliases))],
    candidates: g,
  }));
  const target = variants.find((t) => t !== q) || q;
  const direct = (g: (typeof records)[number]) =>
    Math.max(...g.aliases.map((a) => relevance(a, q)));
  const hasDirect = records.some((g) => direct(g) >= 80);
  const rank = (g: (typeof records)[number]) =>
    hasDirect
      ? direct(g)
      : Math.max(
          ...g.aliases.map((a) =>
            Math.max(relevance(a, q), 0.9 * relevance(a, target)),
          ),
        );
  records.sort(
    (a, b) =>
      rank(b) - rank(a) ||
      Math.min(...a.candidates.map((w) => w.year || 9999)) -
        Math.min(...b.candidates.map((w) => w.year || 9999)) ||
      normalize(a.name).length - normalize(b.name).length,
  );
  const candidates = records.flatMap((g) =>
    g.candidates
      .filter((w) => w.url && !excluded.has(w.url))
      .map((w) => ({
        key: w.id,
        name: g.name,
        url: w.url,
        source: w.source,
        year: w.year,
        format: w.format,
        aliases: w.aliases,
        urls: [w.url?.replace(/\/medium([-.])/, "/small$1")].filter(
          (u) => u && u !== w.url,
        ),
        workId: g.workId,
        artwork: `${w.provider}掲載のポスター`,
        rights: {
          provider: w.provider,
          officialVerification: "unverified",
          reuse: "permission_not_confirmed",
          terms:
            w.provider === "AniList"
              ? "https://docs.anilist.co/guide/terms-of-use"
              : w.provider === "Jikan"
                ? "https://jikan.moe/"
                : "https://kitsu.docs.apiary.io/",
          source: w.source,
        },
        credit: `${w.provider}掲載ポスター · ${w.source} · 公式性・転載許諾は未確認。画像の権利は各権利者に帰属。`,
        rank: 200,
      })),
  );
  const items = requirePermission ? [] : candidates;
  const missing = records
    .filter((g) => requirePermission || !g.candidates.some((w) => w.url))
    .map((g) => ({
      name: g.name,
      workId: g.workId,
      status: requirePermission ? "rights_unconfirmed" : "no_image",
    }));
  console.info(
    JSON.stringify({
      event: "anime_search",
      query: q,
      diagnostics,
      works: records.length,
      images: items.length,
    }),
  );
  return {
    items,
    missing,
    diagnostics,
    provider: "AniList / Kitsu / Jikan",
    status:
      requirePermission && works.length
        ? "rights_unconfirmed"
        : items.length
          ? "ok"
          : works.length
            ? "no_image"
            : diagnostics.every(
                  (d) => d.status !== "ok" && d.status !== "not_found",
                )
              ? "api_error"
              : "not_found",
  };
}
