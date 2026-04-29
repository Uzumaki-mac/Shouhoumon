# ト術 奏亨門（BOKUJUTSU SOHOMON）— サイト概要

愛知県刈谷市の占い師・富永祥玲による鑑定室の公式Webサイト。
屋号: **ト術 奏亨門**（ぼくじゅつ そうこうもん）
四柱推命・紫微斗数・六壬神課・九星術・タロット・風水を扱う。

---

## 技術スタック

- **HTML / CSS / JavaScript** のみ（ビルドツール・フレームワーク不使用）
- **Firebase Hosting** でホスティング（プロジェクトID: `shouhoumon-20260424-214632`）
- **本番ドメイン**: https://sohomon.com
- **Google Analytics**: G-FHW9SX5R7J（全ページ導入済み）
- **Google Fonts**: Noto Serif JP（見出し）+ Noto Sans JP（本文）
- **GitHub**: https://github.com/Uzumaki-mac/Shouhoumon
- ブランチ: `main` のみ

### デプロイ

```bash
firebase deploy --only hosting
```

プレビュー（本番に影響せず確認）:

```bash
firebase hosting:channel:deploy preview
```

---

## Firebase Authentication

管理画面へのログイン用に Google サインインを設定済み。

| 項目 | 値 |
|---|---|
| プロバイダ | Google |
| サポートメール | isao5271@gmail.com |
| OAuth 公開名（同意画面に表示） | ト術 奏亨門 |
| 公開ステータス | テスト中（Testing） |

- 公開ステータスは「テスト中」のまま運用。Google による審査不要
- ログインできるのはテストユーザーとして登録されたアカウントのみ
- テストユーザーの追加: Firebase Console → Authentication → Settings → テストユーザー

---

## ファイル構成

```
/
├── index.html              # トップページ
├── profile.html            # プロフィール
├── art.html                # 占術紹介
├── kantei.html             # 鑑定について（料金・免責）
├── reserve.html            # 鑑定申込みフォーム
├── access.html             # アクセス（刈谷市）
├── beginner.html           # はじめての方へ
├── blog.html               # ブログ一覧
├── privacy.html            # 個人情報の取り扱い
├── kouza.html              # 占術講座 一覧
├── kouza-contact.html      # 講座 お問い合わせ
├── kouza-rikujin.html      # 六壬講座
├── kouza-shichusuimei.html # 四柱推命講座
├── kouza-tarot.html        # タロット講座
├── assets/
│   ├── css/styles.css      # 単一スタイルシート（CSS変数でトークン管理）
│   ├── js/main.js          # ヘッダー / スクロール / reveal アニメ / フォーム
│   └── images/
│       ├── photos/         # 写真（hero-tarot-candle-wide.png 等）
│       ├── illustrations/
│       │   └── icons/      # 占術アイコン（icon-*.png 各占術分）
│       ├── courses/        # 講座ページ用ビジュアル
│       ├── access/         # アクセスページ用写真
│       ├── calligraphy/    # 書道サイン画像（calligraphy-shorei.png）
│       ├── social/         # SNSロゴ（instagram.png / line.png）
│       └── references/     # 参照用（デザインシステム・サイト参照）
├── Design.md               # デザイン仕様書（カラー・タイポ・コピー全記載）
└── firebase.json           # Hosting 設定（noindex ヘッダー等）
```

---

## デザイントークン（CSS変数）

| 変数 | 値 | 用途 |
|---|---|---|
| `--color-off-white` | `#FAF7F2` | ページ背景 |
| `--color-cream` | `#F3ECE3` | セクション背景 `.section--cream` |
| `--color-gold` | `#E6BA7A` | プライマリボタン・CTA（使用を絞る） |
| `--color-dark-gold` | `#B79A7A` | ボタンホバー・アイコン線 |
| `--color-text` | `#8D8176` | 本文 |
| `--color-heading` | `#5F554D` | 見出し |
| `--font-serif` | Noto Serif JP | 見出し（H1〜H2） |
| `--font-sans` | Noto Sans JP | 本文・キャプション |
| `--container` | `1160px` | 最大幅 |
| `--section-space` | `clamp(72px, 9vw, 120px)` | セクション間余白 |

---

## ボタン種別

| クラス | 見た目 | 用途 |
|---|---|---|
| `.btn--primary` | 背景 `--color-gold`、白文字、pill形 | メインCTA「鑑定を申し込む」 |
| `.btn--secondary` | 背景 `--color-light-beige`、ダークテキスト | 「はじめての方へ」等 |
| `.btn--ghost` | 背景なし、ボーダー付き | 「鑑定メニューを見る」等 |

---

## 主要コンポーネント

| クラス | 用途 |
|---|---|
| `.method-card` | 占術紹介カード（アイコン + 説明文） |
| `.section-switcher` | ページ内タブナビ（例: 占術紹介 ↔ 講座案内） |
| `.concern-guide` | お悩み別おすすめ占術の対応表 |
| `.pillar-table` | 四柱推命の命式グリッド表示 |
| `.kyusei-grid` | 九星術の魔方陣グリッド |
| `.course-teaser` | 講座ページへの誘導バナー（画像 + テキスト） |
| `.reveal` | スクロールフェードイン対象（JS で `.is-visible` を付与） |
| `.soft-card` | 番号付きカード（ホームの3ステップ等） |
| `.cta-band` | 幅広CTAバナー（各ページ末尾） |
| `.notice-strip` | お知らせ帯（ホーム上部） |
| `.signature-image` | 書道サイン画像（`calligraphy-shorei.png`、`clamp(184px, 24vw, 328px)`） |
| `.home-blog-preview` | ホームのブログ一覧プレビュー（画像非表示・リスト形式） |

---

## アニメーション

- `.reveal` クラスを付けた要素を `IntersectionObserver` で監視し `.is-visible` を付与
- フェードイン (`opacity` + `translateY`) のみ。`0.6s ease`
- JS非対応環境では `.is-visible` を一括付与してフォールバック

---

## SNS / 外部リンク

| サービス | URL |
|---|---|
| Instagram | https://www.instagram.com/forever_field26 |
| LINE公式 | https://lin.ee/yJiMHfJ |
| Amebaブログ | https://ameblo.jp/lily-1410/ |
| 著書（Amazon） | https://www.amazon.co.jp/dp/4906828248/ |

外部リンクはすべて `target="_blank" rel="noopener noreferrer"` 必須。

---

## 占術別・お悩み対応表

| お悩み | 対応占術 |
|---|---|
| 仕事・適職 | 四柱推命 / 紫微斗数 / 六壬神課 |
| 結婚・相性 | 四柱推命 / 六壬神課 / タロット |
| 今すぐの判断 | 六壬神課 / タロット |
| 住まい・方位 | 風水 / 九星術 |
| 人生全体の流れ | 四柱推命 / 紫微斗数 |

---

## デザイン原則（Design.md より抜粋）

1. **余白を贅沢に** — 詰め込まず「間」で上品さを出す
2. **ゴールドは節約** — `--color-gold` はプライマリCTAのみ。乱用しない
3. **写真は右寄り / 下寄り** — テキストが左上に来るレイアウトを基本とする
4. **アニメーションは控えめに** — フェードイン一種類のみ
5. **Noto Serif JP で物語性を** — 見出しはセリフ体で品格と温かみを両立

---

## 注意事項

- `firebase.json` の `X-Robots-Tag: noindex` は削除済み（本番公開済み）。`admin.html` のみ `<meta name="robots" content="noindex">` を個別に設定
- Cloud Functions `submitForm`（asia-northeast1 / Node.js 22）はデプロイ済み・稼働中
- Firebase Secrets `ADMIN_EMAIL` / `SMTP_USER` / `SMTP_PASS` は富永さんのGmail（`ShoreiTominaga@gmail.com`）に更新済み（2026-04-29）。フォームテスト送信で動作確認すること
- フォームの `main.js` 内モックハンドラは Functions 接続後に削除予定
- 屋号変更: 旧「富永祥玲の鑑定室 / SHOREI TOMINAGA FORTUNE TELLING ROOM」→ 新「ト術 奏亨門 / BOKUJUTSU SOHOMON」（全ページ適用済み）
- 署名はテキスト `<p class="signature">` から書道画像 `<img class="signature-image">` に変更済み
- カスタムドメイン `sohomon.com` を Firebase Hosting に設定済み（2026-04-29）
- OGP/Twitter 画像は絶対URL（`https://sohomon.com/assets/images/...`）で記述すること
- `sitemap.xml` / `robots.txt` を追加済み（URLは `sohomon.com` ベース）
- 管理ダッシュボード（`admin.html`）から申込みの一括選択・削除が可能（Firestore rules で管理者のみ delete 許可）
- 管理画面の許可アカウント（`admin.js` の `ADMIN_EMAILS`）: `isao5271@gmail.com`（永田）・`ShoreiTominaga@gmail.com`（富永）の2件
- 富永さんのGmail: `ShoreiTominaga@gmail.com`（OAuthテストユーザー登録済み・2026-04-29）
- 管理ダッシュボードに「カスタム期間」フィルター追加済み（開始日〜終了日の任意指定）
