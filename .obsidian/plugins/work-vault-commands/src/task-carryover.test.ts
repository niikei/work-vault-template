import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  CARRYOVER_END,
  CARRYOVER_START,
  NO_CARRYOVER,
  TASKS_END,
  TASKS_START,
  assertManagedDaily,
  cycleTaskAtIndex,
  cycleTaskAtIndexInMarkdown,
  cycleTaskStateLine,
  dailyDateFromPath,
  extractCarryoverTaskLines,
  hasManagedDailyMarker,
  isFrontmatterTrue,
  replaceCarryoverBlock,
  selectMostRecentDailyPath,
  setFrontmatterProperties,
} from "./task-carryover.ts";

function daily(tasks: string): string {
  return `---
type: checkpoint
date: 2026-08-16
created: 2026-08-16
carryover_done: false
---
# 2026-08-16

${TASKS_START}
## Tasks

${CARRYOVER_START}
${NO_CARRYOVER}
${CARRYOVER_END}

${tasks}
${TASKS_END}

## Progress
`;
}

test("未着手と進行中だけを順序どおり抽出する", () => {
  const source = daily(`- [ ] 未着手
- [/] 進行中
- [x] 完了
- [X] 完了2`);
  assert.deepEqual(extractCarryoverTaskLines(source), [
    "- [ ] 未着手",
    "- [/] 進行中",
  ]);
});

test("完了した親タスクは未完了の子を含めて除外する", () => {
  const source = daily(`- [x] 完了した親
  - [ ] 子
- [ ] 残す親
  - [/] 残す子
  - [x] 除外する子`);
  assert.deepEqual(extractCarryoverTaskLines(source), [
    "- [ ] 残す親",
    "  - [/] 残す子",
  ]);
});

test("旧Dailyの対象セクションを読み、空表示は除外する", () => {
  const source = `## 前回からの引き継ぎ

- [ ] 前日の未完了タスクはない。
- [ ]

## 今日の最重要3つ

- [ ] 実行する

## 予定

- [ ] 09:00 会議
`;
  assert.deepEqual(extractCarryoverTaskLines(source), ["- [ ] 実行する"]);
});

test("繰越領域の置換は手入力を保ち、再実行しても変わらない", () => {
  const source = daily("- [ ] 今日追加した項目");
  const once = replaceCarryoverBlock(source, ["- [/] 繰越項目"]);
  const twice = replaceCarryoverBlock(once, ["- [/] 繰越項目"]);
  assert.equal(twice, once);
  assert.match(once, /- \[\/\] 繰越項目/);
  assert.match(once, /- \[ \] 今日追加した項目/);
});

test("管理領域の欠落と誤った入れ子を拒否する", () => {
  assert.equal(hasManagedDailyMarker("## 前回からの引き継ぎ"), false);
  assert.equal(hasManagedDailyMarker(daily("")), true);
  assert.doesNotThrow(() => assertManagedDaily(daily("")));
  assert.throws(
    () => assertManagedDaily(daily("").replace(TASKS_END, "")),
    /それぞれ1個必要/,
  );
  assert.throws(
    () =>
      assertManagedDaily(
        `${TASKS_START}\n${TASKS_END}\n${CARRYOVER_START}\n${CARRYOVER_END}`,
      ),
    /TASKS領域の内側/,
  );
});

test("空の繰越領域には説明コメントを置く", () => {
  assert.match(replaceCarryoverBlock(daily(""), []), new RegExp(NO_CARRYOVER));
});

test("日付の欠落と未来を越えて直近の過去Dailyを選ぶ", () => {
  const paths = [
    "10-checkpoints/daily/2026/08/20260810.md",
    "10-checkpoints/daily/2026/08/20260814.md",
    "10-checkpoints/daily/2026/08/20260816.md",
    "10-checkpoints/daily/2026/08/20260820.md",
    "10-checkpoints/daily/bad.md",
  ];
  assert.equal(
    selectMostRecentDailyPath(paths, "20260816"),
    "10-checkpoints/daily/2026/08/20260814.md",
  );
  assert.equal(
    dailyDateFromPath("10-checkpoints/daily/2026/08/20260814.md"),
    "2026-08-14",
  );
});

test("タスク状態を未着手、進行中、完了の順に循環する", () => {
  assert.equal(cycleTaskStateLine("- [ ] 項目"), "- [/] 項目");
  assert.equal(cycleTaskStateLine("- [/] 項目"), "- [x] 項目");
  assert.equal(cycleTaskStateLine("- [x] 項目"), "- [ ] 項目");
  assert.equal(cycleTaskStateLine("本文"), null);
});

test("表示上のタスク番号から親子タスクの行を特定して循環する", () => {
  const section = `## Tasks

- [ ] 親
  - [/] 子
- [x] 完了`;
  assert.deepEqual(cycleTaskAtIndex(section, 1), {
    lineOffset: 3,
    before: "  - [/] 子",
    after: "  - [x] 子",
  });
  assert.equal(cycleTaskAtIndex(section, 3), null);
});

test("Read Mode用の更新は改行形式を保って対象タスクだけを循環する", () => {
  const lf = "# Tasks\n\n- [ ] 一つ目\n- [/] 二つ目\n";
  assert.equal(
    cycleTaskAtIndexInMarkdown(lf, 1),
    "# Tasks\n\n- [ ] 一つ目\n- [x] 二つ目\n",
  );

  const crlf = "# Tasks\r\n\r\n- [x] 完了\r\n";
  assert.equal(
    cycleTaskAtIndexInMarkdown(crlf, 0),
    "# Tasks\r\n\r\n- [ ] 完了\r\n",
  );
  assert.equal(cycleTaskAtIndexInMarkdown(lf, 2), null);
});

test("frontmatterの開始済み状態と繰越元を安全に更新する", () => {
  const updated = setFrontmatterProperties(daily(""), {
    carryover_done: "true",
    carried_from: "2026-08-14",
  });
  assert.equal(isFrontmatterTrue(updated, "carryover_done"), true);
  assert.match(updated, /carried_from: 2026-08-14/);
  assert.match(updated, /---\n# 2026-08-16/);

  const removed = setFrontmatterProperties(updated, { carried_from: null });
  assert.doesNotMatch(removed, /carried_from:/);
});
