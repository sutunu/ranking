const { chromium } = require("@playwright/test");
const fs = require("fs");
fs.mkdirSync("artifacts", { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const base = process.env.BASE_URL || "http://localhost:8788",
    report = [];
  for (const q of [
    "葬送のフリーレン",
    "暗殺教室",
    "ぼっち・ざ・ろっく！",
    "ソードアート・オンライン",
  ].filter((q) => !process.env.CASE_FILTER || q === process.env.CASE_FILTER)) {
    const row = { q };
    try {
      const d = await (
        await fetch(base + "/api/search?type=anime&q=" + encodeURIComponent(q))
      ).json();
      row.diagnostics = d.diagnostics;
      const books = d.items.filter((i) => i.kind);
      row.candidates = books.map((i) => ({
        name: i.name,
        kind: i.kind,
        source: i.source,
        url: i.url,
      }));
      books.sort(
        (a, b) =>
          (b.kind === "小説表紙" ? 1 : 0) - (a.kind === "小説表紙" ? 1 : 0),
      );
      row.selectedKind = books[0]?.kind;
      row.selectedName = books[0]?.name;
      if (books.length) {
        const c = await browser.newContext({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        });
        const p = await c.newPage();
        await p.route("**/api/search?**", (r) =>
          r.fulfill({ json: { ...d, items: books } }),
        );
        await p.goto(base);
        await p.getByLabel("ランキングのジャンル").selectOption("アニメ");
        await p.getByLabel("画像検索キーワード").fill(q);
        await p
          .getByRole("button", { name: "画像を検索", exact: true })
          .click();
        await p.locator(".result>button").first().click();
        await p
          .getByRole("dialog", { name: "どのランクに追加しますか？" })
          .getByRole("button", { name: "SS", exact: true })
          .click();
        await p
          .locator(".tier-row")
          .first()
          .locator(".tile img")
          .waitFor({ timeout: 40000 });
        row.image = await p
          .locator(".tier-row")
          .first()
          .locator(".tile img")
          .evaluate((i) => i.complete && i.naturalWidth > 0);
        await p.waitForTimeout(700);
        await p.reload();
        await p.locator(".tier-row").first().locator(".tile img").waitFor();
        row.persisted = true;
        await p.screenshot({
          path: "artifacts/book-" + report.length + ".png",
          fullPage: true,
        });
        await p
          .getByRole("button", { name: "画像として保存", exact: true })
          .click();
        const dl = p.waitForEvent("download");
        await p
          .getByRole("button", { name: "PNGを作成・ダウンロード", exact: true })
          .click();
        await (
          await dl
        ).saveAs("artifacts/book-" + report.length + ".png-export.png");
        row.png = true;
        await c.close();
      }
    } catch (e) {
      row.error = e.message;
    }
    report.push(row);
    fs.writeFileSync(
      process.env.REPORT_PATH || "artifacts/book-validation.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(row));
  }
  await browser.close();
})();
