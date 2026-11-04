import { it, expect, vi, afterEach } from "vitest";
import { sameWork } from "../server/anime";
const work = (
  id: string,
  name: string,
  year: number,
  format: string,
  mal?: number,
) => ({
  id,
  name,
  year,
  format,
  mal,
  aliases: [name],
  source: "https://example.com",
  provider: "test",
});
it("共通MAL IDが一致すれば翻訳名が違っても同じ作品と判定する", () =>
  expect(
    sameWork(
      work("a", "日本語", 2020, "TV", 1),
      work("b", "English", 2020, "TV", 1),
    ),
  ).toBe(true));
it("続編や劇場版をタイトルの部分一致でまとめない", () => {
  expect(
    sameWork(work("a", "作品", 2020, "TV"), work("b", "作品2", 2020, "TV")),
  ).toBe(false);
  expect(
    sameWork(work("a", "作品", 2020, "TV"), work("b", "作品", 2021, "TV")),
  ).toBe(false);
  expect(
    sameWork(work("a", "作品", 2020, "TV"), work("b", "作品", 2020, "MOVIE")),
  ).toBe(false);
});
it("異なるMAL IDを表記だけで統合しない", () =>
  expect(
    sameWork(
      work("a", "作品", 2020, "TV", 1),
      work("b", "作品", 2020, "TV", 2),
    ),
  ).toBe(false));
import { animeSearch } from "../server/anime";
afterEach(() => vi.unstubAllGlobals());
it("一部API停止時も画像と未確認の権利情報を返す", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (u: any) =>
      String(u).includes("kitsu.io")
        ? Response.json({
            data: [
              {
                id: "test",
                attributes: {
                  titles: { ja_jp: "検証作品" },
                  canonicalTitle: "検証作品",
                  startDate: "2020-01-01",
                  subtype: "TV",
                  posterImage: { medium: "https://media.kitsu.app/test.jpg" },
                  slug: "test",
                },
              },
            ],
          })
        : new Response("", { status: 503 }),
    ),
  );
  const result = await animeSearch("検証作品", []);
  expect(result.items[0].rights.reuse).toBe("permission_not_confirmed");
  expect(result.items[0].rights.officialVerification).toBe("unverified");
  expect(result.diagnostics.some((d) => d.status === "http_503")).toBe(true);
  const restricted = await animeSearch("検証作品", [], "", true);
  expect(restricted.items).toEqual([]);
  expect(restricted.status).toBe("rights_unconfirmed");
  const removed = await animeSearch("検証作品", [], "kitsu:test");
  expect(removed.items).toEqual([]);
});
