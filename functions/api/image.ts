// Restricted image fetcher: redirects and arbitrary destinations are deliberately disallowed.
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
      ].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    )
      return new Response(
        "対応していない画像URLです。端末からアップロードしてください。",
        { status: 400 },
      );
    const r = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "TierStudio/1.0" },
    });
    const type = r.headers.get("content-type")?.split(";")[0] || "";
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
