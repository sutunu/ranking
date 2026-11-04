import { it, expect } from "vitest";
import { cropRect } from "./crop";
import { parseBoards, newBoard } from "./model";
it("横長画像を中央で非破壊トリミングする", () => {
  expect(cropRect(300, 100, 100, 100)).toEqual({
    sx: 100,
    sy: 0,
    sw: 100,
    sh: 100,
  });
});
it("拡大と表示位置をCanvasにも適用する", () => {
  expect(
    cropRect(300, 100, 100, 100, { x: 100, y: 50, zoom: 2, ratio: 1 }),
  ).toEqual({ sx: 250, sy: 25, sw: 50, sh: 50 });
});
it("範囲外やNaNの切り抜き設定を復元しない", () => {
  const b = newBoard();
  b.pool = [
    {
      id: "a",
      name: "a",
      src: "data:image/png;base64,AAAA",
      source: "",
      credit: "",
      key: "a",
      crop: { x: 200, y: 50, zoom: 1, ratio: 1 },
    },
  ];
  expect(() => parseBoards([b])).toThrow();
});
