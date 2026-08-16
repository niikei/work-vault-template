import { TFile, type Vault } from "obsidian";

import {
  type CheckpointMoment,
  ensureCheckpoint,
} from "./checkpoints";
import {
  assertManagedDaily,
  dailyDateFromPath,
  extractCarryoverTaskLines,
  hasManagedDailyMarker,
  isFrontmatterTrue,
  replaceCarryoverBlock,
  selectMostRecentDailyPath,
  setFrontmatterProperties,
} from "./task-carryover";

export interface StartTodayResult {
  file: TFile;
  alreadyStarted: boolean;
  legacyFormat: boolean;
  carriedFrom: string | null;
  carriedTaskCount: number;
}

export async function startToday(
  vault: Vault,
  now: CheckpointMoment,
): Promise<StartTodayResult> {
  const today = await ensureCheckpoint(vault, "daily", now);
  const current = await vault.read(today);
  if (isFrontmatterTrue(current, "carryover_done")) {
    return {
      file: today,
      alreadyStarted: true,
      legacyFormat: false,
      carriedFrom: null,
      carriedTaskCount: 0,
    };
  }

  if (!hasManagedDailyMarker(current)) {
    return {
      file: today,
      alreadyStarted: true,
      legacyFormat: true,
      carriedFrom: null,
      carriedTaskCount: 0,
    };
  }

  assertManagedDaily(current);
  // 書き込み前にfrontmatterと管理キーの重複も検証する。
  setFrontmatterProperties(current, {
    carryover_done: "false",
    carried_from: null,
  });

  const previousPath = selectMostRecentDailyPath(
    vault.getMarkdownFiles().map((file) => file.path),
    now.format("YYYYMMDD"),
  );
  let previous: TFile | null = null;
  if (previousPath) {
    const candidate = vault.getAbstractFileByPath(previousPath);
    if (!(candidate instanceof TFile)) {
      throw new Error(`繰越元のDailyを開けない: ${previousPath}`);
    }
    previous = candidate;
  }

  const carriedTaskLines = previous
    ? extractCarryoverTaskLines(await vault.read(previous))
    : [];
  const carriedFrom = previousPath ? dailyDateFromPath(previousPath) : null;

  // 先に繰越領域だけを確定する。途中で停止しても再実行で同じ内容になる。
  const staged = replaceCarryoverBlock(current, carriedTaskLines);
  await vault.modify(today, staged);

  const verified = await vault.read(today);
  if (replaceCarryoverBlock(verified, carriedTaskLines) !== verified) {
    throw new Error("Dailyの繰越結果を確認できなかった。");
  }

  const completed = setFrontmatterProperties(verified, {
    carryover_done: "true",
    carried_from: carriedFrom,
  });
  await vault.modify(today, completed);

  return {
    file: today,
    alreadyStarted: false,
    legacyFormat: false,
    carriedFrom,
    carriedTaskCount: carriedTaskLines.length,
  };
}
