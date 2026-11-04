import { describe, it, expect } from "vitest";
import { readSnapshot } from "./storage";
import { newBoard } from "./model";
import { normalize, relevance } from "../server/discovery";
describe("保存データ移行", () => {
  it("v1画像とランクを変更せずその他に移行する", () => {
    const b = newBoard();
    delete b.genre;
    b.pool = [
      {
        id: "image-old",
        name: "既存画像",
        src: "data:image/png;base64,AAAA",
        source: "",
        credit: "test",
        key: "original",
      },
    ];
    const old = { boards: [b], active: b.id };
    const copy = structuredClone(old);
    const s = readSnapshot(old);
    expect(s.boards[0]).toEqual({ ...b, genre: "その他" });
    expect(old).toEqual(copy);
    expect(s.version).toBe(2);
  });
  it("ジャンルの名前変更を復元し、旧名を勝手に復活させない", () => {
    const b = { ...newBoard(), genre: "作品" };
    const s = readSnapshot({
      version: 2,
      boards: [b],
      genres: ["作品", "お気に入り"],
      active: b.id,
    });
    expect(s.genres).toEqual(["作品", "お気に入り"]);
    expect(readSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("旧JSON配列を復元できる", () => {
    const b = newBoard();
    expect(readSnapshot([b]).boards).toEqual([b]);
  });
  it("不正なジャンル形式を拒否する", () =>
    expect(() =>
      readSnapshot({ boards: [newBoard()], genres: [5] }),
    ).toThrow());
  it("かな・英字・全半角を正規化し部分一致を優先する", () => {
    expect(normalize("ハイチュウ")).toBe(normalize("はいちゅう"));
    expect(normalize("Ｐｏｃｋｙ")).toBe(normalize("pocky"));
    expect(relevance("葬送のフリーレン", "フリーレン")).toBeGreaterThan(
      relevance("別の作品", "フリーレン"),
    );
  });
});
