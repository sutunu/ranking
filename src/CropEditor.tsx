import { useRef, useState } from "react";
import { defaultCrop, clamp, type Crop } from "./crop";
import type { Item } from "./model";
export function CropEditor({
  item,
  onSave,
}: {
  item: Item;
  onSave: (c: Crop) => void;
}) {
  const [c, setC] = useState<Crop>({ ...defaultCrop, ...item.crop });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  return (
    <>
      <p className="helper">
        指で移動・2本指で拡大縮小。元画像は変更しません。保存すると枠いっぱい表示に切り替わります。
      </p>
      <div
        className="crop-preview"
        style={{ aspectRatio: String(c.ratio) }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          const old = pointers.current.get(e.pointerId);
          if (!old) return;
          const other = [...pointers.current.entries()].find(
            ([id]) => id !== e.pointerId,
          )?.[1];
          if (other) {
            const before = Math.hypot(old.x - other.x, old.y - other.y),
              after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
            if (before > 0)
              setC((c) => ({
                ...c,
                zoom: clamp((c.zoom * after) / before, 1, 4),
              }));
          } else {
            const dx = e.clientX - old.x,
              dy = e.clientY - old.y;
            setC((c) => ({
              ...c,
              x: clamp(c.x - dx * 0.5, 0, 100),
              y: clamp(c.y - dy * 0.5, 0, 100),
            }));
          }
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={() => pointers.current.clear()}
      >
        <img
          src={item.src}
          alt={item.name}
          draggable={false}
          style={{
            objectPosition: `${c.x}% ${c.y}%`,
            transform: `scale(${c.zoom})`,
            transformOrigin: `${c.x}% ${c.y}%`,
          }}
        />
      </div>
      <label className="field">
        枠の縦横比
        <select
          aria-label="枠の縦横比"
          value={c.ratio}
          onChange={(e) => setC({ ...c, ratio: Number(e.target.value) })}
        >
          <option value={2 / 3}>縦長 2:3</option>
          <option value={3 / 4}>縦長 3:4</option>
          <option value={1}>正方形 1:1</option>
          <option value={16 / 9}>横長 16:9</option>
        </select>
      </label>
      {(
        [
          ["x", "左右", 0, 100],
          ["y", "上下", 0, 100],
          ["zoom", "拡大率", 1, 4],
        ] as const
      ).map(([key, label, min, max]) => (
        <label className="field" key={key}>
          {label}
          <input
            aria-label={label}
            type="range"
            min={min}
            max={max}
            step={key === "zoom" ? 0.01 : 1}
            value={c[key]}
            onChange={(e) => setC({ ...c, [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="modal-actions">
        <button className="button" onClick={() => setC(defaultCrop)}>
          中央にリセット
        </button>
        <button className="button primary" onClick={() => onSave(c)}>
          表示位置を保存
        </button>
      </div>
    </>
  );
}
