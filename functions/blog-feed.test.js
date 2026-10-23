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

const { createNoteFeedHandler } = require("./blog-feed");
const noteItem = (id, date, extra = "") => `<item>
  <title>noteの記事</title><link>https://note.com/magic_auklet8531/n/n${id}</link>
  <pubDate>${date}</pubDate><description><![CDATA[<p>本文 &amp; 気づき</p><a href="https://note.com/">続きをみる</a>]]></description>
  <note:creatorImage>https://assets.st-note.com/profile.jpg</note:creatorImage>${extra}
</item>`;
const noteRss = (items) => `<rss xmlns:note="https://note.com" xmlns:media="http://search.yahoo.com/mrss/"><channel>${items}</channel></rss>`;
const noteFixture = noteRss(noteItem('123abc', '2026-10-12T01:14:49Z'));

test("note parses CDATA and Japanese dates without treating the avatar as an article image", () => {
  const [post] = parseBlogFeed(noteFixture, "note");
  assert.equal(post.link, "https://note.com/magic_auklet8531/n/n123abc");
  assert.equal(post.date, "2026.10.12");
  assert.equal(post.excerpt, "本文 & 気づき");
  assert.equal(post.thumbnail, "");
});

test("note supports media thumbnail text and attributes; ignores untrusted media", () => {
  for (const media of ['<media:thumbnail>https://assets.st-note.com/article.jpg</media:thumbnail>', '<media:thumbnail url="https://assets.st-note.com/article.jpg"/>']) {
    assert.equal(parseBlogFeed(noteRss(noteItem('1', '2026-10-12', media)), "note")[0].thumbnail, "https://assets.st-note.com/article.jpg");
  }
  assert.equal(parseBlogFeed(noteRss(noteItem('1', '2026-10-12', '<media:thumbnail>https://evil.example/a.jpg</media:thumbnail>')), "note")[0].thumbnail, "");
});

test("note sorts, deduplicates and caps at three; excludes other authors", () => {
  const xml = noteRss([1,4,2,3,4].map(id => noteItem(id, `2026-10-0${id}`)).join('')
    + noteItem('5', '2026-10-05').replace('/magic_auklet8531/', '/another_author/'));
  assert.deepEqual(parseBlogFeed(xml, "note").map(p => p.date), ["2026.10.04", "2026.10.03", "2026.10.02"]);
  assert.throws(() => parseBlogFeed(noteFixture));
  assert.throws(() => parseBlogFeed(noteFixture.replace('https://note.com/magic_', 'javascript://note.com/magic_'), "note"));
});

test("note endpoint fetches only its configured RSS and caches successes", async () => {
  const res = response();
  await createNoteFeedHandler(async (url) => {
    assert.equal(url, "https://note.com/magic_auklet8531/rss");
    return { ok: true, text: async () => noteFixture };
  })({ method: "GET", query: { url: "https://evil.example" } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.headers["Cache-Control"], "public, max-age=0, s-maxage=300");
});

test("note failures are independent and uncached; write methods never fetch", async () => {
  const res = response();
  await createNoteFeedHandler(async () => { throw new Error("timeout"); })({ method: "GET" }, res);
  assert.equal(res.code, 502);
  assert.equal(res.headers["Cache-Control"], "no-store");
  const rejected = response();
  await createNoteFeedHandler(() => assert.fail("unexpected fetch"))({ method: "POST" }, rejected);
  assert.equal(rejected.code, 405);
});
