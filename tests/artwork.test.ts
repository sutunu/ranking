import { it, expect, vi, afterEach } from "vitest";
import { catalog } from "../server/artwork";
afterEach(() => vi.unstubAllGlobals());
it("TMDBはポスター登録のない作品を除外して日本語タイトルを返す", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        results: [
          { id: 1, title: "作品", poster_path: "/poster.jpg" },
          { id: 2, title: "画像なし", poster_path: null },
        ],
      }),
    ),
  );
  const d = await catalog("作品", "movies", { TMDB_API_KEY: "test-only" });
  expect(d.items).toHaveLength(1);
  expect(d.items[0]).toMatchObject({
    name: "作品",
    url: "https://image.tmdb.org/t/p/w500/poster.jpg",
  });
});
it("RAWGは登録作品画像だけを返し公式確認済みと表示しない", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            id: 1,
            name: "Game",
            slug: "game",
            background_image: "https://media.rawg.io/a.jpg",
          },
          { id: 2, name: "No artwork" },
        ],
      }),
    ),
  );
  const d = await catalog("game", "games", { RAWG_API_KEY: "test-only" });
  expect(d.items).toHaveLength(1);
  expect(d.items[0].credit).toContain("公式性を独立検証した画像ではありません");
});
