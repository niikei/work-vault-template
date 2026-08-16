#!/usr/bin/env node

import { runAutofixVaultMetadata } from "./autofix-vault-metadata.mjs";
import { runOrganizeVault } from "./organize-vault.mjs";
import {
  isMain,
  numberOption,
  parseArgs,
  requireNode22,
  resolveVaultRoot,
} from "./vault-toolkit.mjs";
import { runValidateVaultRules } from "./validate-vault-rules.mjs";

export function runVaultMaintenance({
  vaultRoot = ".",
  apply = false,
  includePrefixes = ["20-work"],
  failOnError = false,
  maxApplyFiles = 20,
  allowLargeApply = false,
} = {}) {
  requireNode22();
  const root = resolveVaultRoot(vaultRoot);
  const limit = numberOption(String(maxApplyFiles), 20, "max-apply-files");

  console.log(`Vault root: ${root}`);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Scope: ${includePrefixes.join(", ")}`);
  console.log(`Max apply files: ${limit}`);
  console.log("");

  console.log("[1/3] Organize pass");
  const organize = runOrganizeVault({ vaultRoot: root, apply });

  console.log("");
  console.log("[2/3] Metadata autofix");
  const autofix = runAutofixVaultMetadata({
    vaultRoot: root,
    apply,
    includePrefixes,
    maxApplyFiles: limit,
    allowLargeApply,
  });

  console.log("");
  console.log("[3/3] Rules validation");
  const validation = runValidateVaultRules({
    vaultRoot: root,
    includePrefixes,
    failOnError,
  });

  return { organize, autofix, validation, exitCode: validation.exitCode };
}

function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2), {
      booleans: ["apply", "failOnError", "allowLargeApply"],
      strings: ["vaultRoot", "maxApplyFiles"],
      arrays: ["includePrefixes"],
    });
    const result = runVaultMaintenance({
      ...parsed,
      maxApplyFiles: numberOption(parsed.maxApplyFiles, 20, "max-apply-files"),
    });
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) main();
