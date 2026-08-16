---
type: living-document
created: 2026-08-03
updated: 2026-08-17
---
# Checkpoints

Daily・Weekly・Monthlyは、時間をまたいで仕事の文脈を取り戻す引き継ぎである。日記ではない。

## 操作

- `Open today's checkpoint`で当日のDailyを空のテンプレートから作成または開く
- `Start Today`または`Cmd/Ctrl+Shift+D`で未完了タスクを繰り越して当日のDailyを開始する
- Command Paletteの`Open checkpoint review`で現在のMonthly・Weekly・Dailyを並べる
- `Open current Weekly checkpoint`で現在のWeeklyを作成または開く
- `Open current Monthly checkpoint`で現在のMonthlyを作成または開く
- `Open Calendar`で日曜日始まりのカレンダーを右サイドバーに表示する
- チェックボックスをクリックして未着手・進行中・完了の順に切り替える
- キーボードでは`Cmd/Ctrl+Shift+Enter`でカーソル行を同じ順に切り替える

## Daily

当日のDailyを実行状態の正本にする。過去のDailyは、その日の終了時点を残すsnapshotである。

- `Tasks`には今日実行する項目だけを書く。
- `Progress`には進んだ事実、`Notes`には判断・待ち・次の一手を書く。
- Workには要件・判断・手順・将来候補などの永続的な文脈を置く。
- Dailyのタスクから対象Workへ標準Markdownリンクを張る。

```query
path:"10-checkpoints/daily"
```

## Weekly

先週の進捗・停滞・決定を確認し、今週の優先事項を決める。

```query
path:"10-checkpoints/weekly"
```

## Monthly

先月の成果・停滞・変化を確認し、今月の重点を決める。

```query
path:"10-checkpoints/monthly"
```

## タスク管理

状態は次の3つだけである。

```markdown
- [ ] 未着手
- [/] 進行中
- [x] 完了
```

表示は空円、半円、チェックで区別する。[MinimalのChecklist仕様](https://minimal.guide/checklists)と同じ考え方である。

子タスクは親より空白2個または4個深くする。完了した親の配下は、翌日に繰り越さない。

```markdown
- [/] [対象Work](../../../../20-work/例/例.md) の実装を進める
  - [x] 条件を確認する
  - [ ] レビューを依頼する
```

`Start Today`は当日のDailyを作成し、直近の過去Dailyから未着手・進行中のタスク木を1回だけ繰り越す。休日や欠落日は飛び越える。`carryover_done: true`のDailyでは再実行しても変更しない。

既存形式の当日Dailyがすでにある場合は、その内容を変更せず開き、自動繰越を見送ったことを通知する。既存Dailyは一括移行しない。新形式で作られたDailyから通常運用へ切り替わる。

繰越はsnapshotを次の実行状態へ写す意図的な例外である。それ以外では同一タスクをDaily・Weekly・Monthly・Workへ重複させない。Workにはタスク本文ではなく、実行に必要な文脈を置く。

自動化を使えない場合も次の手順で再現できる。

1. テンプレートから当日のDailyを作る。
2. 当日より前で最も新しいDailyを開く。
3. `Tasks`内の`[ ]`と`[/]`を、親子関係を保って当日の`CARRYOVER`領域へ写す。
4. 完了した親とその子を除外する。
5. `carryover_done: true`とし、繰越元があれば`carried_from: YYYY-MM-DD`を加える。

Tasks系community pluginと独自タスクDBは使わない。Markdownが唯一の保存形式である。

## Calendar連携

- Calendarは日曜日始まりで表示し、Dailyを開くためのナビゲーションとして使う。
- 右サイドバー上部には起動時からCalendarタブのアイコンを表示する。サイドバーは自動展開しない。
- Calendarから作ったDailyは空のままであり、自動繰越しない。
- 繰越が必要な日は`Start Today`を使う。
- 予定の時刻情報は必要な場合だけDailyへ残す。
