import { it, expect, vi, afterEach } from "vitest";
import { ndlBooks, relatedBook, bookKind, booksSearch } from "../server/books";
afterEach(() => vi.unstubAllGlobals());
it("巻数付き表紙を認め、同じ単語を含む無関係な本を拒否する", () => {
  expect(relatedBook("Frieren Tome 1", ["Frieren"])).toBe(true);
  expect(relatedBook("Die Reste frieren wir ein", ["Frieren"])).toBe(false);
  expect(relatedBook("小説 葬送のフリーレン", ["葬送のフリーレン"])).toBe(true);
});
it("Graphic Novelsを小説と誤分類しない", () => {
  expect(bookKind("Book", ["Comics & Graphic Novels / Manga"])).toBe(
    "漫画表紙",
  );
  expect(bookKind("小説 タイトル")).toBe("小説表紙");
});
it("NDL書誌のISBNと作品名を対応させる", () => {
  const xml =
    '<rss xmlns:dc="x" xmlns:xsi="y"><channel><item><title>作品 1</title><link>https://ndlsearch.ndl.go.jp/books/1</link><dc:identifier xsi:type="dcndl:ISBN">978-4-09850180-9</dc:identifier></item></channel></rss>';
  expect(ndlBooks(xml, "作品")).toEqual([
    {
      isbn: "9784098501809",
      name: "作品 1",
      source: "https://ndlsearch.ndl.go.jp/books/1",
    },
  ]);
});
it("Googleが制限中でもOpen Library候補を返し、ブロック設定と権利設定を維持する", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: any) =>
      String(url).includes("openlibrary.org/search")
        ? Response.json({
            docs: [
              {
                key: "/works/1",
                title: "Test Series Vol 1",
                cover_i: 10,
                subject: ["Manga"],
              },
            ],
          })
        : String(url).includes("ndlsearch")
          ? new Response("<rss><channel/></rss>")
          : new Response("", { status: 429 }),
    ),
  );
  const d = await booksSearch("Test Series", []);
  expect(d.items[0].kind).toBe("漫画表紙");
  expect(d.items[0].rights.officialVerification).toBe("unverified");
  expect(
    (await booksSearch("Test Series", [], "Open Library:10")).items,
  ).toEqual([]);
  expect((await booksSearch("Test Series", [], "", true)).items).toEqual([]);
});
