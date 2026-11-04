require("fs").mkdirSync("artifacts", { recursive: true });
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.BASE_URL || "http://localhost:8788");
  await p.getByLabel("ランキングタイトル", { exact: true }).waitFor();
  await p.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("keyval-store");
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    await new Promise((res, rej) => {
      const t = db.transaction("keyval", "readwrite");
      t.objectStore("keyval").put(
        {
          boards: [
            {
              id: "old",
              title: "旧ランキング",
              updated: 100,
              ranks: [{ id: "r", name: "SS", color: "#ff0000", items: [] }],
              pool: [
                {
                  id: "legacy-image",
                  name: "既存の画像",
                  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
                  key: "legacy",
                  source: "",
                  credit: "test",
                },
              ],
            },
          ],
          active: "old",
        },
        "tier-studio-v1",
      );
      t.oncomplete = res;
      t.onerror = rej;
    });
    db.close();
  });
  await p.reload();
  await p.getByLabel("ランキングタイトル", { exact: true }).waitFor();
  if (
    (await p.getByLabel("ランキングタイトル", { exact: true }).inputValue()) !==
    "旧ランキング"
  )
    throw Error("migration lost board");
  await p.getByRole("button", { name: "ジャンルを管理", exact: true }).click();
  await p.getByLabel("新しいジャンル名").fill("好きなグミ");
  await p.getByRole("button", { name: "追加", exact: true }).click();
  await p.getByRole("button", { name: "閉じる", exact: true }).click();
  await p.getByLabel("ランキングのジャンル").selectOption("好きなグミ");
  await p.waitForTimeout(700);
  await p.reload();
  if (
    (await p.getByLabel("ランキングのジャンル").inputValue()) !== "好きなグミ"
  )
    throw Error("genre lost");
  await p.getByRole("button", { name: "マイランキング", exact: true }).click();
  await p
    .getByRole("button", { name: "新しいランキング", exact: true })
    .click();
  await p.getByLabel("作成するランキングのジャンル").selectOption("お菓子");
  await p.getByLabel("新しいランキングのタイトル").fill("ポテチ");
  await p.getByRole("button", { name: "作成する" }).click();
  await p.getByRole("button", { name: "マイランキング", exact: true }).click();
  await p.getByLabel("ジャンルで絞り込み").selectOption("好きなグミ");
  if ((await p.locator(".library-item").count()) !== 1)
    throw Error("filter failed");
  p.once("dialog", (d) => d.accept("お気に入りグミ"));
  await p
    .getByRole("button", { name: "ジャンルを管理", exact: true })
    .last()
    .click();
  await p
    .locator(".genre-list>div")
    .filter({ hasText: "好きなグミ" })
    .getByRole("button")
    .click();
  await p
    .getByRole("dialog", { name: "ジャンルを管理", exact: true })
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  if ((await p.locator(".library-item").count()) !== 1)
    throw Error("rename filter failed");
  await p.getByRole("button", { name: "閉じる", exact: true }).click();
  await p.waitForTimeout(700);
  await p.reload();
  await p.getByRole("button", { name: "マイランキング", exact: true }).click();
  await p.getByLabel("ジャンルで絞り込み").selectOption("お気に入りグミ");
  await p.locator(".library-open").filter({ hasText: "旧ランキング" }).click();
  if (
    (await p.getByLabel("ランキングのジャンル").inputValue()) !==
    "お気に入りグミ"
  )
    throw Error("rename persistence");
  await p.getByLabel("ランキングのジャンル").selectOption("お菓子");
  await p.getByLabel("画像検索キーワード").fill("ハイチュウ");
  await p.getByRole("button", { name: "画像を検索", exact: true }).click();
  await p.locator(".result>button").first().waitFor({ timeout: 60000 });
  await p.locator(".result>button").first().click();
  await p
    .getByRole("dialog", { name: "どのランクに追加しますか？" })
    .getByRole("button", { name: "未分類（未使用画像）", exact: true })
    .click();
  await p.waitForFunction(
    () => document.querySelectorAll(".pool .tile").length === 2,
    { timeout: 40000 },
  );
  await p.waitForTimeout(900);
  await p.reload();
  await p.locator(".pool .tile img").first().waitFor();
  await p.waitForFunction(
    () =>
      [...document.querySelectorAll(".pool .tile img")].length === 2 &&
      [...document.querySelectorAll(".pool .tile img")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
  );
  if (
    !(await p
      .locator(".pool .tile img")
      .evaluateAll(
        (images) =>
          images.length === 2 &&
          images.every((i) => i.complete && i.naturalWidth > 0),
      ))
  )
    throw Error("image lost");
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error("overflow");
  console.log(
    JSON.stringify({
      passed: [
        "v1 migration",
        "custom genre creation",
        "genre change",
        "multiple boards",
        "genre filter",
        "rename genre persistence",
        "real snack image addition",
        "reload image persistence",
        "390px layout",
      ],
      errors,
    }),
  );
  await p.screenshot({ path: "artifacts/genres-mobile.png", fullPage: true });
  await b.close();
})();
