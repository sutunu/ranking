const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const artifact = path.resolve("artifacts");
fs.mkdirSync(artifact, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8788");
  await page
    .getByRole("heading", { name: "好きに、順位をつけよう。" })
    .waitFor();
  await page.screenshot({
    path: path.join(artifact, "desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "アップロード", exact: true }).click();
  await page
    .locator(".upload-area input")
    .setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.locator(".pool .tile").waitFor();
  await page.locator(".pool .tile").click();
  await page.getByRole("button", { name: "SS", exact: true }).last().click();
  if ((await page.locator(".tier-row").first().locator(".tile").count()) !== 1)
    throw Error("tap move failed");
  await page.getByRole("button", { name: "取り消し", exact: true }).click();
  await page.locator(".pool .tile").waitFor();
  await page.getByRole("button", { name: "やり直し", exact: true }).click();
  await page.locator(".tier-row").first().locator(".tile").waitFor();
  const srcBox = await page
    .locator(".tier-row")
    .first()
    .locator(".tile")
    .boundingBox();
  const dstBox = await page
    .locator(".tier-row")
    .nth(1)
    .locator(".dropzone")
    .boundingBox();
  await page.mouse.move(srcBox.x + 25, srcBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(dstBox.x + 35, dstBox.y + 35, { steps: 15 });
  await page.mouse.up();
  await page.locator(".tier-row").nth(1).locator(".tile").waitFor();
  await page
    .getByRole("textbox", { name: "ランキングタイトル", exact: true })
    .fill("動作確認ランキング");
  await page.waitForTimeout(1000);
  await page.reload();
  await page
    .getByRole("textbox", { name: "ランキングタイトル", exact: true })
    .waitFor();
  if (
    (await page
      .getByRole("textbox", { name: "ランキングタイトル", exact: true })
      .inputValue()) !== "動作確認ランキング"
  )
    throw Error("autosave failed");
  await page.locator(".tier-row").nth(1).locator(".tile").waitFor();
  await page
    .getByRole("button", { name: "画像として保存", exact: true })
    .click();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "PNGを作成・ダウンロード", exact: true })
    .click();
  const download = await dl;
  await download.saveAs(path.join(artifact, "export.png"));
  if (fs.statSync(path.join(artifact, "export.png")).size < 1000)
    throw Error("PNG too small");
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "SSの設定", exact: true }).click();
  await page
    .getByRole("textbox", { name: "ランク名", exact: true })
    .fill("BEST");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await page.getByRole("button", { name: "BEST", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "マイランキング", exact: true })
    .click();
  await page
    .getByRole("button", { name: "新しいランキング", exact: true })
    .click();
  if (
    (await page
      .getByRole("textbox", { name: "ランキングタイトル", exact: true })
      .inputValue()) !== "マイ・ティアリスト"
  )
    throw Error("new board failed");
  await page.waitForTimeout(6000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(artifact, "mobile.png"),
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("mobile overflow");
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.route("**/api/search?**", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            key: "mock:1",
            name: "テスト作品",
            url: "https://s4.anilist.co/test.png",
            source: "https://anilist.co/anime/1",
            credit: "Test credit",
          },
        ],
      },
    }),
  );
  await page.route("**/api/image?**", (r) =>
    r.fulfill({
      contentType: "image/png",
      body: fs.readFileSync(path.join(artifact, "export.png")),
    }),
  );
  await page
    .getByRole("textbox", { name: "画像検索キーワード" })
    .fill("進撃の巨人");
  await page.getByRole("button", { name: "画像を検索", exact: true }).click();
  await page.locator(".result>button").click();
  await page.locator(".pool .tile").waitFor();
  console.log(
    JSON.stringify({
      passed: [
        "upload",
        "tap move",
        "mouse drag between ranks",
        "undo/redo",
        "autosave reload",
        "PNG download",
        "rank editing",
        "multiple boards",
        "390px layout",
        "search/add with mocked upstream",
      ],
      errors,
    }),
  );
  if (errors.length) throw Error(errors.join("\n"));
  await page.context().close();
  await browser.close();
})();
