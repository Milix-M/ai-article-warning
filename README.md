# 🤖 AI Article Warning

ZennやQiitaでAI執筆っぽい記事を検出して警告するブラウザ拡張機能です。

## 機能

- **自動検出**: ZennとQiitaの記事ページを開くと自動で分析
- **AIスコア表示**: 記事のAIっぽさをスコア化して表示
- **警告バナー**: 記事本文の上部に目立つ警告を表示
- **検出パターン**:
  - 過度に丁寧な表現（「ご存知の通り」など）
  - 抽象的な接続詞の多用（「まず」「次に」「さらに」）
  - 「〜でしょう」「〜かもしれません」の連続使用
  - 長すぎる文の多用
  - 過度に整った「です・ます」調

## インストール方法

### 開発者モードで読み込み

1. このリポジトリをクローンまたはダウンロード
2. Chrome/Edgeで `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」をオン
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. このフォルダを選択

### アイコンの設定

現在はSVGアイコンを同梱しています。PNGアイコンに変換する場合:

```bash
# ImageMagickが必要
convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
convert -background none icons/icon.svg -resize 128x128 icons/icon128.png
```

または、[Figma](https://figma.com) などでSVGを開いてPNGとしてエクスポートしてください。

## 使い方

1. ZennまたはQiitaの記事ページを開く
2. 自動的に分析が実行され、AIっぽさが高い場合は警告バナーが表示される
3. 拡張機能のアイコンをクリックすると:
   - 現在のページの状態を確認
   - 手動で再分析
   - 設定変更（閾値の調整など）

## 警告レベル

| レベル | スコア | 表示 |
|--------|--------|------|
| 🟢 低 | 0-4 | 警告なし |
| 🟡 中 | 5-14 | 黄色の警告 |
| 🔴 高 | 15+ | 赤色の警告 |

## 技術仕様

- **Manifest Version**: 3
- **対応ブラウザ**: Chrome, Edge, Firefox（要調整）
- **権限**: activeTab, storage

## 開発

```bash
# リポジトリのクローン
git clone https://github.com/Milix-M/ai-article-warning.git
cd ai-article-warning

# 拡張機能の読み込み
# Chrome → chrome://extensions/ → デベロッパーモードON → 読み込み
```

## 注意事項

- この拡張機能は**ヒューリスティック分析**であり、確実なAI検出ではありません
- 誤検出や見逃しの可能性があります
- 最終的な判断はユーザー自身で行ってください

## ライセンス

MIT License

## 貢献

IssueやPull Request歓迎です。
