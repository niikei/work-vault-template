import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findDuplicate, getMergeDestPath } from "./web-clip-dedup-logic.ts";

const NEW_GENERAL = "00-inbox/web-clips/new/general/20260804_page.md";
const MERGE_GENERAL = "00-inbox/web-clips/merge-queue/general/20260804_page.md";
const NEW_SP = "00-inbox/web-clips/new/sharepoint-files/20260804_doc.md";
const MERGE_SP = "00-inbox/web-clips/merge-queue/sharepoint-files/20260804_doc.md";

test("findDuplicate: 一致するURLがあれば返す", () => {
	const files = [
		{ path: NEW_GENERAL, canonical: "https://example.com/page" },
		{ path: "20-work/note.md", canonical: "https://example.com/page" },
	];
	const result = findDuplicate("https://example.com/page", NEW_GENERAL, files);
	assert.equal(result?.path, "20-work/note.md");
});

test("findDuplicate: 自分自身はスキップする", () => {
	const files = [
		{ path: NEW_GENERAL, canonical: "https://example.com/page" },
	];
	const result = findDuplicate("https://example.com/page", NEW_GENERAL, files);
	assert.equal(result, undefined);
});

test("findDuplicate: URLが異なれば返さない", () => {
	const files = [
		{ path: NEW_GENERAL, canonical: "https://example.com/page" },
		{ path: "20-work/note.md", canonical: "https://other.com/page" },
	];
	const result = findDuplicate("https://example.com/page", NEW_GENERAL, files);
	assert.equal(result, undefined);
});

test("findDuplicate: canonicalがundefinedのファイルは無視する", () => {
	const files = [
		{ path: NEW_GENERAL, canonical: "https://example.com/page" },
		{ path: "20-work/note.md", canonical: undefined },
	];
	const result = findDuplicate("https://example.com/page", NEW_GENERAL, files);
	assert.equal(result, undefined);
});

test("getMergeDestPath: new/general → merge-queue/general", () => {
	assert.equal(getMergeDestPath(NEW_GENERAL), MERGE_GENERAL);
});

test("getMergeDestPath: new/sharepoint-files → merge-queue/sharepoint-files", () => {
	assert.equal(getMergeDestPath(NEW_SP), MERGE_SP);
});

test("getMergeDestPath: 対象外パスはundefined", () => {
	assert.equal(getMergeDestPath("20-work/note.md"), undefined);
});

test("getMergeDestPath: merge-queue配下は対象外", () => {
	assert.equal(getMergeDestPath(MERGE_GENERAL), undefined);
});
