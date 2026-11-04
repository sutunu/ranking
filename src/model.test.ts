import { describe, it, expect } from "vitest";
import { newBoard, moveItem, parseBoards, allItems, type Item } from "./model";
const item = (id: string): Item => ({
  id,
  name: id,
  src: "data:image/png;base64,AAAA",
  key: id,
  credit: "test",
  source: "",
});
describe("ランキングデータ", () => {
  it("初期ランクと配色を作成する", () => {
    const b = newBoard();
    expect(b.ranks.map((r) => r.name)).toEqual(["SS", "S", "A", "B", "C", "D"]);
    expect(new Set(b.ranks.map((r) => r.color)).size).toBe(6);
  });
  it("ランク間移動で画像が重複せず、元データを変更しない", () => {
    const b = newBoard();
    b.pool = [item("a"), item("b")];
    const next = moveItem(b, "a", b.ranks[0].id);
    expect(next.pool.map((x) => x.id)).toEqual(["b"]);
    expect(next.ranks[0].items[0].id).toBe("a");
    expect(allItems(next)).toHaveLength(2);
    expect(b.pool).toHaveLength(2);
  });
  it("同一ランク内で前後に並び替える", () => {
    const b = newBoard();
    b.pool = [item("a"), item("b"), item("c")];
    const next = moveItem(b, "a", "pool", "c");
    expect(next.pool.map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(moveItem(next, "a", "pool", "b").pool.map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("不正な復元データ・重複ID・危険なURLを拒否する", () => {
    expect(() => parseBoards({})).toThrow();
    const b = newBoard();
    b.pool = [item("a"), item("a")];
    expect(() => parseBoards([b])).toThrow();
    b.pool = [{ ...item("b"), source: "javascript:alert(1)" }];
    expect(() => parseBoards([b])).toThrow();
  });
  it("JSON往復で埋め込み画像と出典が残る", () => {
    const b = newBoard();
    b.pool = [item("a")];
    expect(parseBoards(JSON.parse(JSON.stringify([b])))).toEqual([b]);
  });
});
