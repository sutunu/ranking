import { it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  wiki: vi.fn(),
  legacy: vi.fn(),
  food: vi.fn(),
}));
vi.mock("../server/discovery.ts", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  wikipedia: mock.wiki,
}));
vi.mock("../server/legacy.ts", () => ({ onRequestGet: mock.legacy }));
vi.mock("../server/food.ts", () => ({ food: mock.food }));
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
