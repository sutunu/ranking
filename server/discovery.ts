export const agent = "TierStudio/2.0 (https://github.com/sutunu/ranking)";
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 96),
    )
    .replace(/[^\p{L}\p{N}]/gu, "");
export function relevance(name: string, q: string) {
  const a = normalize(name),
    b = normalize(q);
  if (a === b) return 100;
  if (a.includes(b)) return 80;
  const grams = (s: string) =>
    new Set(
      Array.from({ length: Math.max(1, s.length - 1) }, (_, i) =>
        s.slice(i, i + 2),
      ),
    );
  const x = grams(a),
    y = grams(b);
  return (50 * [...y].filter((c) => x.has(c)).length) / Math.max(1, y.size);
}
export async function api(
  host: string,
  params: Record<string, string>,
  timeout = 10000,
) {
  const u = new URL(`https://${host}/w/api.php`);
  Object.entries({ action: "query", format: "json", ...params }).forEach(
    ([k, v]) => u.searchParams.set(k, v),
  );
  const r = await fetch(u, {
    headers: { "User-Agent": agent },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw Error(`${host}: ${r.status}`);
  const d = (await r.json()) as any;
  if (d.error) throw Error(d.error.info);
  return d;
}
const clean = (s = "") =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .slice(0, 1500);
export async function wikipedia(q: string, correct = true) {
  const ja = /[\u3040-\u30ff\u3400-\u9fff]/.test(q),
    host = ja ? "ja.wikipedia.org" : "en.wikipedia.org";
  let exactTerm: { name: string; en?: string } | undefined;
  try {
    const resolved = await api(host, {
      titles: q,
      redirects: "1",
      prop: "info|langlinks",
      lllang: ja ? "en" : "ja",
      lllimit: "1",
    });
    const page = (Object.values(resolved.query?.pages || {}) as any[]).find(
      (p) => p.pageid > 0 && p.ns === 0,
    );
    if (page) {
      exactTerm = { name: page.title, en: page.langlinks?.[0]?.["*"] };
      if (page.title !== q) q = page.title;
    }
  } catch {}
  let d = await api(host, {
    generator: "search",
    gsrsearch: q,
    gsrlimit: "8",
    cllimit: "20",
    prop: "pageimages|info|langlinks|categories",
    piprop: "thumbnail|name",
    pithumbsize: "500",
    inprop: "url",
    lllang: ja ? "en" : "ja",
    lllimit: "8",
  });
  let pages = Object.values(d.query?.pages || {}) as any[];
  pages.sort((a, b) => a.index - b.index);
  if (!pages.length || pages.every((p) => relevance(p.title, q) < 60)) {
    const kana = q.replace(/[\u3041-\u3096]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 96),
    );
    if (kana !== q) {
      d = await api(host, {
        generator: "search",
        gsrsearch: kana,
        gsrlimit: "8",
        cllimit: "20",
        prop: "pageimages|info|langlinks|categories",
        piprop: "thumbnail|name",
        pithumbsize: "500",
        inprop: "url",
        lllang: "en",
        lllimit: "8",
      });
      pages = [...pages, ...Object.values(d.query?.pages || {})];
    }
  }
  if (correct && pages.every((p) => relevance(p.title, q) < 60)) {
    try {
      const suggestions = await api(host, {
        list: "search",
        srsearch: q,
        srinfo: "suggestion",
        srlimit: "1",
      });
      const spelling = suggestions.query?.searchinfo?.suggestion;
      if (spelling && spelling !== q) return wikipedia(spelling, false);
    } catch {}
  }
  const titles = pages.map((p) => p.title).join(" ");
  const intent = /[（(]アニメ[)）]/.test(titles)
    ? "anime"
    : /[（(]漫画[)）]/.test(titles)
      ? "manga"
      : /[（(]映画[)）]/.test(titles)
        ? "movies"
        : /[（(].*ゲーム.*[)）]/.test(titles)
          ? "games"
          : undefined;
  const terms = [
    ...(exactTerm ? [exactTerm] : []),
    ...pages
      .slice(0, 2)
      .map((p) => ({ name: p.title, en: p.langlinks?.[0]?.["*"] })),
  ];
  const others = pages
    .slice(0, 3)
    .filter((p) => !p.thumbnail && p.langlinks?.[0]?.["*"]);
  if (others.length) {
    try {
      const en = await api(ja ? "en.wikipedia.org" : "ja.wikipedia.org", {
        titles: others.map((p) => p.langlinks[0]["*"]).join("|"),
        redirects: "1",
        prop: "pageimages|info",
        piprop: "thumbnail|name",
        pithumbsize: "500",
        inprop: "url",
      });
      for (const p of Object.values(en.query?.pages || {}) as any[]) {
        const original = others.find(
          (o) =>
            o.langlinks[0]["*"] === p.title ||
            en.query?.redirects?.some(
              (r: any) => r.from === o.langlinks[0]["*"] && r.to === p.title,
            ),
        );
        if (p.thumbnail && original)
          pages.push({ ...p, title: original.title, index: original.index });
      }
    } catch {}
  }
  const visible = pages.filter((p) => p.thumbnail && p.pageimage);
  if (!visible.length) return { items: [], terms, intent };
  const files = await api("commons.wikimedia.org", {
    titles: visible.map((p) => "File:" + p.pageimage).join("|"),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "500",
  });
  const items = visible.flatMap((p) => {
    const file = (Object.values(files.query?.pages || {}) as any[]).find(
      (f) =>
        f.title?.replace(/^File:/, "").replaceAll("_", " ") ===
        p.pageimage.replaceAll("_", " "),
    );
    const info = file?.imageinfo?.[0],
      m = info?.extmetadata;
    if (!m?.LicenseShortName?.value) return [];
    return [
      {
        key: `commons:${file.pageid}`,
        name: p.title,
        topics: (p.categories || []).map((c: any) => c.title).join(" "),
        url: info.thumburl || p.thumbnail.source,
        urls: [info.url, p.thumbnail.source].filter(Boolean),
        source: info.descriptionurl,
        credit: [
          clean(m.Artist?.value),
          clean(m.LicenseShortName.value),
          clean(m.LicenseUrl?.value),
          "縮小・トリミングあり",
        ]
          .filter(Boolean)
          .join(" · "),
        rank: 100 - (p.index || 8),
      },
    ];
  });
  return { items, terms, intent };
}
