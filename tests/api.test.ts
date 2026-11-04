import { it, expect, vi, afterEach } from "vitest";
import { onRequestGet as image } from "../functions/api/image";
import { onRequestGet as search } from "../functions/api/search";
afterEach(() => vi.unstubAllGlobals());
it("画像プロキシは任意ホスト・認証・HTTPを拒否する", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const url of [
    "https://localhost/secret",
    "http://upload.wikimedia.org/x",
    "https://user:pass@s4.anilist.co/x",
    "https://s4.anilist.co:8443/x",
  ]) {
    const r = await image({
      request: new Request(
        "https://example.com/api/image?url=" + encodeURIComponent(url),
      ),
    });
    expect(r.status).toBe(400);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("検索は空文字を拒否する", async () => {
  expect(
    (
      await search({
        request: new Request("https://example.com/api/search?q="),
      })
    ).status,
  ).toBe(400);
});
it("AniList候補を日本語と出典付きで返す", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          data: {
            Page: {
              media: [
                {
                  id: 1,
                  title: { native: "作品", romaji: "Work" },
                  coverImage: { large: "https://s4.anilist.co/a.jpg" },
                  siteUrl: "https://anilist.co/anime/1",
                },
              ],
            },
          },
        }),
      ),
  );
  const response = await search({
    request: new Request("https://example.com/api/search?q=test&type=anime"),
  });
  expect((await response.json()).items[0]).toMatchObject({
    name: "作品",
    key: "anilist:1",
    source: "https://anilist.co/anime/1",
  });
});
it("画像プロキシは非画像レスポンスを拒否する", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html>", { headers: { "Content-Type": "text/html" } }),
      ),
  );
  expect(
    (
      await image({
        request: new Request(
          "https://example.com/api/image?url=https://s4.anilist.co/test",
        ),
      })
    ).status,
  ).toBe(502);
});
it("AniListが利用不可の場合Kitsuにフォールバックする", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response("blocked", { status: 403 }))
      .mockResolvedValueOnce(
        Response.json({
          data: [
            {
              id: "7442",
              attributes: {
                titles: { ja_jp: "進撃の巨人" },
                slug: "shingeki-no-kyojin",
                nsfw: false,
                posterImage: { medium: "https://media.kitsu.app/test.jpg" },
              },
            },
          ],
        }),
      ),
  );
  const response = await search({
    request: new Request("https://example.com/api/search?q=test&type=anime"),
  });
  expect(await response.json()).toMatchObject({
    provider: "Kitsu",
    items: [{ name: "進撃の巨人", key: "kitsu:7442" }],
  });
});
