import { cropRect } from "./crop";
import { allItems, imageLoad, type Board } from "./model";
export async function exportPng(
  board: Board,
  bg: string,
  fit: boolean,
): Promise<Blob> {
  const width = 1400,
    label = 126,
    rowHeight = 150;
  const plans = board.ranks.map((rank) => {
    let x = label,
      row = 0;
    return rank.items.map((item) => {
      const w = rowHeight * (item.crop?.ratio || 2 / 3);
      if (x + w > width) {
        row++;
        x = label;
      }
      const p = { x, row, w };
      x += w;
      return p;
    });
  });
  const rows = plans.map((p) => Math.max(1, (p.at(-1)?.row || 0) + 1));
  const credits = [
    ...new Set(
      allItems(board)
        .map((i) => `${i.name} — ${i.credit} ${i.source}`)
        .filter(Boolean),
    ),
  ];
  const creditLines = credits.flatMap((s) => s.match(/.{1,120}/gu) || []);
  const height =
    140 +
    rows.reduce((n, r) => n + r * rowHeight, 0) +
    60 +
    creditLines.length * 22;
  if (height > 16000)
    throw Error("画像が大きすぎます。ランキングを分割してください");
  const c = document.createElement("canvas");
  c.width = width * 2;
  c.height = height * 2;
  const ctx = c.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = bg === "#ffffff" ? "#171719" : "#f3f3f3";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(board.title, 32, 65, width - 64);
  ctx.font = "14px sans-serif";
  ctx.fillText("TIER STUDIO", 32, 102);
  let y = 140;
  for (let r = 0; r < board.ranks.length; r++) {
    const rank = board.ranks[r],
      h = rows[r] * rowHeight;
    ctx.fillStyle = rank.color;
    ctx.fillRect(0, y, label, h);
    ctx.fillStyle = "#171719";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rank.name, label / 2, y + h / 2 + 9, label - 12);
    ctx.textAlign = "left";
    for (let i = 0; i < rank.items.length; i++) {
      const img = await imageLoad(rank.items[i].src);
      const { x, row, w: cell } = plans[r][i],
        top = y + row * rowHeight;
      if (fit) {
        const scale = Math.min(cell / img.width, rowHeight / img.height);
        ctx.drawImage(
          img,
          x + (cell - img.width * scale) / 2,
          top + (rowHeight - img.height * scale) / 2,
          img.width * scale,
          img.height * scale,
        );
      } else {
        const rect = cropRect(
          img.width,
          img.height,
          cell,
          rowHeight,
          rank.items[i].crop,
        );
        ctx.drawImage(
          img,
          rect.sx,
          rect.sy,
          rect.sw,
          rect.sh,
          x,
          top,
          cell,
          rowHeight,
        );
      }
    }
    y += h;
    ctx.strokeStyle = bg === "#ffffff" ? "#ddd" : "#29292c";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.fillStyle = bg === "#ffffff" ? "#555" : "#aaa";
  ctx.font = "13px sans-serif";
  creditLines.forEach((s, i) =>
    ctx.fillText(s, 24, y + 45 + i * 22, width - 48),
  );
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNGを生成できませんでした"))),
      "image/png",
    ),
  );
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
