// Image fetcher: every redirect destination is validated against the same allowlist.
export async function onRequestGet({ request }: { request: Request }) {
  try {
    const raw = new URL(request.url).searchParams.get("url") || "";
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      ![
        "upload.wikimedia.org",
        "thumb.wikimedia.org",
        "s4.anilist.co",
        "media.kitsu.app",
        "media.kitsu.io",
        "images.openfoodfacts.org",
        "image.tmdb.org",
        "media.rawg.io",
        "cdn.myanimelist.net",
        "covers.openlibrary.org",
        "books.google.com",
        "books.google.co.jp",
        "books.googleusercontent.com",
        "lh3.googleusercontent.com",
        "cover.openbd.jp",
      ].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return new Response(
        "対応していない画像URLです。端末からアップロードしてください。",
        { status: 400 },
      );
    const deadline = AbortSignal.timeout(12000);
    let current = url;
    let r: Response | undefined;
    const libraryOrigin = url.hostname === "covers.openlibrary.org";
    const archiveCover = (u: URL) =>
      libraryOrigin &&
      ((u.hostname === "archive.org" &&
        /^\/download\/[lms]_covers_\d+\/[lms]_covers_\d+_\d+\.zip\/\d+-[LMS]\.jpg$/i.test(
          u.pathname,
        )) ||
        (/^ia\d+\.us\.archive\.org$/.test(u.hostname) &&
          u.pathname === "/view_archive.php" &&
          /^\/\d+\/items\/[lms]_covers_\d+\/[lms]_covers_\d+_\d+\.zip$/i.test(
            u.searchParams.get("archive") || "",
          ) &&
          /^\d+-[LMS]\.jpg$/i.test(u.searchParams.get("file") || "")));
    const allowed = (u: URL) =>
      u.protocol === "https:" &&
      !u.port &&
      !u.username &&
      !u.password &&
      (archiveCover(u) ||
        [
          "upload.wikimedia.org",
          "thumb.wikimedia.org",
          "s4.anilist.co",
          "media.kitsu.app",
          "media.kitsu.io",
          "images.openfoodfacts.org",
          "image.tmdb.org",
          "media.rawg.io",
          "cdn.myanimelist.net",
          "covers.openlibrary.org",
          "books.google.com",
          "books.google.co.jp",
          "books.googleusercontent.com",
          "lh3.googleusercontent.com",
          "cover.openbd.jp",
        ].includes(u.hostname));
    for (let hop = 0; hop < 4; hop++) {
      if (!allowed(current))
        return new Response("許可されていない画像配信先です", { status: 400 });
      r = await fetch(current, {
        redirect: "manual",
        signal: deadline,
        headers: {
          "User-Agent": "TierStudio/2.0 (https://github.com/sutunu/ranking)",
          Accept: "image/avif,image/webp,image/*",
        },
      });
      if (r.status >= 300 && r.status < 400 && r.headers.has("location")) {
        current = new URL(r.headers.get("location")!, current);
        continue;
      }
      break;
    }
    if (!r) return new Response("画像配信先に接続できません", { status: 502 });
    const type =
      r.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
    if (
      !r.ok ||
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
      ].includes(type)
    )
      return new Response("画像を取得できません", { status: 502 });
    if (Number(r.headers.get("content-length")) > 15 * 1024 * 1024)
      return new Response("画像が大きすぎます", { status: 413 });
    const reader = r.body!.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 15 * 1024 * 1024) {
        await reader.cancel();
        return new Response("画像が大きすぎます", { status: 413 });
      }
      chunks.push(value);
    }
    return new Response(new Blob(chunks as BlobPart[], { type }), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("画像を取得できませんでした", { status: 502 });
  }
}
