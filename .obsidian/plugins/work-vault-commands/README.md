# Work Vault Commands

このVault固有の作成・表示コマンドを追加するpluginである。

## Development

Node.js 22以上を使う。初回だけ`npm install`を実行する。`src`を編集し、`npm run build`でObsidianが読む`main.js`を生成する。`npm test`でユニットテストを実行する。コマンドはmacOS・Windows共通である。`main.js`は直接編集しない。

VS Codeでは公式のTypeScript 7拡張を使う。`.vscode/settings.json`がTypeScript 7のLSPとplugin配下のSDKを指定する。

- `main.ts`: plugin起動、Command・Ribbon登録
- `actions.ts`: Home、Review、文書作成、ペイン操作
- `checkpoints.ts`: Daily・Weekly・Monthly生成
- `template-note.ts`: 全文書テンプレートの配置・命名規則
- `template-note.test.ts`: 文書の配置・命名規則のユニットテスト
- `jotting.ts`: Jottingの配置・命名と作成
- `jotting.test.ts`: Jottingの命名規則のユニットテスト
- `start-today.ts`: 当日の開始とVault操作
- `task-checkbox-cycler.ts`: Reading view・Live Previewのクリックによる3状態切替
- `task-carryover.ts`: タスク木・繰越・frontmatterの純粋ロジック（テスト対象）
- `task-carryover.test.ts`: タスク繰越のユニットテスト
- `calendar-view.ts`: カレンダー表示と日付移動、Dailyオープン
- `files.ts`: Vault内のファイル・フォルダ操作
- `editor-format.ts`: Editorへの最小範囲の適用と結果確認
- `explorer-icons.ts`: File Explorerのフォルダ・ファイルアイコン
- `formatting.ts`: 現在のMarkdownの整形と結果通知
- `markdown-format.ts`: markdownlint規則と純粋な整形処理
- `web-clip-dedup-logic.ts`: Web Clip重複URL検出の純粋ロジック（テスト対象）
- `web-clip-dedup.ts`: Obsidian APIとの接続（vault.on・metadataCache.on）
- `web-clip-dedup.test.ts`: `web-clip-dedup-logic`のユニットテスト

`main.ts`には登録と接続だけを書く。新しい責務が生じた場合だけファイルを増やし、汎用的な`utils.ts`は作らない。

## Commands

- `Open Home`: Homeを開く
- `Start Today`: 当日のDailyを開始し、直近の過去Dailyから未完了を1回だけ繰り越す
- `Open today's checkpoint`: 当日のDaily checkpointを開き、なければ空のテンプレートから作る
- `Cycle task state`: カーソル行を`[ ]`、`[/]`、`[x]`の順に切り替える
- `Open current Weekly checkpoint`: 現在のWeeklyを作成または開く
- `Open current Monthly checkpoint`: 現在のMonthlyを作成または開く
- `Open checkpoint review`: Monthly・Weekly・Dailyを並べて開く
- `Open Calendar`: 右サイドバーに日曜日始まりのカレンダーを開く
- `Create from Template`: 一つの画面で文書種別・保存先・文書名を指定し、新規作成した文書を開く
- `Create Jotting`: 現在のペインにJottingを作る
- `Create Jotting in new pane`: 右ペインにJottingを作る
- `Format current Markdown`: 現在のMarkdownを整形する

`Start Today`は日付の欠落を飛び越え、当日より前で最も新しいDailyを繰越元にする。`Tasks`内の未着手`[ ]`と進行中`[/]`を親子関係と順序を保って繰り越し、完了した親`[x]`の配下は除外する。最初に繰越領域を置換して結果を確認し、最後に`carryover_done: true`を記録する。途中停止後の再実行でも同じ結果になる。

Reading viewとLive Previewでは、チェックボックスをクリックすると`[ ]`、`[/]`、`[x]`の順に循環する。Reading viewは同じビュー内の表示順、Live Previewはクリック座標を使ってMarkdown行を特定する。コマンドと`Cmd/Ctrl+Shift+Enter`はキーボード用の代替操作である。

3状態の外観は[MinimalのChecklist仕様](https://minimal.guide/checklists)を参考にし、未着手を空円、進行中を半円、完了をチェックとしてpluginのCSSで表現する。Minimal Theme自体や画像assetは追加しない。

開始済みのDailyは再実行しても変更しない。CalendarとCheckpoint ReviewはDailyがなければ空のテンプレートから作るだけであり、繰越は行わない。既存Dailyに新方式の領域マーカーがない場合は、既存内容を変更せず開き、自動繰越を行わなかったことを通知する。領域マーカーが一部だけ存在する壊れた形式は、上書きせずエラーにする。

右サイドバーにはplugin起動時からCalendarタブを用意し、上部にカレンダーアイコンを常時表示する。起動時はサイドバーを自動展開しない。独自RibbonはOpen today's checkpoint、Open Calendar、Start Today、Create from Template、Create Jottingを置く。Open Calendarは右サイドバーのCalendarタブを表示する。Open today's checkpointは繰越を行わず、Start Todayだけが未完了タスクを繰り越す。Create Jottingは鉛筆アイコンから現在のペインへJottingを作る。HomeとCheckpoint ReviewはCommand Paletteから実行する。

File Explorerはフォルダ名とファイル名の直前にLucideアイコンを表示する。トップ階層は場所、Markdownは`type`、その他は拡張子でアイコンを決める。表示だけを変更し、ファイルとYAMLは変更しない。

Checkpointは`99-system/templates`から作る。業務データ・独自設定は保存しない。ネットワーク通信・外部ファイルアクセスも行わない。

Markdown整形は固定した`markdownlint`をplugin内で実行する。現在のMarkdownだけを対象にし、自動保存時は実行しない。コマンド実行時に即時適用し、適用後はUndoできる。規則は末尾空白、空行、ファイル末尾改行に限定する。末尾スペース1個は削除し、2個以上は強制改行を維持する2個へ正規化する。YAMLとコードブロックの内容は変更しない。frontmatter終端直後の空行はVault規約に従って削除する。

Create from Templateでは、Note・RecordはInbox・Work・Playgroundから保存先を選び、`YYYYMMDD_<名前>.md`で作る。Living documentはWork配下だけを保存先にし、`<名前>.md`で作る。同名文書があれば重複作成せず、その文書を開く。JottingとCheckpointは専用コマンドで所定の場所へ作る。

Obsidian 1.13.7で動作確認する。文書作成はplugin内で行い、Unique Note CreatorやTemplatesのCore pluginには依存しない。
