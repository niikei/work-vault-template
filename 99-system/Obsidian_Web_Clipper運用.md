---
type: living-document
created: 2026-08-04
updated: 2026-08-16
---
# Obsidian Web Clipper運用

## 方針

- 基本は00-inboxへクリップする。
- 同じ情報を増やさず、最終的にliving-documentへ統合する。
- 既存のliving-documentが明確なときだけ直接更新する。

## 基本設定

- 保存先Vault: Work Vault
- 既定保存先フォルダ: 00-inbox/web-clips/new/general
- 既定フォーマット: Markdown
- テンプレート名:
  - Source Capture (General) — フォールバックテンプレートに設定する
  - Source Capture (SharePoint File)

設定ファイル: [obsidian-web-clipper-settings.json](./web-clipper-imports/obsidian-web-clipper-settings.json)

Web Clipperの「設定をインポート」でこのファイルを読み込むと全設定が復元される。
設定を変更したら「設定をエクスポート」でこのファイルを上書きしてコミットする。

## 重複URL自動検出（work-vault-commandsプラグイン）

`work-vault-commands`プラグインが`source_canonical`で重複チェックを自動実行する。

- 重複あり → merge-queueへ自動移動 + Notice通知
- 重複なし → 何もしない

セットアップ不要。プラグインのビルド・有効化で動作する。

### 動作フロー

```text
Web Clipper → new/general へファイル作成
                ↓ vault.on("create") で検知
        metadataCache.on("changed") でフロントマター確認
                ↓
    source_canonical が一致する既存ノートを検索
                ↓
    重複あり                重複なし
       ↓                      ↓
  merge-queue へ移動      そのまま
```

## Web Clipperプロパティ

- 使用する主要プロパティ: type, created, published, source_raw, source_canonical, clip_title, description, author
- SharePointファイル時のみ追加: file_name

## 00-inboxの最小ディレクトリ

- 00-inbox/web-clips/new/general: 新規クリップ（通常）
- 00-inbox/web-clips/new/sharepoint-files: 新規クリップ（SharePointファイル）
- 00-inbox/web-clips/merge-queue/general: 統合先判断待ち（通常）
- 00-inbox/web-clips/merge-queue/sharepoint-files: 統合先判断待ち（SharePointファイル）

## クリップ時のルール

1. SharePoint URLはSource Capture (SharePoint File)が自動選択される。
2. それ以外はSource Capture (General)を使う。
3. 同一URLの再クリップ時は別ファイルが作成される。
4. 統合時にsource_canonicalで検索して重複を確認する。

## 同一URL再クリップの制約

- Web ClipperはVault内のURLプロパティを検索する機能を持たない。
- 投稿日付ベースのファイル名を維持したまま自動重複検出は実現できない。
- 再クリップは必ず別ファイルになる。統合は手動で行う。

## typeの使い分け

- note: 未整理メモ
- record: 一次情報の記録
- living-document: 現在状態の正本

## テンプレート

### Source Capture (General)

ファイル名: `YYYYMMDD_{{title}}.md` / 保存先: `new/general` / behavior: create

```markdown
## 要点

- 

## 統合先候補

- 

## URL

[{{url}}]({{url}})
```

### Source Capture (SharePoint File)

ファイル名: `YYYYMMDD_{{title}}.md` / 保存先: `new/sharepoint-files` / behavior: create

```markdown
## 用途

- 

## 要点

- 

## 統合先候補

- 

## URL

[{{url}}]({{url}})
```

### テンプレートトリガー

- Source Capture (SharePoint File):
  - `*://*.sharepoint.com/*/Doc.aspx*`
  - `*://*.sharepoint.com/*/:f:/*`
  - `*://*.sharepoint.com/*/:x:/*`
  - `*://*.sharepoint.com/*/:w:/*`
  - `*://*.sharepoint.com/*/:p:/*`
  - `*://*.sharepoint.com/*/:b:/*`
  - `*://*.sharepoint.com/*`
- Source Capture (General): トリガーなし（既定）

### テンプレート選択の運用

- 一般ページは Source Capture (General) を既定テンプレートとして使う。
- SharePoint URLでは Source Capture (SharePoint File) をトリガーで自動選択する。
- 再クリップは必ず別ファイルになる。統合はsource_canonicalで検索して手動で行う。

## SharePointの最小ルール

- iframeは保存しない。
- 最低限の項目だけ残す。
  - file_name
  - source_raw
  - source_canonical

## URL正規化の最小ルール

- source_raw: 取得したURLをそのまま保存する。
- source_canonical: 重複判定用に保存する。
- SharePointでは次を除外してよい。
  - utm_*
  - mobileredirect
  - action

## publishedの扱い

- 取得できる場合のみ設定する。
- 取得できない場合は空文字のままでよい。

## リンク運用ルール

- ノート間リンクは標準Markdown形式を使う。
- Obsidian独自記法（二重角括弧リンク、埋め込みリンク）は使わない。
- クリップノートには「統合先候補」リンクを1つ以上入れる。
- 統合先living-documentには「根拠リンク」としてクリップノートへのリンクを残す。

### 記述例

```markdown
## 統合先候補
- [認証方式の決定](20-work/認証基盤刷新/認証方式の決定.md)

## 根拠リンク
- [20260804_認証方式メモ](00-inbox/web-clips/new/general/20260804_認証方式メモ.md)
```

## 統合手順

1. source_canonicalで検索する。
2. 人間が統合先living-documentを1つ決める。
3. 要点とURLを統合先へ追記する。
4. 重複ノートは削除またはrecordとして保管する。

## 判断できない場合の扱い

- 自動で既存ノートを更新しない。
- merge-queueに置いて、レビュー時に人間が統合先を決める。

## 4パターンの扱い

1. 一回限りのページ保存: recordでinboxに保存し後で統合
2. お気に入りページ: 既存のリンク集living-documentへ追記
3. SharePointページ: recordで保存し後で統合
4. SharePointファイル: file_nameとURL情報のみ記録して統合
