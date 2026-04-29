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
