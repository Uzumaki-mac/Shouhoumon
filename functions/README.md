# Firebase Functions setup

This project uses Firebase Functions secrets for mail delivery and admin notifications.

Set the secrets before deploying:

```sh
firebase functions:secrets:set ADMIN_EMAIL
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set MAIL_FROM
```

Deploy:

```sh
firebase deploy --only functions,hosting,firestore:rules
```

Local `.env` files are ignored by Git. Do not commit Gmail accounts, app passwords, or notification addresses.

## Automatic Ameblo and note feeds

- `GET /api/blog-feed` → `blogFeed`: `https://rssblog.ameba.jp/lily-1410/rss20.xml`
- `GET /api/note-feed` → `noteFeed`: `https://note.com/magic_auklet8531/rss`

Both public functions run in `asia-northeast1` and share `blog-feed.js`. Each returns
up to three newest valid articles with Japan-local dates, plain-text excerpts and
optional images. Feed URLs and allowed author paths are fixed in server code.
Firebase Hosting caches successful responses for five minutes. New posts appear
after the provider updates its RSS and that cache expires; no scheduled job is needed.
Failures are not cached. Each page section independently shows a link to its service.
The old `assets/data/ameblo-feed.json` is no longer used.

The homepage continues to show Ameblo only. The blog page shows Ameblo first, then
note. A two-item note feed includes a profile card; three articles replace that card.
Missing note thumbnails use decorative site images rather than the author avatar.

Validate locally: `npm test` and `npm run lint`.

Deploy the RSS functions first, verify their responses, then publish Hosting:

```sh
firebase deploy --only functions:blogFeed,functions:noteFeed
firebase deploy --only hosting
```

Review any other local Hosting changes before publishing. There is no need to
deploy Firestore rules or the existing `submitForm` function for a feed-only change.
Do not publish the local Python preview server, RSS snapshots, comparison page,
or its noindex/analytics-free HTML as production files.
