import { it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  wiki: vi.fn(),
  legacy: vi.fn(),
  food: vi.fn(),
  anime: vi.fn(),
}));
vi.mock("../server/books.ts", () => ({
  booksSearch: async () => ({ items: [], missing: [], diagnostics: [] }),
}));
vi.mock("../server/anime-aliases.ts", () => ({ animeAliases: mock.wiki }));
vi.mock("../server/discovery.ts", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  wikipedia: mock.wiki,
}));
vi.mock("../server/legacy.ts", () => ({ onRequestGet: mock.legacy }));
vi.mock("../server/food.ts", () => ({ food: mock.food }));
vi.mock("../server/anime.ts", () => ({ animeSearch: mock.anime }));
import { onRequestGet } from "../functions/api/search";
const request = (q: string, type: string) =>
  onRequestGet({
    request: new Request(
      `https://example.com/api/search?q=${encodeURIComponent(q)}&type=${type}`,
    ),
  });
beforeEach(() => {
  mock.wiki.mockReset().mockResolvedValue({ items: [], terms: [] });
  mock.legacy
    .mockReset()
    .mockImplementation(async () => Response.json({ items: [] }));
  mock.food.mockReset().mockResolvedValue([]);
  mock.anime
    .mockReset()
    .mockImplementation(async (q: string, variants: string[]) => {
      const r = await mock.legacy({
        request: new Request(
          "https://local/api/search?type=anime&q=" + encodeURIComponent(q),
        ),
      });
      const d = await r.json();
      return {
        items: (d.items || []).filter(
          (i: any) =>
            !/cosplay|fan art|実写版/.test([i.name, i.credit].join(" ")),
        ),
        status: "ok",
        diagnostics: [],
        provider: "test",
      };
    });
});
it("アニメ専門候補を同名の関連一般画像より優先する", async () => {
  mock.wiki.mockResolvedValue({
    items: [{ key: "wiki:1", name: "進撃する馬", rank: 99 }],
    terms: [{ name: "進撃の巨人" }],
  });
  mock.legacy.mockResolvedValue(
    Response.json({ items: [{ key: "anime:1", name: "進撃の巨人" }] }),
  );
  const d = await (await request("進撃", "anime")).json();
  expect(d.items[0].name).toBe("進撃の巨人");
});
it("食品API停止中も日本語商品画像を残す", async () => {
  mock.wiki.mockResolvedValue({
    items: [
      {
        key: "wiki:2",
        name: "じゃがりこ",
        url: "https://upload.wikimedia.org/a.jpg",
      },
    ],
    terms: [],
  });
  mock.food.mockRejectedValue(Error("503"));
  const d = await (await request("じゃがりこ", "snacks")).json();
  expect(d.items[0].name).toBe("じゃがりこ");
  expect(d.warnings.length).toBeGreaterThan(0);
});
it("外部サービスが全滅した場合は正常な検索成功と扱わない", async () => {
  mock.wiki.mockRejectedValue(Error("offline"));
  mock.legacy.mockResolvedValue(
    Response.json({ error: "offline" }, { status: 502 }),
  );
  expect((await request("offline-query", "general")).status).toBe(502);
});
it("同一画像を除去して検索結果を短期キャッシュする", async () => {
  mock.wiki.mockResolvedValue({
    items: [{ key: "shared", name: "cache-query" }],
    terms: [],
  });
  mock.legacy.mockResolvedValue(
    Response.json({ items: [{ key: "shared", name: "cache-query" }] }),
  );
  const first = await (await request("cache-query", "general")).json();
  const second = await (await request("cache-query", "general")).json();
  expect(first.items).toHaveLength(1);
  expect(second).toEqual(first);
  expect(mock.wiki).toHaveBeenCalledTimes(1);
});
it("専門検索は候補がなくても一般写真で補充しない", async () => {
  mock.wiki.mockResolvedValue({
    items: [{ key: "wiki:cosplay", name: "コスプレ写真" }],
    terms: [],
  });
  const d = await (await request("no-cover-query", "anime")).json();
  expect(d.items).toEqual([]);
  expect(d.emptyMessage).toBe("適切な画像が見つかりません");
  expect(
    mock.legacy.mock.calls
      .map((c) => new URL(c[0].request.url).searchParams.get("type"))
      .sort(),
  ).toEqual(["anime", "manga"]);
  expect(
    new URL(mock.legacy.mock.calls[0][0].request.url).searchParams.get("type"),
  ).toBe("anime");
});
it("コスプレ・実写・ファンアートの候補を除外する", async () => {
  mock.legacy.mockResolvedValue(
    Response.json({
      items: [
        { key: "good", name: "作品ポスター" },
        { key: "cos", name: "作品 cosplay" },
        { key: "fan", name: "作品", credit: "fan art" },
        { key: "actor", name: "作品 実写版" },
      ],
    }),
  );
  const d = await (await request("art-only", "anime")).json();
  expect(d.items.map((i: any) => i.key)).toEqual(["good"]);
});
it("RAWG未設定時にゲームの一般写真を出さない", async () => {
  const d = await (await request("pokemon-game", "games")).json();
  expect(d.items).toEqual([]);
  expect(d.warnings.join(" ")).toContain("利用できません");
  expect(mock.legacy).not.toHaveBeenCalled();
});
it("一般ジャンルでも作品と判別できた場合はポスター検索へ切り替える", async () => {
  mock.wiki.mockResolvedValue({
    items: [{ key: "wiki-photo", name: "一般写真" }],
    terms: [{ name: "作品" }],
    intent: "anime",
  });
  mock.legacy.mockResolvedValue(
    Response.json({
      items: [
        { key: "cover", name: "作品", artwork: "作品データベースのポスター" },
      ],
    }),
  );
  const d = await (await request("auto-artwork-query", "general")).json();
  expect(d.items.map((i: any) => i.key)).toEqual(["cover"]);
  expect(
    mock.legacy.mock.calls
      .map((c) => new URL(c[0].request.url).searchParams.get("type"))
      .sort(),
  ).toEqual(["anime", "manga"]);
  expect(
    new URL(mock.legacy.mock.calls[0][0].request.url).searchParams.get("type"),
  ).toBe("anime");
});
