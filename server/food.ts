import { agent } from "./discovery.ts";
const requests: number[] = [];
// Open Food Facts images: CC BY-SA 3.0; no paid key or manufacturer scraping.
export async function food(q: string) {
  const now = Date.now();
  while (requests.length && requests[0] < now - 60000) requests.shift();
  if (requests.length >= 8)
    throw Error("食品検索の利用上限です。少し待って再試行してください");
  requests.push(now);
  const u = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  Object.entries({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields:
      "code,product_name,product_name_ja,image_front_small_url,image_front_url,url",
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, {
    headers: { "User-Agent": agent },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw Error("食品データベースは現在利用できません");
  const d: any = await r.json();
  return (d.products || [])
    .filter((p: any) => p.image_front_small_url || p.image_front_url)
    .map((p: any) => ({
      key: `off:${p.code}`,
      name: p.product_name_ja || p.product_name || p.code,
      url: p.image_front_small_url || p.image_front_url,
      urls: [p.image_front_url].filter(Boolean),
      source: `https://world.openfoodfacts.org/product/${encodeURIComponent(p.code)}`,
      credit:
        "Open Food Facts contributors · CC BY-SA 3.0 · https://creativecommons.org/licenses/by-sa/3.0/ · 縮小・トリミングあり",
      rank: 120,
    }));
}
