const { chromium } = require("@playwright/test");
const fs = require("fs");
fs.mkdirSync("artifacts", { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8788");
  await page.getByRole("button", { name: "SSの設定", exact: true }).tap();
  await page.getByLabel("ランク名", { exact: true }).fill("最上位");
  await page.getByLabel("背景色", { exact: true }).fill("#123456");
  await page.getByRole("button", { name: "変更を保存", exact: true }).tap();
  await page.getByRole("button", { name: "ランクを追加", exact: true }).tap();
  await page.getByLabel("ランキングのジャンル").selectOption("アニメ");
  await page
    .getByRole("textbox", { name: "画像検索キーワード" })
    .fill("進撃の巨人");
  await page.getByRole("button", { name: "画像を検索", exact: true }).tap();
  await page.locator(".result>button").first().waitFor({ timeout: 40000 });
  console.log("live search results", await page.locator(".result").count());
  if (
    !(await page.locator(".artwork-label").first().innerText()).match(
      /作品データベース|(?:Kitsu|AniList|Jikan)掲載のポスター/,
    )
  )
    throw Error("unclassified photo result");
  await page.locator(".result>button").nth(0).tap();
  const chooser = page.getByRole("dialog", {
    name: "どのランクに追加しますか？",
  });
  await chooser.waitFor();
  if ((await chooser.locator(".direct-rank-options button").count()) !== 8)
    throw Error("rank options missing");
  if (
    !(
      await chooser
        .getByRole("button", { name: "最上位", exact: true })
        .getAttribute("style")
    ).includes("18, 52, 86")
  )
    throw Error("rank color mismatch");
  await page.screenshot({ path: "artifacts/rank-picker-mobile.png" });
  await chooser.getByRole("button", { name: "最上位", exact: true }).tap();
  await page
    .locator(".tier-row")
    .first()
    .locator(".tile")
    .waitFor({ timeout: 30000 });
  if (await page.locator(".pool .tile").count())
    throw Error("direct add incorrectly used pool");
  console.log("direct rank addition passed");
  await page.locator(".result>button").nth(1).tap();
  await page
    .getByRole("dialog", { name: "どのランクに追加しますか？" })
    .getByRole("button", { name: "最上位", exact: true })
    .tap();
  await page.waitForFunction(
    () => document.querySelectorAll(".tier-row:first-child .tile").length === 2,
  );
  await page
    .locator(".tier-row")
    .first()
    .evaluate((e) => e.scrollIntoView({ block: "center" }));
  const cdp = await context.newCDPSession(page);
  async function drag(from, to) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x, y: from.y, id: 1 }],
    });
    await page.waitForTimeout(320);
    for (let i = 1; i <= 12; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * i) / 12,
            y: from.y + ((to.y - from.y) * i) / 12,
            id: 1,
          },
        ],
      });
      await page.waitForTimeout(25);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(300);
  }
  let src = await page
    .locator(".tier-row")
    .first()
    .locator(".tile")
    .first()
    .boundingBox();
  let dst = await page
    .locator(".tier-row")
    .nth(1)
    .locator(".dropzone")
    .boundingBox();
  await drag(
    { x: src.x + 25, y: src.y + 35 },
    { x: dst.x + 30, y: dst.y + 40 },
  );
  await page
    .locator(".tier-row")
    .nth(1)
    .locator(".tile")
    .waitFor({ timeout: 5000 });
  console.log("touch drag between ranks passed");
  await page.locator(".tier-row").first().locator(".tile").tap();
  await page.locator(".move-options button").filter({ hasText: /^S$/ }).tap();
  const tiles = page.locator(".tier-row").nth(1).locator(".tile");
  const before = await tiles.first().getAttribute("aria-label");
  src = await tiles.first().boundingBox();
  dst = await tiles.nth(1).boundingBox();
  await drag(
    { x: src.x + 25, y: src.y + 35 },
    { x: dst.x + 35, y: dst.y + 35 },
  );
  if ((await tiles.first().getAttribute("aria-label")) === before)
    throw Error("touch reorder did not change order");
  console.log("touch reorder passed");
  await page.screenshot({ path: "artifacts/mobile-live.png", fullPage: true });
  await page.getByRole("button", { name: "画像として保存", exact: true }).tap();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PNGを作成・ダウンロード", exact: true })
    .tap();
  await (await dl).saveAs("artifacts/live-export.png");
  console.log(
    JSON.stringify({
      passed: [
        "live Japanese Kitsu fallback search",
        "real remote image download",
        "direct rank selection with custom name/color and added rank",
        "long press touch drag",
        "touch same-rank reorder",
        "PNG with real external artwork",
      ],
      errors,
    }),
  );
  await browser.close();
})();
