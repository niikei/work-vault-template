import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  nextJottingPath,
  renderJottingTemplate,
  type JottingMoment,
} from "./jotting.ts";

const values: Record<string, string> = {
  "YYYY-MM-DD": "2026-08-17",
  "YYYY-MM-DD HH:mm:ss": "2026-08-17 12:34:56",
  "YYYY-MM-DD[T]HH:mm:ssZ": "2026-08-17T12:34:56+09:00",
  YYYYMMDD_HHmmssSSS: "20260817_123456789",
};

const now: JottingMoment = {
  format: (pattern) => values[pattern] ?? pattern,
};

test("Jottingのファイル名はWindowsでも使える日時形式にする", () => {
  assert.equal(
    nextJottingPath(now, () => false),
    "40-jottings/20260817_123456789.md",
  );
  assert.equal(
    nextJottingPath(
      now,
      (path) => path === "40-jottings/20260817_123456789.md",
    ),
    "40-jottings/20260817_123456789_2.md",
  );
});

test("Jottingテンプレートを同一時刻で展開する", () => {
  const template = `---
created: "{{date:YYYY-MM-DD}}"
created_at: "{{date:YYYY-MM-DD[T]HH:mm:ssZ}}"
---
# {{title}}
`;
  assert.equal(
    renderJottingTemplate(template, now),
    `---
created: "2026-08-17"
created_at: "2026-08-17T12:34:56+09:00"
---
# 2026-08-17 12:34:56
`,
  );
});
