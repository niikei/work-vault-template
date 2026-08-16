---
type: living-document
created: 2026-08-03
updated: 2026-08-03
---
# Inbox

置き場所・役割が未判断のファイルを置く。緊急保存ではYAMLを省略できる。

週次レビューで次のいずれかへ処理する。

- 業務の枠組みに属する → `20-work`
- 目的のある実験に属する → `30-playground`
- どの枠組みにも属さない → `40-jottings`
- 終了したが保存する → `90-archive`
- 不要 → 削除

```query
path:"00-inbox" -file:"Inbox"
```
