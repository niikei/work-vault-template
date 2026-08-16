# Work Vault

仕事用のObsidian Vaultである。個人用Vaultとファイル・Git履歴・同期先を共有しない。

## セットアップ

1. GitHubの`Use this template`から新しいPrivate repositoryを作る。
2. 作成したrepositoryをcloneし、Obsidianの「Open folder as vault」で開く。
3. Restricted modeを解除し、同梱済みの`Work Vault Commands`だけを有効にする。
4. Vaultルートで`git config core.hooksPath .githooks`を実行する。
5. [Home](Home.md)を開き、必要なWorkへのリンクだけを追加する。

macOSとWindowsで同じVault内設定を使う。ショートカットはObsidianの`Mod`キーで定義済みであり、macOSでは`Cmd`、Windowsでは`Ctrl`として動作する。`.obsidian/workspace*.json`と`.obsidian/graph.json`はGit管理せず、レイアウトは端末ごとに保持する。

Vault本体の利用にNode.jsは不要である。plugin開発と保守ツールにはNode.js 22以上を使う。保守ツールは外部packageとPowerShellに依存しない。

## Documentation

- [Home](Home.md): 日々の入口と主要なBaseビュー
- [Checkpoints](10-checkpoints/Checkpoints.md): Daily・Weekly・Monthlyとタスク運用
- [Work Vault Commands](.obsidian/plugins/work-vault-commands/README.md): コマンド仕様とplugin開発
- [Vault Tools](99-system/tools/README.md): Node.js保守ツールの使い方
- [Obsidian Web Clipper運用](99-system/Obsidian_Web_Clipper運用.md): Web Clipの受け入れと重複処理
- [AGENTS](AGENTS.md): このVaultで作業するAI向けの規則

## Principles

- 置き場所が未判断ならInboxへ保存する
- フォルダは人間向けの可変な置き場所とする
- `type`は主要な役割を一つだけ表す
- 現在状態と時点記録を分ける
- 重複を避け、Markdownリンクで関係を表す
- 1ファイルで始め、必要時だけフォルダ化する
- Gitで変更履歴を残す

OKFは採用しない。1ファイル1概念、正本と一次資料の分離、必要な情報だけ読む、正本を更新して重複を増やさない、という考え方だけを使う。

## Paths

固定するのは最上位だけである。

| Path | Role |
| --- | --- |
| `00-inbox` | 置き場所・役割が未判断 |
| `10-checkpoints` | Daily・Weekly・Monthlyの引き継ぎ |
| `20-work` | 現在の業務。下位階層は自由 |
| `30-playground` | 目的のある実験 |
| `40-jottings` | 枠組みのない短いnote |
| `90-archive` | 終了した保存対象 |
| `99-system` | テンプレート・Bases・設定 |
| `local-only` | Git除外。暗号化ではない |

Inboxは処理待ちである。Jottingsは、どの枠組みにも属さないと判断した短いnoteの正式な置き場所である。`jotting`は素早く書いた短いnoteを意味する。Git管理対象だが外部公開は禁止する。

## Work hierarchy

`20-work`以下の名前・粒度・深さは自由である。プロジェクト・部署・業務領域・人物・研修などが混在してよい。

```text
20-work/
  認証基盤刷新/
  開発部/
    開発部共通/
    新人研修/
  田中さんとの協業/
```

- 一緒に移動するものは入れ子にする
- 頻繁に使うものは浅く置く
- 複数の場所に関係するものはリンクする
- 所属を`project`・`area`としてYAMLへ重複させない
- 概要ノートは必要な場合だけ、フォルダと同名で作る

```text
20-work/認証基盤刷新.md

↓ 関連ファイルが増えた場合

20-work/認証基盤刷新/
  認証基盤刷新.md
  認証方式の決定.md
  20260803_認証方式検討会.md
  assets/
```

Obsidianのリンク自動更新を有効にしている。必要に応じて移動・改名・統合する。通常のリンクは標準Markdown記法を使う。Baseビューの埋め込みだけはObsidian記法`![[path/file.base#View]]`を使う。

## Types

`type`はText Propertyであり、値は一つだけである。

| type | Meaning | Filename |
| --- | --- | --- |
| `note` | 着想・観察・自由な書き出し | 日付あり |
| `record` | 起きたことの記録 | 日付あり |
| `living-document` | 現在状態の正本 | 日付なし |
| `checkpoint` | Daily・Weekly・Monthlyの引き継ぎ | 日付あり |

```text
思ったこと          → note
起きたこと          → record
今どうなっているか  → living-document
日・週・月をまたぐ  → checkpoint
```

`memo`は使わない。英語のmemoは組織内のmemorandumを主に意味する。Inboxへの緊急保存ではtypeを省略できる。

## Current state and history

日付付きファイルは時点記録である。日付なしのliving documentは現在有効な概要・決定・手順・参照情報・継続タスクである。

```text
20260803_認証方式について気づいたこと.md  # note
20260805_認証方式検討会.md                # record
                  ↓ 反映・リンク
認証方式の決定.md                         # living-document
```

note・recordは現在の正しさを保証しない。永続情報はliving documentへ反映し、根拠となる記録へリンクする。

## Dates

ISO 8601に準拠する。ファイル名は基本形式、YAML・本文は拡張形式とする。

- Daily: `10-checkpoints/daily/YYYY/MM/YYYYMMDD.md`
- Weekly: `YYYYWww.md`。ISO週・月曜日始まり
- Monthly: `YYYYMM.md`
- note・record: `YYYYMMDD_<名前>.md`
- living document: 日付なし
- 日時付き: `YYYYMMDDTHHmmss+0900_<名前>.md`

```yaml
created: 2026-08-03
updated: 2026-08-10
created_at: "2026-08-03T14:30:00+09:00"
week: "2026-W32"
```

frontmatter終端`---`の直後に空行を入れない。非表示の説明はHTMLコメント`<!-- ... -->`で書く。

## Checkpoints

Daily・Weekly・Monthlyは日記ではなく、仕事の文脈を時間越しに引き継ぐファイルである。現在情報を複製せず、Workの正本へリンクする。

### Daily

```text
10-checkpoints/daily/2026/08/20260803.md
```

- 朝: `Start Today`で直近の過去Dailyから未完了を引き継ぎ、今日の焦点を決める
- 日中: `Tasks`を実行状態の正本とし、重要な差分とWorkへのリンクを残す
- 終業前: `Progress`と`Notes`へ進捗・待ち・次の一手を残す

### Weekly

```text
10-checkpoints/weekly/2026/2026W32.md
```

月曜日に作る。先週の進捗・停滞・決定を確認し、今週の優先事項を決める。Inbox・Work・Archiveも見直す。

### Monthly

```text
10-checkpoints/monthly/2026/202608.md
```

月初に作る。先月の成果・停滞・変化を確認し、今月の重点を決める。

BasesはYAMLの`created`を使い、対象日・対象週・対象月に作成したノートを表示する。ファイルシステムの作成日時は使わない。

## Tasks

`todo`はtypeではない。TODOは文書内のタスクである。

- 後で分類する書き出し → Inboxのnote
- 枠組みのない書き出し → Jottingsのnote
- 今日実行する項目と状態 → 当日のDaily
- 要件・判断・手順・将来候補 → Work内のliving document

タスク状態は未着手`[ ]`、進行中`[/]`、完了`[x]`の3つである。Reading viewとLive Previewではチェックボックスをクリックして状態を循環させる。`Cmd/Ctrl+Shift+Enter`はキーボード操作である。表示は[MinimalのChecklist仕様](https://minimal.guide/checklists)を参考に、空円、半円、チェックとする。

`Start Today`は当日のDailyを作り、直近の過去Dailyから未着手・進行中のタスク木を1回だけ繰り越す。繰越だけはsnapshotから次の実行状態を作る意図的な複製である。それ以外ではタスクを複製せず、DailyからWorkの文脈へ標準Markdownリンクを張る。過去のDailyは書き換えない。

Calendarは日曜日始まりで表示し、任意の日付のDailyを開くナビゲーションである。右サイドバーには起動時からCalendarタブのアイコンを置くが、サイドバーを自動展開しない。繰越は行わない。Tasks系community pluginと独自SQLiteタスクDBは使わない。Markdownだけで人間が同じ操作を再現できる。

## System

Obsidian標準機能を基本とする。Vault固有の操作だけ、Git管理する`Work Vault Commands` pluginを使う。

```text
99-system/templates/
  note.md
  jotting.md
  record.md
  living-document.md
  daily-checkpoint.md
  weekly-checkpoint.md
  monthly-checkpoint.md

99-system/bases/
  inbox.base
  current-documents.base
  untyped-files.base
  created-on-date.base
  created-in-week.base
  created-in-month.base

.obsidian/plugins/work-vault-commands/
  src/               # TypeScript source and tests
  main.js            # Obsidianが読み込むbuild済みbundle
  manifest.json
  package.json
  README.md           # command仕様と開発手順

.obsidian/snippets/
  ribbon-vscode.css
```

AIの判断待ちとなる新規案は`00-inbox/agent-drafts`へ置く。

## Obsidian

通常の新規ノートは`00-inbox`へ作る。`Create Jotting`は`40-jottings`へ`YYYYMMDD_HHmmssSSS.md`形式のnoteを作る。

| 操作 | macOS | Windows |
| --- | --- | --- |
| Inboxへ新規noteを作る | `Cmd+N` | `Ctrl+N` |
| Inboxへ新規noteを別ペインに作る | `Cmd+Shift+N` | `Ctrl+Shift+N` |
| Jottingを作る | `Cmd+J` | `Ctrl+J` |
| Jottingを別ペインに作る | `Cmd+Shift+J` | `Ctrl+Shift+J` |
| 新しいタブを開く | `Cmd+T` | `Ctrl+T` |
| 閉じたタブを復元する | `Cmd+Shift+T` | `Ctrl+Shift+T` |
| 当日のDailyを開始する | `Cmd+Shift+D` | `Ctrl+Shift+D` |
| タスク状態を切り替える | `Cmd+Shift+Enter` | `Ctrl+Shift+Enter` |
| Quick Switcherを開く | `Cmd+O` | `Ctrl+O` |
| Command Paletteを開く | `Cmd+P` | `Ctrl+P` |

Command Paletteの先頭にはHome、Start Today、Today's Checkpoint、Weekly、Monthly、Checkpoint Review、Jotting、Create from Template、Quick Switcherを固定する。

`Work Vault Commands`はStart Today・Open today's checkpoint・タスク状態切替・Home・現在のWeekly・現在のMonthly・Checkpoint Review・Calendar・Jotting・別ペインJotting・Create from Templateのコマンドを追加する。Open today's checkpointは当日のDaily checkpointを開き、なければ空のテンプレートから作る。繰越は行わない。Checkpointは存在すれば開き、なければISO 8601に従うパスへテンプレートから作る。Create from Templateは一つの画面でNote・Record・Living document、保存先、文書名を指定する。Note・RecordはInbox・Work・Playgroundへ日付付きの名前で作る。Living documentはWork配下だけへ日付なしの名前で作る。作成後はその文書を開く。同名文書があれば重複作成せず、その文書を開く。

独自RibbonはOpen today's checkpoint、Open Calendar、Start Today、Create from Template、Create Jottingを置く。Open today's checkpointはカレンダーチェック、Open Calendarはカレンダー、Create Jottingは鉛筆アイコンを使う。HomeとCheckpoint ReviewはCommand Paletteから実行する。`ribbon-vscode.css`で幅48px、ボタン48px、アイコン24pxにし、VS CodeのActivity Barに近い間隔にする。Restricted modeを解除し、このpluginだけを有効にする。

BookmarksはHome、Inbox、Work、Checkpoints、Jottings、未完了タスク検索への共有入口である。

Daily Notes、Templates、Unique Note Creator、WorkspacesのCore pluginは使わない。日付・配置・テンプレートを`Work Vault Commands`で一意に決め、Checkpoint Reviewは必要な配置をその都度作る。Basesは既存の`.base`表示に必要なので有効のままにし、Create New BaseのRibbonだけを隠す。

VS Codeでは`.obsidian/app.json`をplaintextとして扱う。Expo Toolsによるschema誤検出を避けるためである。

## Git and security

- `main`へ小さな単位で意図的にコミットする
- 自動pushしない
- 会社承認済みのリモートだけを使う
- `40-jottings`はGit管理する
- `local-only`はGit除外するが、暗号化されない
- パスワード・APIキー・秘密鍵を保存しない
- 個人情報・人事情報は会社指定の保存先へ置く
- 個人GitHub・個人Obsidian Sync・個人Vaultへ接続しない

`.gitignore`は既存のGit履歴を消さない。機密情報を誤ってコミットした場合はpushを止め、管理者へ連絡する。

## License

このテンプレートの独自部分は[MIT License](LICENSE)で提供する。第三者由来の内容は、それぞれの著作権表示とライセンスに従う。ChecklistのCSSに関する表示は[THIRD_PARTY_NOTICES](.obsidian/plugins/work-vault-commands/THIRD_PARTY_NOTICES.md)に記載する。
