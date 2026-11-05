export type ArtworkEnv = {
  GOOGLE_BOOKS_API_KEY?: string;
  ANIME_BLOCKED_SOURCES?: string;
  ANIME_REQUIRE_PERMISSION?: string;
  TMDB_API_KEY?: string;
  RAWG_API_KEY?: string;
};
export const unwanted = (i: {
  name?: string;
  credit?: string;
  topics?: string;
}) =>
  /fan[ _-]?fiction|unofficial|同人|非公式|ai[ _-]?generated|AI生成|非公式イラスト|cosplay|cosplayer|fan[ _-]?art|live[ _-]?action|コスプレ|ファンアート|実写版|実写化|俳優写真/i.test(
    [i.name, i.credit, i.topics].join(" "),
  );
export async function catalog(q: string, type: string, env: ArtworkEnv) {
  if (type === "games") {
    if (!env.RAWG_API_KEY)
      return {
        items: [],
        warning:
          "適切な画像が見つかりません。現在ゲーム作品画像の検索を利用できません。",
      };
    const u = new URL("https://api.rawg.io/api/games");
    u.searchParams.set("key", env.RAWG_API_KEY);
    u.searchParams.set("search", q);
    u.searchParams.set("page_size", "24");
    const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw Error("ゲーム作品検索に接続できませんでした");
    const d: any = await r.json();
    return {
      items: (d.results || [])
        .filter((g: any) => g.background_image)
        .map((g: any) => ({
          key: `rawg:${g.id}`,
          name: g.name,
          url: g.background_image,
          source: `https://rawg.io/games/${g.slug}`,
          credit:
            "RAWG掲載の作品画像 · 権利は各権利者に帰属（公式性を独立検証した画像ではありません）",
          artwork: "作品データベースの画像",
        })),
    };
  }
  if (type === "movies") {
    if (!env.TMDB_API_KEY)
      return {
        items: [],
        warning:
          "適切な画像が見つかりません。現在映画ポスター検索を利用できません。",
      };
    const u = new URL("https://api.themoviedb.org/3/search/movie");
    u.searchParams.set("api_key", env.TMDB_API_KEY);
    u.searchParams.set("query", q);
    u.searchParams.set("language", "ja-JP");
    u.searchParams.set("include_adult", "false");
    const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw Error("映画作品検索に接続できませんでした");
    const d: any = await r.json();
    return {
      items: (d.results || [])
        .filter((m: any) => m.poster_path)
        .map((m: any) => ({
          key: `tmdb:${m.id}`,
          name: m.title,
          url: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
          source: `https://www.themoviedb.org/movie/${m.id}`,
          credit:
            "TMDB掲載の作品ポスター · This product uses the TMDB API but is not endorsed or certified by TMDB. 権利は各権利者に帰属",
          artwork: "作品データベースのポスター",
        })),
    };
  }
  if (type === "characters") {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query:
          "query($q:String){Page(perPage:24){characters(search:$q){id name{native full} image{large} siteUrl}}}",
        variables: { q },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw Error("キャラクター検索に接続できませんでした");
    const d: any = await r.json();
    if (d.errors) throw Error("キャラクター検索に接続できませんでした");
    return {
      items: (d.data?.Page?.characters || [])
        .filter((c: any) => c.image?.large)
        .map((c: any) => ({
          key: `anilist-character:${c.id}`,
          name: c.name.native || c.name.full,
          url: c.image.large,
          source: c.siteUrl,
          credit:
            "AniList掲載のキャラクター画像 · 権利は各権利者に帰属（公式性を独立検証した画像ではありません）",
          artwork: "キャラクターデータベースの画像",
        })),
    };
  }
  return { items: [] };
}
