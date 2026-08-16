# Agent Rules

このVaultで作業するAI向けの規則である。

## Read

1. 最新のMonthly checkpointを読む
2. 最新のWeekly checkpointを読む
3. 最新のDaily checkpointを読む
4. リンクされたWorkだけを読む
5. 不足時のみ検索範囲を広げる

最初からVault全体・履歴全体を読まない。

## Paths

- `00-inbox`: 置き場所・役割が未判断
- `20-work`: 現在の業務。下位階層は自由
- `30-playground`: 目的のある実験
- `40-jottings`: 枠組みのない短いnote。Git管理対象
- `90-archive`: 終了した保存対象
- `local-only`: Git除外。暗号化ではない

## Types

`type`は一つだけ使う。

- `note`: 着想・観察・自由な書き出し
- `record`: 起きたことの記録
- `living-document`: 現在状態の正本
- `checkpoint`: Daily・Weekly・Monthlyの引き継ぎ

Inboxへの緊急保存だけはtypeを省略できる。typeを追加しない。

## Write

- 新規作成前に検索し、現在情報は既存のliving documentへ統合する
- `最新版`・`最終版`を増やさない
- note・record・checkpointを正本にせず、永続情報はliving documentへ反映する
- 根拠はリンクで示し、事実・タスクを複製しない
- フォルダ所属をYAMLへ重複させず、移動・改名時はリンクを維持する
- 判断待ちの新規案は`00-inbox/agent-drafts`へ置く

## Format

- note・record: `YYYYMMDD_<名前>.md`
- Daily: `10-checkpoints/daily/YYYY/MM/YYYYMMDD.md`
- Weekly: `YYYYWww.md`
- Monthly: `YYYYMM.md`
- living document: 日付なし
- YAML日付: `YYYY-MM-DD`
- YAML日時: タイムゾーン付きISO 8601
- frontmatter終端`---`の直後に空行を入れない
- 非表示説明は`<!-- ... -->`で書く
- 運用Markdownは、だ・である調の短く明確で自己完結した文にする
- Obsidian独自記法はBaseビュー埋め込みの`![[path/file.base#View]]`に限り使う
- Base以外では`[[...]]`、`![[...]]`を使わない
- 画像はMarkdown記法`![alt](./assets/<file>)`で記述する
- リンクはBaseビュー埋め込みを除き、標準Markdown記法`[text](path)`で記述する

## Safety

- ユーザーの変更と無関係な差分を変更・コミットしない
- 指示なしにpush・リモート追加・外部公開をしない
- 認証情報・秘密鍵・個人情報を保存しない
