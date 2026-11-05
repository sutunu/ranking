import { api, normalize, relevance } from "./discovery.ts";
const cache = new Map<string, { until: number; data: any }>();
export async function animeAliases(q: string) {
  const key = normalize(q),
    cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.data;
  const ja = /[\u3040-\u30ff\u3400-\u9fff]/.test(q),
    host = ja ? "ja.wikipedia.org" : "en.wikipedia.org";
  const results = await Promise.allSettled([
    api(
      host,
      {
        titles: q,
        redirects: "1",
        prop: "langlinks",
        lllang: ja ? "en" : "ja",
        lllimit: "1",
      },
      3500,
    ),
    api(
      host,
      {
        generator: "search",
        gsrsearch: q,
        gsrlimit: "5",
        prop: "langlinks",
        lllang: ja ? "en" : "ja",
        lllimit: "1",
      },
      3500,
    ),
  ]);
  const terms: any[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const pages = (Object.values(result.value.query?.pages || {}) as any[])
      .filter((p) => p.pageid > 0 && p.ns === 0)
      .sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const p of pages) {
      if (!terms.some((t) => t.name === p.title))
        terms.push({ name: p.title, en: p.langlinks?.[0]?.["*"] });
    }
  }
  const data = { items: [], terms: terms.slice(0, 3) };
  if (terms.length) {
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 900000, data });
  }
  return data;
}
