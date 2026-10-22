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

## Automatic Ameblo feed

`GET /api/blog-feed` routes to the public `blogFeed` function in `asia-northeast1`.
It reads `https://rssblog.ameba.jp/lily-1410/rss20.xml` and returns the three newest
valid articles with Japan-local dates, plain-text excerpts and optional images.
Firebase Hosting caches successful responses for five minutes. New posts appear
after Ameblo updates its RSS and that cache expires; no scheduled job is needed.
Failures are not cached and the pages show a link to Ameblo instead of stale posts.
The old `assets/data/ameblo-feed.json` is no longer used.

Validate locally: `npm test` and `npm run lint`.

Deploy the new function first, then Hosting:

```sh
firebase deploy --only functions:blogFeed
firebase deploy --only hosting
```

Review any other local Hosting changes before publishing. There is no need to
deploy Firestore rules or the existing `submitForm` function for this change.
