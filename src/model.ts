import type { Crop } from "./crop";
export type Item = {
  crop?: Crop;
  rights?: {
    provider: string;
    officialVerification: string;
    reuse: string;
    terms: string;
    source: string;
  };
  workId?: string;
  id: string;
  name: string;
  src: string;
  source: string;
  credit: string;
  key: string;
};
export type Rank = { id: string; name: string; color: string; items: Item[] };
export type Board = {
  genre?: string;
  id: string;
  title: string;
  ranks: Rank[];
  pool: Item[];
  updated: number;
};
export const uid = () => crypto.randomUUID();
export const newBoard = (): Board => ({
  id: uid(),
  genre: "その他",
  title: "マイ・ティアリスト",
  ranks: ["SS", "S", "A", "B", "C", "D"].map((name, i) => ({
    id: uid(),
    name,
    color: ["#ed7975", "#f3a558", "#f1df70", "#b8e67d", "#75d1db", "#b38ae0"][
      i
    ],
    items: [],
  })),
  pool: [],
  updated: Date.now(),
});
export const allItems = (b: Board) => [
  ...b.ranks.flatMap((r) => r.items),
  ...b.pool,
];
export function moveItem(
  b: Board,
  id: string,
  target: string,
  before?: string,
): Board {
  const item = allItems(b).find((x) => x.id === id);
  if (!item || id === before) return b;
  const original =
    target === "pool" ? b.pool : b.ranks.find((r) => r.id === target)?.items;
  const from = original?.findIndex((x) => x.id === id) ?? -1;
  const to = original?.findIndex((x) => x.id === before) ?? -1;
  const next = structuredClone(b);
  next.pool = next.pool.filter((x) => x.id !== id);
  next.ranks.forEach((r) => (r.items = r.items.filter((x) => x.id !== id)));
  const list =
    target === "pool"
      ? next.pool
      : next.ranks.find((r) => r.id === target)?.items;
  if (!list) return b;
  const index = before ? list.findIndex((x) => x.id === before) : -1;
  list.splice(
    index < 0 ? list.length : index + (from >= 0 && from < to ? 1 : 0),
    0,
    item,
  );
  return next;
}
export function parseBoards(value: unknown): Board[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw Error("ランキングの形式が正しくありません");
  const ids = new Set<string>();
  for (const b of value) {
    if (
      !b ||
      typeof b.id !== "string" ||
      ids.has(b.id) ||
      typeof b.title !== "string" ||
      (b.genre !== undefined &&
        (typeof b.genre !== "string" ||
          !b.genre.trim() ||
          b.genre.length > 40)) ||
      typeof b.updated !== "number" ||
      !Number.isFinite(b.updated) ||
      !Array.isArray(b.ranks) ||
      !Array.isArray(b.pool) ||
      b.ranks.length > 50
    )
      throw Error("ランキングの形式が正しくありません");
    ids.add(b.id);
    const local = new Set<string>();
    for (const r of b.ranks) {
      if (
        typeof r.id !== "string" ||
        local.has(r.id) ||
        r.id === "pool" ||
        typeof r.name !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(r.color) ||
        !Array.isArray(r.items)
      )
        throw Error("ランクの形式が正しくありません");
      local.add(r.id);
    }
    for (const x of allItems(b)) {
      if (
        typeof x.id !== "string" ||
        local.has(x.id) ||
        typeof x.name !== "string" ||
        (x.crop !== undefined &&
          (!x.crop ||
            ![x.crop.x, x.crop.y, x.crop.zoom, x.crop.ratio].every(
              Number.isFinite,
            ) ||
            x.crop.x < 0 ||
            x.crop.x > 100 ||
            x.crop.y < 0 ||
            x.crop.y > 100 ||
            x.crop.zoom < 1 ||
            x.crop.zoom > 4 ||
            x.crop.ratio < 0.5 ||
            x.crop.ratio > 2)) ||
        typeof x.src !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,/.test(x.src) ||
        typeof x.key !== "string" ||
        typeof x.source !== "string" ||
        (x.source !== "" && !/^https:\/\//.test(x.source)) ||
        typeof x.credit !== "string"
      )
        throw Error("画像の形式が正しくありません");
      local.add(x.id);
    }
  }
  return value as Board[];
}
export function imageLoad(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("画像を読み込めませんでした"));
    img.src = src;
  });
}
export async function normalizeImage(blob: Blob): Promise<string> {
  if (blob.size > 15 * 1024 * 1024) throw Error("画像は15MB以下にしてください");
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ].includes(blob.type)
  )
    throw Error("対応形式: JPG / PNG / WebP / GIF / AVIF");
  const url = URL.createObjectURL(blob);
  try {
    const img = await imageLoad(url);
    const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
