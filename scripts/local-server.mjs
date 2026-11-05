// Local adapter for Pages Functions. Routes outgoing fetch through the managed
// environment's proxy; production Cloudflare Pages runs functions/ directly.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { onRequestGet as search } from "../functions/api/search.ts";
import { onRequestGet as image } from "../functions/api/image.ts";
setGlobalDispatcher(new EnvHttpProxyAgent());
const root = resolve("dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const port = Number(process.env.PORT || 8788);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    if (url.pathname === "/api/search" || url.pathname === "/api/image") {
      const response = await (url.pathname === "/api/search" ? search : image)({
        request: new Request(url),
        env: {
          GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY,
          TMDB_API_KEY: process.env.TMDB_API_KEY,
          RAWG_API_KEY: process.env.RAWG_API_KEY,
          ANIME_BLOCKED_SOURCES: process.env.ANIME_BLOCKED_SOURCES,
          ANIME_REQUIRE_PERMISSION: process.env.ANIME_REQUIRE_PERMISSION,
        },
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    let path = resolve(root, "." + pathname);
    if (!path.startsWith(root + "/")) {
      res.writeHead(403);
      res.end();
      return;
    }
    let content;
    try {
      content = await readFile(path);
    } catch {
      if (extname(path)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      path = resolve(root, "index.html");
      content = await readFile(path);
    }
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(500);
    res.end("Local server error");
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`Tier Studio local adapter running on port ${port}`),
);
