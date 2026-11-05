import { XMLParser } from "fast-xml-parser";
import { normalize, relevance } from "./discovery.ts";
import { unwanted } from "./artwork.ts";
const requestTimes = new Map<string, number[]>(),
  cooldown = new Map<string, number>();
export function bookKind(title: string, subjects: string[] = []) {
  const value = title + " " + subjects.join(" ");
  return /manga|comics|graphic novels|漫画|コミック/i.test(value)
    ? "漫画表紙"
    : /小説|novel|fiction|ライトノベル/i.test(value)
      ? "小説表紙"
      : "書籍表紙";
}
const cache = new Map<string, { until: number; data: any }>();
const inflight = new Map<string, Promise<any>>();
const list = (v: any) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: any): string =>
  typeof v === "object" ? String(v?.["#text"] || "") : String(v || "");
export const relatedBook = (title: string, terms: string[]) => {
  const t = normalize(title.replace(/^(小説|アニメ|Novel|Manga)\s*/i, ""));
  return terms.some((q) => {
    const n = normalize(q);
    return n.length >= 2 && t.startsWith(n);
  });
};
export function ndlBooks(xml: string, q: string) {
  const d = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
  }).parse(xml);
  if (!d.rss || !("channel" in d.rss)) throw Error("invalid_bibliography");
  return list(d.rss.channel.item)
    .flatMap((i: any) => {
      const name = text(i.title);
      if (
        relevance(name, q) < 80 ||
        unwanted({ name }) ||
        !relatedBook(name, [q])
      )
        return [];
      const isbn = list(i["dc:identifier"]).find((id: any) =>
        String(id?.["@_xsi:type"]).includes("ISBN"),
      );
      const id = text(isbn).replace(/[^0-9X]/g, "");
      if (!/^\d{13}$/.test(id)) return [];
      return [{ isbn: id, name, source: text(i.link) }];
    })
    .slice(0, 16);
}
async function get(url: URL | string, json = true) {
  const host = new URL(url).hostname,
    now = Date.now();
  const times = (requestTimes.get(host) || []).filter((t) => t > now - 60000);
  if ((cooldown.get(host) || 0) > now || times.length >= 20)
    throw Error("rate_limited");
  times.push(now);
  requestTimes.set(host, times);
  const r = await fetch(url, {
    headers: {
      "User-Agent": "TierStudio/3.0 (https://github.com/sutunu/ranking)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    if ([429, 503].includes(r.status)) {
      const retry = r.headers.get("retry-after");
      const seconds = Number(retry);
      const until = retry
        ? Number.isFinite(seconds)
          ? Date.now() + seconds * 1000
          : Date.parse(retry)
        : NaN;
      cooldown.set(
        host,
        Math.max(Date.now() + 30000, Number.isFinite(until) ? until : 0),
      );
    }
    throw Error("http_" + r.status);
  }
  return json ? r.json() : r.text();
}
function candidate(
  provider: string,
  id: string,
  name: string,
  url: string,
  source: string,
  kind: string,
  extra: any = {},
) {
  return {
    key: `${provider}:${id}`,
    name,
    url: url.replace(/^http:/, "https:"),
    source,
    artwork: `${kind}（${provider}）`,
    kind,
    rights: {
      provider,
      officialVerification: "unverified",
      reuse: "permission_not_confirmed",
      terms:
        provider === "Google Books"
          ? "https://developers.google.com/books/terms"
          : provider === "openBD"
            ? "https://openbd.jp/"
            : "https://openlibrary.org/dev/docs/api/covers",
      source,
    },
    credit: `${provider}掲載の${kind} · ${source} · 画像の権利は各権利者に帰属。公式性・転載許諾は未確認。`,
    ...extra,
  };
}
export async function booksSearch(
  q: string,
  variants: string[],
  blocked = "",
  strict = false,
  googleKey = "",
) {
  const key = JSON.stringify([normalize(q), blocked, strict]);
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.data;
  if (inflight.has(key)) return inflight.get(key);
  const task = (async () => {
    const diagnostics: any[] = [],
      items: any[] = [],
      missing: any[] = [];
    const en = variants.find((t) => /^[\x20-\x7e]+$/.test(t) && t !== q) || q;
    await Promise.allSettled([
      (async () => {
        try {
          const u = new URL("https://www.googleapis.com/books/v1/volumes");
          u.searchParams.set("q", `intitle:${q}`);
          u.searchParams.set("maxResults", "20");
          if (googleKey) u.searchParams.set("key", googleKey);
          const d = await get(u);
          for (const b of d.items || []) {
            const v = b.volumeInfo || {},
              name = [v.title, v.subtitle].filter(Boolean).join(" ");
            if (unwanted({ name }) || !relatedBook(name, [q, ...variants]))
              continue;
            const url = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
            if (url)
              items.push(
                candidate(
                  "Google Books",
                  b.id,
                  name,
                  url,
                  v.infoLink?.replace(/^http:/, "https:") ||
                    `https://books.google.com/books?id=${b.id}`,
                  bookKind(name, v.categories || []),
                ),
              );
            else missing.push({ name, status: "no_image" });
          }
          diagnostics.push({ provider: "Google Books", status: "ok" });
        } catch (e) {
          diagnostics.push({
            provider: "Google Books",
            status: (e as Error).message,
          });
        }
      })(),
      (async () => {
        try {
          const u = new URL("https://openlibrary.org/search.json");
          u.searchParams.set("title", en);
          u.searchParams.set("limit", "16");
          u.searchParams.set(
            "fields",
            "key,title,cover_i,first_publish_year,isbn,subject,author_name",
          );
          const d = await get(u);
          for (const b of d.docs || []) {
            if (unwanted({ name: b.title }) || !relatedBook(b.title, [q, en]))
              continue;
            const source = `https://openlibrary.org${b.key}`;
            if (b.cover_i)
              items.push(
                candidate(
                  "Open Library",
                  String(b.cover_i),
                  b.title,
                  `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg?default=false`,
                  source,
                  bookKind(b.title, b.subject || []),
                  { year: b.first_publish_year },
                ),
              );
            else missing.push({ name: b.title, status: "no_image" });
          }
          diagnostics.push({ provider: "Open Library", status: "ok" });
        } catch (e) {
          diagnostics.push({
            provider: "Open Library",
            status: (e as Error).message,
          });
        }
      })(),
      (async () => {
        try {
          const u = new URL("https://ndlsearch.ndl.go.jp/api/opensearch");
          u.searchParams.set("title", q);
          u.searchParams.set("cnt", "50");
          const records = ndlBooks(await get(u, false), q);
          if (records.length) {
            const b = await get(
              "https://api.openbd.jp/v1/get?isbn=" +
                records.map((r) => r.isbn).join(","),
            );
            for (const entry of b || []) {
              const v = entry?.summary;
              if (!v) continue;
              const record = records.find((r) => r.isbn === v.isbn);
              const source = record?.source || `https://openbd.jp/`;
              if (v.cover)
                items.push(
                  candidate(
                    "openBD",
                    v.isbn,
                    v.title + (v.volume ? " " + v.volume : ""),
                    v.cover,
                    source,
                    /小説|ノベル/.test(v.title + " " + v.series)
                      ? "小説表紙"
                      : /コミック|漫画/.test(v.series)
                        ? "漫画表紙"
                        : "書籍表紙",
                    { isbn: v.isbn, publisher: v.publisher },
                  ),
                );
              else missing.push({ name: v.title, status: "no_image" });
            }
          }
          diagnostics.push({
            provider: "NDL/openBD",
            status: "ok",
            records: records.length,
          });
        } catch (e) {
          diagnostics.push({
            provider: "NDL/openBD",
            status: (e as Error).message,
          });
        }
      })(),
    ]);
    const excluded = new Set(blocked.split(/[\n,]/).map((s) => s.trim()));
    const unique = new Map<string, any>();
    for (const item of items) {
      if (
        excluded.has(item.key) ||
        excluded.has(item.source) ||
        excluded.has(item.url)
      )
        continue;
      unique.set(item.url, item);
    }
    const data = {
      items: strict ? [] : [...unique.values()],
      missing: strict
        ? [
            ...missing,
            ...items.map((i) => ({
              name: i.name,
              status: "rights_unconfirmed",
            })),
          ]
        : missing,
      diagnostics,
    };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, {
      until: Date.now() + (items.length ? 1800000 : 30000),
      data,
    });
    console.info(
      JSON.stringify({
        event: "book_search",
        query: q,
        diagnostics,
        images: data.items.length,
      }),
    );
    return data;
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}
