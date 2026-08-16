import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  documentDestinationRoots,
  documentNameError,
  documentTemplateKind,
  isAllowedDocumentDestination,
  normalizeDocumentName,
  renderDocumentTemplate,
  templateNoteSpec,
  type TemplateNoteMoment,
} from "./template-note.ts";

const values: Record<string, string> = {
  "YYYY-MM-DD": "2026-08-17",
  YYYYMMDD: "20260817",
};

const now: TemplateNoteMoment = {
  format: (pattern) => values[pattern] ?? pattern,
};

test("テンプレートごとに作成可能な場所を制限する", () => {
  assert.equal(documentTemplateKind("99-system/templates/note.md"), "note");
  assert.deepEqual(documentDestinationRoots("record"), [
    "00-inbox",
    "20-work",
    "30-playground",
  ]);
  assert.deepEqual(documentDestinationRoots("living-document"), ["20-work"]);
  assert.equal(isAllowedDocumentDestination("note", "00-inbox"), true);
  assert.equal(isAllowedDocumentDestination("record", "20-work/project"), true);
  assert.equal(
    isAllowedDocumentDestination("living-document", "20-work/project"),
    true,
  );
  assert.equal(
    isAllowedDocumentDestination("living-document", "00-inbox"),
    false,
  );
  assert.equal(isAllowedDocumentDestination("note", "40-jottings"), false);
});

test("noteとrecordは日付付き、living documentは日付なしで作成する", () => {
  assert.deepEqual(templateNoteSpec(now, "record", "00-inbox", "会議記録"), {
    path: "00-inbox/20260817_会議記録.md",
    title: "会議記録",
  });
  assert.deepEqual(
    templateNoteSpec(now, "living-document", "20-work", " 運用手順.md "),
    {
      path: "20-work/運用手順.md",
      title: "運用手順",
    },
  );
});

test("文書名をmacOSとWindowsの共通範囲に制限する", () => {
  assert.equal(normalizeDocumentName("  会議記録.md "), "会議記録");
  assert.equal(documentNameError("会議記録"), null);
  assert.match(documentNameError("bad/name") ?? "", /使えない/);
  assert.match(documentNameError("CON") ?? "", /Windows/);
  assert.match(documentNameError("name.") ?? "", /末尾/);
});

test("文書テンプレートの日付とタイトルを展開する", () => {
  const template = `---
type: record
created: "{{date:YYYY-MM-DD}}"
---
# {{title}}
`;
  assert.equal(
    renderDocumentTemplate(template, "会議記録", now),
    `---
type: record
created: "2026-08-17"
---
# 会議記録
`,
  );
});
