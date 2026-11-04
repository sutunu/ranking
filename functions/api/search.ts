import { food } from "../../server/food.ts";
import { onRequestGet as legacy } from "../../server/legacy.ts";
import { wikipedia, relevance } from "../../server/discovery.ts";
const cache = new Map<string, { until: number; data: unknown }>();
export async function onRequestGet({ request }: { request: Request }) {
  const u = new URL(request.url),
    q = u.searchParams.get("q")?.normalize("NFKC").trim().slice(0, 120),
    type = u.searchParams.get("type") || "general";
  if (!q)
    return Response.json(
      { error: "検索語を入力してください" },
      { status: 400 },
    );
  const key = type + ":" + q;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return Response.json(cached.data);
  const warnings: string[] = [];
  let wiki: { items: any[]; terms: any[] } = { items: [], terms: [] };
  try {
    wiki = await wikipedia(q);
  } catch {
    warnings.push("Wikipediaに接続できませんでした");
  }
  const variants = [
    q,
    ...wiki.terms.flatMap((t) => [t.name, t.en]).filter(Boolean),
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);
  let items: any[] = [...wiki.items];
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
  if (type === "general" || items.length < 4) {
    items.push(...(await load(wiki.terms[0]?.en || q, "general")));
  }
  const unique = new Map<string, any>();
  for (const item of items) {
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
        ? "AniList / Kitsu / Wikipedia"
        : type === "snacks" || type === "food"
          ? "Wikipedia / Wikimedia Commons / Open Food Facts"
          : "Wikipedia / Wikimedia Commons",
    items,
    warnings,
    terms: variants,
  };
  if (items.length) {
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 300000, data });
  }
  return Response.json(data, {
    status: items.length || !warnings.length ? 200 : 502,
  });
}
