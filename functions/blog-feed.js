"use strict";

const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { decode } = require("html-entities");

const FEED_URL = "https://rssblog.ameba.jp/lily-1410/rss20.xml";
const parser = new XMLParser({ parseTagValue: false, trimValues: true });

const plainText = (value) => decode(String(value || "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
  .replace(/<[^>]*>/g, " "))
  .replace(/\s+/g, " ").trim();

const articleUrl = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && url.hostname === "ameblo.jp"
      && !url.username && !url.password
      && /^\/lily-1410\/entry-\d+\.html$/.test(url.pathname) ? url.href : "";
  } catch {
    return "";
  }
};

const thumbnailUrl = (html) => {
  const images = String(html || "").matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
  for (const image of images) {
    try {
      const url = new URL(decode(image[1]));
      if (url.protocol === "https:" && url.hostname === "stat.ameba.jp"
        && !url.username && !url.password && url.pathname.startsWith("/user_images/")) return url.href;
    } catch { /* Ignore invalid images. */ }
  }
  return "";
};

const parseBlogFeed = (xml) => {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)
    || XMLValidator.validate(xml) !== true) throw new Error("Invalid RSS");
  const items = parser.parse(xml)?.rss?.channel?.item;
  const seen = new Set();
  const posts = (Array.isArray(items) ? items : items ? [items] : [])
    .map((item) => {
      const timestamp = Date.parse(item.pubDate);
      const link = articleUrl(item.link);
      const title = plainText(item.title);
      if (!title || !link || !Number.isFinite(timestamp)) return null;
      const date = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(timestamp)).replaceAll("/", ".");
      return { title, link, date, timestamp,
        excerpt: plainText(item.description).slice(0, 200),
        thumbnail: thumbnailUrl(item.description) };
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

const createBlogFeedHandler = (fetchFeed = fetch) => async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.set("Allow", "GET, HEAD");
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  try {
    const upstream = await fetchFeed(FEED_URL, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!upstream.ok) throw new Error(`RSS returned ${upstream.status}`);
    const posts = parseBlogFeed(await upstream.text());
    // Cache at Firebase Hosting for five minutes; browsers must revalidate.
    response.set("Cache-Control", "public, max-age=0, s-maxage=300");
    response.status(200).json(posts);
  } catch (error) {
    console.error("blogFeed failed", error.message);
    response.status(502).json({ error: "Blog feed is temporarily unavailable" });
  }
};

module.exports = { parseBlogFeed, createBlogFeedHandler };
