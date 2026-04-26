# 富永祥玲の鑑定室 — サイト概要

愛知県刈谷市の占い師・富永祥玲による鑑定室の公式Webサイト。
四柱推命・紫微斗数・六壬神課・九星術・手相・タロット・風水を扱う。

---

## 技術スタック

- **HTML / CSS / JavaScript** のみ（ビルドツール・フレームワーク不使用）
- **Firebase Hosting** でホスティング（プロジェクトID: `shouhoumon-20260424-214632`）
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

## ファイル構成

```
/
├── index.html          # トップページ
├── profile.html        # プロフィール
├── art.html            # 占術紹介
├── kantei.html         # 鑑定について（料金・免責）
├── reserve.html        # 鑑定申込みフォーム
├── access.html         # アクセス
├── assets/
│   ├── css/styles.css  # 単一スタイルシート（CSS変数でトークン管理）
│   ├── js/main.js      # ヘッダー / スクロール / reveal アニメ / フォーム
│   └── images/
│       ├── photos/     # 写真（hero-tarot-candle-wide.png 等）
│       ├── illustrations/
│       │   └── icons/  # 占術アイコン（icon-shichu-suimei.png 等）
│       └── social/     # SNSロゴ
├── Design.md           # デザイン仕様書（カラー・タイポ・コピー全記載）
└── firebase.json       # Hosting 設定（noindex ヘッダー等）
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

## アニメーション

- `.reveal` クラスを付けた要素を `IntersectionObserver` で監視し、`.is-visible` を付与
- フェードイン (`opacity` + `translateY`) のみ。`0.6s ease`
- JS非対応環境では `is-visible` を一括付与してフォールバック

---

## デザイン原則（Design.md より抜粋）

1. **余白を贅沢に** — 詰め込まず「間」で上品さを出す
2. **ゴールドは節約** — `--color-gold` はプライマリCTAのみ。乱用しない
3. **写真は右寄り / 下寄り** — テキストが左上に来るレイアウトを基本とする
4. **アニメーションは控えめに** — フェードイン一種類のみ
5. **Noto Serif JP で物語性を** — 見出しはセリフ体で品格と温かみを両立

---

## 注意事項

- `firebase.json` で全ページに `X-Robots-Tag: noindex, nofollow, noarchive` を付与中（制作中のため）。本番公開時は削除すること
- フォーム送信はモック状態（`main.js` の `bookingForm` ハンドラ）。公開前にバックエンド（メール送信等）を接続すること
- 外部リンク（Amazon著書・Amebaブログ）は `target="_blank" rel="noopener noreferrer"` 必須
