export type Crop = { x: number; y: number; zoom: number; ratio: number };
export const defaultCrop: Crop = { x: 50, y: 50, zoom: 1, ratio: 2 / 3 };
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export function cropRect(
  iw: number,
  ih: number,
  w: number,
  h: number,
  crop?: Crop,
) {
  const c = { ...defaultCrop, ...crop };
  const scale = Math.max(w / iw, h / ih) * c.zoom,
    sw = w / scale,
    sh = h / scale;
  return { sx: ((iw - sw) * c.x) / 100, sy: ((ih - sh) * c.y) / 100, sw, sh };
}
