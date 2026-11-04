import { parseBoards, type Board } from "./model";
export const defaultGenres = [
  "アニメ",
  "お菓子",
  "ゲーム",
  "映画",
  "漫画",
  "キャラクター",
  "食べ物",
  "その他",
];
export function readSnapshot(value: unknown): {
  version: 2;
  boards: Board[];
  genres: string[];
  active: string;
} {
  const v = value as any;
  const boards = parseBoards(Array.isArray(v) ? v : v.boards).map((b) => ({
    ...b,
    genre: typeof b.genre === "string" && b.genre.trim() ? b.genre : "その他",
  }));
  const supplied = Array.isArray(v.genres) ? v.genres : [];
  if (
    supplied.some(
      (s: unknown) => typeof s !== "string" || !s.trim() || s.length > 40,
    ) ||
    supplied.length > 200
  )
    throw Error("ジャンルの形式が正しくありません");
  const genres = [
    ...new Set([
      ...(v.version === 2 ? [] : defaultGenres),
      ...supplied,
      ...boards.map((b) => b.genre),
    ]),
  ];
  if (genres.length > 200) throw Error("ジャンルは合計200件までです");
  return {
    version: 2,
    boards,
    genres,
    active: boards.some((b) => b.id === v.active) ? v.active : boards[0].id,
  };
}
export const searchType = (genre: string) =>
  ({
    アニメ: "anime",
    漫画: "manga",
    お菓子: "snacks",
    ゲーム: "games",
    映画: "movies",
    キャラクター: "characters",
    食べ物: "food",
  })[genre] || "general";
