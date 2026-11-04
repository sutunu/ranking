const { chromium } = require("@playwright/test");
const fs = require("fs");
fs.mkdirSync("artifacts", { recursive: true });
const cases = [
  ["葬送のフリーレン", "フリーレン"],
  ["デッドデッドデーモンズデデデデデストラクション", "デデデデ"],
  ["暗殺教室", "Assassination Classroom"],
  ["進撃の巨人", "進撃"],
  ["鋼の錬金術師", "ハガレン"],
  ["STEINS;GATE", "Steins Gate"],
  ["ヴァイオレット・エヴァーガーデン", "Violet Evergarden"],
  ["新世紀エヴァンゲリオン", "Neon Genesis Evangelion"],
  ["HUNTER×HUNTER", "Hunter x Hunter"],
  ["魔法少女まどか☆マギカ", "まどかマギカ"],
];
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const base = process.env.BASE_URL || "http://localhost:8794",
    report = [];
  for (const [title, alias] of cases.filter(
    (c) =>
      !process.env.CASE_FILTER ||
      process.env.CASE_FILTER.split("|").includes(c[0]),
  )) {
    const row = { title, alias };
    try {
      const response = await fetch(
        base + "/api/search?type=anime&q=" + encodeURIComponent(title),
      );
      const d = await response.json();
      row.search = d.items.length;
      row.diagnostics = d.diagnostics;
      row.top = d.items[0]?.name;
      row.source = d.items[0]?.source;
      row.rights = d.items[0]?.rights;
      if (d.items.length) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        });
        const p = await context.newPage();
        await p.route("**/api/search?**", (r) => r.fulfill({ json: d }));
        await p.goto(base);
        await p.getByLabel("ランキングのジャンル").selectOption("アニメ");
        await p.getByLabel("画像検索キーワード").fill(title);
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
        row.added = row.image;
        await p.waitForTimeout(700);
        await p.reload();
        await p.locator(".tier-row").first().locator(".tile img").waitFor();
        row.persisted =
          (await p
            .locator(".tier-row")
            .first()
            .locator(".tile img")
            .count()) === 1;
        await context.close();
      }
      const a = await (
        await fetch(
          base + "/api/search?type=anime&q=" + encodeURIComponent(alias),
        )
      ).json();
      row.aliasResults = a.items.length;
      row.aliasTop = a.items[0]?.name;
    } catch (e) {
      row.error = e.message;
    }
    report.push(row);
    fs.writeFileSync(
      process.env.REPORT_PATH || "artifacts/anime-matrix.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(row));
  }
  await browser.close();
})();
