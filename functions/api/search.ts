import { booksSearch } from "../../server/books.ts";
import { animeAliases } from "../../server/anime-aliases.ts";
import { animeSearch } from "../../server/anime.ts";
import { catalog, unwanted, type ArtworkEnv } from "../../server/artwork.ts";
import { food } from "../../server/food.ts";
import { onRequestGet as legacy } from "../../server/legacy.ts";
import { wikipedia, relevance } from "../../server/discovery.ts";
const cache = new Map<string, { until: number; data: unknown }>();
export async function onRequestGet({
  request,
  env = {},
}: {
  request: Request;
  env?: ArtworkEnv;
}) {
  const u = new URL(request.url),
    q = u.searchParams.get("q")?.normalize("NFKC").trim().slice(0, 120),
    requestedType = u.searchParams.get("type") || "general";
  let type = requestedType;
  if (!q)
    return Response.json(
      { error: "検索語を入力してください" },
      { status: 400 },
    );
  const key =
    type +
    ":" +
    q +
    ":" +
    (env.ANIME_BLOCKED_SOURCES || "") +
    ":" +
    (env.ANIME_REQUIRE_PERMISSION || "");
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return Response.json(cached.data);
  const warnings: string[] = [];
  let wiki: { items: any[]; terms: any[]; intent?: string } = {
    items: [],
    terms: [],
  };
  try {
    wiki = ["anime", "manga", "books"].includes(requestedType)
      ? await animeAliases(q)
      : await wikipedia(q);
  } catch {
    warnings.push("Wikipediaに接続できませんでした");
  }
  if (type === "general" && wiki.intent) type = wiki.intent;
  const variants = [
    q,
    ...wiki.terms.flatMap((t) => [t.name, t.en]).filter(Boolean),
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);
  if (["anime", "manga", "books"].includes(type)) {
    const [animation, books, mangaCovers] = await Promise.all([
      type === "anime"
        ? animeSearch(
            q,
            variants,
            env.ANIME_BLOCKED_SOURCES,
            env.ANIME_REQUIRE_PERMISSION === "true",
          )
        : (async () => {
            try {
              const r = await legacy({
                request: new Request(
                  "https://local/api/search?type=manga&q=" +
                    encodeURIComponent(variants.find((t) => t !== q) || q),
                ),
              });
              const d: any = await r.json();
              return {
                items: d.items || [],
                missing: [],
                diagnostics: [],
                status: "ok",
              };
            } catch {
              return {
                items: [],
                missing: [],
                diagnostics: [],
                status: "api_error",
              };
            }
          })(),
      booksSearch(
        q,
        variants,
        env.ANIME_BLOCKED_SOURCES,
        env.ANIME_REQUIRE_PERMISSION === "true",
        env.GOOGLE_BOOKS_API_KEY,
      ),
      type === "anime"
        ? (async () => {
            try {
              const r = await legacy({
                request: new Request(
                  "https://local/api/search?type=manga&q=" +
                    encodeURIComponent(
                      variants.find((t) => /^[\x20-\x7e]+$/.test(t)) || q,
                    ),
                ),
              });
              const d: any = await r.json();
              return (d.items || [])
                .filter(
                  (i: any) =>
                    Math.max(...variants.map((t) => relevance(i.name, t))) >=
                    60,
                )
                .map((i: any) => ({
                  ...i,
                  artwork: /^小説|ノベル/.test(i.name)
                    ? "小説データベースの表紙"
                    : "漫画データベースの表紙",
                }));
            } catch {
              return [];
            }
          })()
        : Promise.resolve([]),
    ]);
    const result = {
      ...animation,
      items: [...animation.items, ...mangaCovers, ...books.items],
      missing: [...(animation.missing || []), ...books.missing],
      diagnostics: [...animation.diagnostics, ...books.diagnostics],
      provider:
        "AniList / Kitsu / Jikan / Google Books / Open Library / NDL・openBD",
    };
    const excluded = new Set(
      (env.ANIME_BLOCKED_SOURCES || "").split(/[\n,]/).map((v) => v.trim()),
    );
    result.items = result.items.filter(
      (i: any) =>
        !excluded.has(i.key) &&
        !excluded.has(i.url) &&
        !excluded.has(i.source) &&
        !unwanted(i),
    );
    if (env.ANIME_REQUIRE_PERMISSION === "true" && result.items.length) {
      result.missing.push(
        ...result.items.map((i: any) => ({
          name: i.name,
          status: "rights_unconfirmed",
        })),
      );
      result.items = [];
      result.status = "rights_unconfirmed";
    }
    result.items = [
      ...new Map(result.items.map((i: any) => [i.url || i.key, i])).values(),
    ];
    if (result.items.length) result.status = "ok";
    result.missing = result.missing
      .filter((m: any) => !result.items.some((i: any) => i.name === m.name))
      .slice(0, 5);
    const data = {
      ...result,
      warnings:
        result.status === "api_error"
          ? ["アニメ検索APIに接続できませんでした"]
          : [],
      terms: variants,
      emptyMessage:
        result.status === "rights_unconfirmed"
          ? "作品は見つかりましたが画像の利用条件が確認できません"
          : result.status === "no_image"
            ? "作品は見つかりましたが画像がありません"
            : result.status === "api_error"
              ? "検索サービスに接続できません"
              : "適切な画像が見つかりません",
    };
    if (result.items.length) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + 300000, data });
    }
    return Response.json(data);
  }
  const curated = ["anime", "manga", "games", "movies", "characters"].includes(
    type,
  );
  let items: any[] = curated ? [] : [...wiki.items];
  if (type === "snacks" || type === "food") {
    try {
      items.unshift(...(await food(q)));
    } catch {
      warnings.push(
        "食品データベースは一時的に利用できません。Wikipedia等の候補を表示しています。",
      );
    }
  }
  const load = async (term: string, t: string) => {
    try {
      const r = await legacy({
        request: new Request(
          `https://local/api/search?q=${encodeURIComponent(term)}&type=${t}`,
        ),
      });
      const d = (await r.json()) as any;
      if (r.ok) return d.items || [];
      warnings.push(d.error);
      return [];
    } catch {
      return [];
    }
  };
  if (type === "anime" || type === "manga") {
    const anime = await load(variants.find((v) => v !== q) || q, type);
    items = [...anime.map((i: any) => ({ ...i, rank: 200 })), ...items];
    if (!anime.length && variants.length > 1)
      items.push(...(await load(q, type)));
  }
  if (["games", "movies", "characters"].includes(type)) {
    try {
      const result = await catalog(
        type === "characters" ? q : wiki.terms[0]?.en || q,
        type,
        env,
      );
      items = result.items;
      if (result.warning) warnings.push(result.warning);
    } catch {
      warnings.push("作品画像の検索元に接続できませんでした");
    }
  }
  if (!curated && (type === "general" || items.length < 4)) {
    items.push(...(await load(wiki.terms[0]?.en || q, "general")));
  }
  const unique = new Map<string, any>();
  for (const item of items.filter((i) => !unwanted(i))) {
    if (!unique.has(item.key)) unique.set(item.key, item);
  }
  const topics: Record<string, RegExp> = {
    snacks: /菓子|食品|製菓/,
    food: /料理|食品|食材/,
    games: /ゲーム/,
    movies: /映画/,
    characters: /キャラクター/,
    anime: /アニメ/,
    manga: /漫画/,
  };
  const score = (i: any) =>
    relevance(i.name, q) +
    (i.rank >= 200 ? 100 : 0) +
    (topics[type]?.test(i.topics || "") ? 25 : 0);
  items = [...unique.values()]
    .sort((a, b) => score(b) - score(a) || (b.rank || 0) - (a.rank || 0))
    .slice(0, 40);
  const data = {
    provider:
      type === "anime"
        ? "AniList / Kitsu"
        : type === "snacks" || type === "food"
          ? "Wikipedia / Wikimedia Commons / Open Food Facts"
          : type === "games"
            ? "RAWG"
            : type === "movies"
              ? "TMDB"
              : type === "characters"
                ? "AniList"
                : "Wikipedia / Wikimedia Commons",
    items,
    warnings,
    terms: variants,
    emptyMessage: "適切な画像が見つかりません",
  };
  if (items.length) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 300000, data });
  }
  return Response.json(data, {
    status:
      items.length ||
      !warnings.length ||
      (type === "games" && !env.RAWG_API_KEY) ||
      (type === "movies" && !env.TMDB_API_KEY)
        ? 200
        : 502,
  });
}
