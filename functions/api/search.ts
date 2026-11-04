interface Context {
  request: Request;
}
export async function onRequestGet({ request }: Context) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 120);
  if (!q)
    return Response.json(
      { error: "検索語を入力してください" },
      { status: 400 },
    );
  try {
    if (url.searchParams.get("type") === "anime") {
      try {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query:
              "query ($q: String) { Page(perPage: 24) { media(search: $q, type: ANIME, isAdult: false) { id title { romaji native } coverImage { large } siteUrl } } }",
            variables: { q },
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw Error("AniList が応答しませんでした");
        const data: any = await response.json();
        if (data.errors) throw Error("検索に失敗しました");
        return Response.json({
          provider: "AniList",
          items: data.data.Page.media.map((m: any) => ({
            key: `anilist:${m.id}`,
            name: m.title.native || m.title.romaji,
            url: m.coverImage.large,
            source: m.siteUrl,
            credit: "AniList · 作品画像の権利は各権利者に帰属",
          })),
        });
      } catch {
        const api = new URL("https://kitsu.io/api/edge/anime");
        api.searchParams.set("filter[text]", q);
        api.searchParams.set("page[limit]", "20");
        const fallback = await fetch(api, {
          headers: { Accept: "application/vnd.api+json" },
          signal: AbortSignal.timeout(15000),
        });
        if (!fallback.ok)
          throw Error(
            "アニメ検索サービスに接続できません。別のジャンルかアップロードをお試しください",
          );
        const data: any = await fallback.json();
        return Response.json({
          provider: "Kitsu",
          items: (data.data || [])
            .filter((m: any) => m.attributes?.posterImage && !m.attributes.nsfw)
            .map((m: any) => ({
              key: `kitsu:${m.id}`,
              name: m.attributes.titles?.ja_jp || m.attributes.canonicalTitle,
              url:
                m.attributes.posterImage.medium ||
                m.attributes.posterImage.small,
              source: `https://kitsu.app/anime/${m.attributes.slug}`,
              credit: "Kitsu · 作品画像の権利は各権利者に帰属",
            })),
        });
      }
    }
    const api = new URL("https://commons.wikimedia.org/w/api.php");
    Object.entries({
      action: "query",
      format: "json",
      generator: "search",
      gsrsearch: `${q} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: "24",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "400",
    }).forEach(([k, v]) => api.searchParams.set(k, v));
    const response = await fetch(api, {
      headers: { "User-Agent": "TierStudio/1.0 (image ranking application)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Wikimedia が応答しませんでした");
    const data: any = await response.json();
    const clean = (s: string = "") => s.replace(/<[^>]*>/g, "").slice(0, 1000);
    return Response.json({
      provider: "Wikimedia Commons",
      items: Object.values(data.query?.pages || {}).flatMap((p: any) => {
        const i = p.imageinfo?.[0];
        if (!i || !i.extmetadata?.LicenseShortName?.value) return [];
        return [
          {
            key: `commons:${p.pageid}`,
            name: p.title.replace("File:", "").replace(/\.[^.]+$/, ""),
            url: i.thumburl || i.url,
            source: i.descriptionurl,
            credit: [
              clean(i.extmetadata.Artist?.value),
              clean(i.extmetadata.LicenseShortName?.value),
              clean(i.extmetadata.LicenseUrl?.value),
              "サムネイル化・トリミングあり",
              clean(i.extmetadata.Attribution?.value),
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ];
      }),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "検索に失敗しました" },
      { status: 502 },
    );
  }
}
