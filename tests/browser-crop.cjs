const { chromium } = require("@playwright/test");
const fs = require("fs");
fs.mkdirSync("artifacts", { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await p.goto(process.env.BASE_URL || "http://localhost:8788");
  const data = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 300;
    c.height = 100;
    const x = c.getContext("2d");
    ["red", "blue", "lime"].forEach((v, i) => {
      x.fillStyle = v;
      x.fillRect(i * 100, 0, 100, 100);
    });
    return c.toDataURL("image/png");
  });
  await p.getByRole("button", { name: "アップロード", exact: true }).click();
  await p.locator(".upload-area input").setInputFiles({
    name: "landscape.png",
    mimeType: "image/png",
    buffer: Buffer.from(data.split(",")[1], "base64"),
  });
  await p.locator(".pool .tile").click();
  await p
    .getByRole("button", { name: "画像の表示位置を調整", exact: true })
    .click();
  const rect = await p.locator(".crop-preview").boundingBox();
  const cdp = await p.context().newCDPSession(p);
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: cx - 10, y: cy, id: 1 },
      { x: cx + 10, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: cx - 30, y: cy, id: 1 },
      { x: cx + 30, y: cy, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  if (Number(await p.getByLabel("拡大率", { exact: true }).inputValue()) <= 1)
    throw Error("pinch zoom failed");
  await p.getByLabel("枠の縦横比").selectOption("1");
  await p.getByLabel("左右", { exact: true }).fill("100");
  await p.getByLabel("拡大率", { exact: true }).fill("2");
  await p.getByRole("button", { name: "表示位置を保存" }).click();
  await p.locator(".pool .tile").click();
  await p.locator(".move-options button").filter({ hasText: /^SS$/ }).click();
  await p.waitForTimeout(800);
  await p.reload();
  await p.locator(".tier-row").first().locator(".tile img").waitFor();
  const style = await p
    .locator(".tier-row")
    .first()
    .locator(".tile img")
    .getAttribute("style");
  if (!style.includes("scale(2)") || !style.includes("100%"))
    throw Error("crop not persisted");
  await p.getByRole("button", { name: "画像として保存", exact: true }).click();
  const dl = p.waitForEvent("download");
  await p
    .getByRole("button", { name: "PNGを作成・ダウンロード", exact: true })
    .click();
  const f = await dl;
  await f.saveAs("artifacts/crop-export.png");
  const png = fs.readFileSync("artifacts/crop-export.png");
  const { PNG } = require("pngjs");
  const image = PNG.sync.read(png);
  const index = ((140 + 75) * 2 * image.width + (126 + 75) * 2) * 4;
  if (image.data[index + 1] < 240 || image.data[index] > 20)
    throw Error("PNG crop differs from preview");
  console.log("crop preview / saved crop / PNG pixels passed");
  await b.close();
})();
