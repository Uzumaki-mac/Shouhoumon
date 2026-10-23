"use strict";

const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { decode } = require("html-entities");

const SOURCES = {
  ameblo: {
    feed: "https://rssblog.ameba.jp/lily-1410/rss20.xml",
    host: "ameblo.jp",
    articlePath: /^\/lily-1410\/entry-\d+\.html$/,
    imageHost: "stat.ameba.jp",
    imagePath: "/user_images/",
  },
  note: {
    feed: "https://note.com/magic_auklet8531/rss",
    host: "note.com",
    articlePath: /^\/magic_auklet8531\/n\/n[a-f0-9]+$/,
    imageHost: "assets.st-note.com",
    imagePath: "/",
  },
};
const parser = new XMLParser({ parseTagValue: false, trimValues: true, ignoreAttributes: false });

const plainText = (value) => decode(String(value || "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
  .replace(/<[^>]*>/g, " "))
  .replace(/\s+/g, " ").trim();

const articleUrl = (value, source) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && url.hostname === source.host
      && !url.username && !url.password && !url.port
      && source.articlePath.test(url.pathname) ? url.href : "";
  } catch {
    return "";
  }
};

const thumbnailUrl = (item, source) => {
  const media = item["media:thumbnail"];
  const images = [
    typeof media === "string" ? media : media?.["@_url"] || media?.["#text"],
    ...Array.from(String(item.description || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi), (match) => match[1]),
  ];
  for (const image of images.filter(Boolean)) {
    try {
      const url = new URL(decode(image));
      if (url.protocol === "https:" && url.hostname === source.imageHost
        && !url.username && !url.password && !url.port && url.pathname.startsWith(source.imagePath)) return url.href;
    } catch { /* Ignore invalid images. */ }
  }
  return "";
};

const parseBlogFeed = (xml, sourceName = "ameblo") => {
  const source = SOURCES[sourceName];
  if (!source) throw new Error("Unknown feed source");
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)
    || XMLValidator.validate(xml) !== true) throw new Error("Invalid RSS");
  const items = parser.parse(xml)?.rss?.channel?.item;
  const seen = new Set();
  const posts = (Array.isArray(items) ? items : items ? [items] : [])
    .map((item) => {
      const timestamp = Date.parse(item.pubDate);
      const link = articleUrl(item.link, source);
      const title = plainText(item.title);
      if (!title || !link || !Number.isFinite(timestamp)) return null;
      const date = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(timestamp)).replaceAll("/", ".");
      return { title, link, date, timestamp,
        excerpt: plainText(item.description).replace(/続きをみる\s*$/, "").trim().slice(0, 200),
        thumbnail: thumbnailUrl(item, source) };
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((post) => {
      if (seen.has(post.link)) return false;
      seen.add(post.link);
      return true;
    })
    .slice(0, 3)
    .map(({ timestamp, ...post }) => post);
  if (!posts.length) throw new Error("RSS contains no valid articles");
  return posts;
};

const createBlogFeedHandler = (fetchFeed = fetch, sourceName = "ameblo") => async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.set("Allow", "GET, HEAD");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  try {
    const upstream = await fetchFeed(SOURCES[sourceName].feed, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!upstream.ok) throw new Error(`RSS returned ${upstream.status}`);
    const posts = parseBlogFeed(await upstream.text(), sourceName);
    // Cache at Firebase Hosting for five minutes; browsers must revalidate.
    response.set("Cache-Control", "public, max-age=0, s-maxage=300");
    response.status(200).json(posts);
  } catch (error) {
    console.error(`${sourceName} feed failed`, error.message);
    response.status(502).json({ error: "Blog feed is temporarily unavailable" });
  }
};

const createNoteFeedHandler = (fetchFeed = fetch) => createBlogFeedHandler(fetchFeed, "note");
module.exports = { parseBlogFeed, createBlogFeedHandler, createNoteFeedHandler };
