"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseBlogFeed, createBlogFeedHandler } = require("./blog-feed");

const item = (id, date, description = "本文", title = "記事") => `<item>
  <title>${title}</title><link>https://ameblo.jp/lily-1410/entry-${id}.html</link>
  <pubDate>${date}</pubDate><description><![CDATA[${description}]]></description>
</item>`;
const rss = (items) => `<rss version="2.0"><channel>${items}</channel></rss>`;
const fixture = rss(item(1, "2026-10-08T17:26:07+09:00"));
const response = () => ({
  headers: {}, code: null, body: null,
  set(key, value) { this.headers[key] = value; return this; },
  status(value) { this.code = value; return this; },
  json(value) { this.body = value; return this; },
});

test("handles singleton RSS, CDATA, entities, Japanese dates and article images", () => {
  const [post] = parseBlogFeed(rss(item(1, "2026-10-08T18:26:07Z",
    '<p>A &amp; B</p><p>次の行&nbsp;です</p><img src="https://stat.ameba.jp/user_images/test.jpg">',
    "講座 &amp; お知らせ")));
  assert.equal(post.date, "2026.10.09");
  assert.equal(post.title, "講座 & お知らせ");
  assert.equal(post.excerpt, "A & B 次の行 です");
  assert.equal(post.thumbnail, "https://stat.ameba.jp/user_images/test.jpg");
});

test("returns newest three unique valid posts, excluding ads and invalid dates", () => {
  const xml = rss([1, 4, 2, 3, 4].map((id) => item(id, `2026-10-0${id}T12:00:00+09:00`)).join("")
    + item(5, "bad-date")
    + item(6, "2026-10-06").replace("https://ameblo.jp/lily-1410/", "https://example.com/"));
  assert.deepEqual(parseBlogFeed(xml).map((p) => p.date), ["2026.10.04", "2026.10.03", "2026.10.02"]);
});

test("ignores untrusted images and rejects unsafe article URLs", () => {
  assert.equal(parseBlogFeed(rss(item(1, "2026-10-08", '<img src="javascript:alert(1)">')))[0].thumbnail, "");
  assert.throws(() => parseBlogFeed(fixture.replace("https://ameblo.jp/", "javascript://ameblo.jp/")));
});

test("rejects malformed, empty and DTD-bearing responses", () => {
  for (const xml of ["<rss>", "<html>unavailable</html>", rss(""), '<!DOCTYPE rss [<!ENTITY x "bad">]>' + fixture]) {
    assert.throws(() => parseBlogFeed(xml));
  }
});

test("GET and HEAD return articles with a five-minute shared cache", async () => {
  for (const method of ["GET", "HEAD"]) {
    const res = response();
    const handler = createBlogFeedHandler(async (url, options) => {
      assert.equal(url, "https://rssblog.ameba.jp/lily-1410/rss20.xml");
      assert.ok(options.signal);
      return { ok: true, text: async () => fixture };
    });
    await handler({ method }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body[0].title, "記事");
    assert.equal(res.headers["Cache-Control"], "public, max-age=0, s-maxage=300");
  }
});

test("upstream failure, timeout and bad XML return uncached 502", async () => {
  for (const fetchFeed of [
    async () => ({ ok: false, status: 503 }),
    async () => { throw new Error("timeout"); },
    async () => ({ ok: true, text: async () => "<html>error</html>" }),
  ]) {
    const res = response();
    await createBlogFeedHandler(fetchFeed)({ method: "GET" }, res);
    assert.equal(res.code, 502);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.ok(!Array.isArray(res.body));
  }
});

test("rejects POST without contacting Ameblo", async () => {
  const res = response();
  await createBlogFeedHandler(() => assert.fail("unexpected fetch"))({ method: "POST" }, res);
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, "GET, HEAD");
});
