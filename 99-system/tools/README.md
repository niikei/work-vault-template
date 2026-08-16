---
type: living-document
created: 2026-08-05
updated: 2026-08-16
---
# Vault Tools

Node.js 22以上を使う。外部packageは使わず、macOSとWindowsで同じコマンドを実行する。Vaultルートから実行する。

```sh
node ./99-system/tools/validate-vault-rules.mjs
```

## organize-vault.mjs

ディレクトリ整理で毎回同じ確認を行わないための自動化スクリプトである。

```sh
node ./99-system/tools/organize-vault.mjs
node ./99-system/tools/organize-vault.mjs --apply
node ./99-system/tools/organize-vault.mjs --include-frontmatter-audit
```

既定はdry-runであり、ファイルは変更しない。`--apply`で実施する自動変更は次の2つだけである。

- `* copy.md` の誤命名リネーム
- 期待外のトップレベル空ディレクトリ削除

`--include-frontmatter-audit`はfrontmatter欠落や`type`未設定を読み取り専用で監査する。

## validate-vault-rules.mjs

運用規則をlintとして検証する。

```sh
node ./99-system/tools/validate-vault-rules.mjs
node ./99-system/tools/validate-vault-rules.mjs --include-prefixes 20-work/例
node ./99-system/tools/validate-vault-rules.mjs --include-prefixes 20-work,40-jottings
```

主な検証ルールは次のとおりである。

- 期待しないトップレベルディレクトリの検出
- Baseビュー埋め込み以外のObsidian独自リンク記法の検出
- frontmatterの有無、`type`の値、重複キー
- type別frontmatterスキーマ
- `created` / `updated` / `created_at` の形式
- `type`とファイル名規則の整合
- checkpointの配置・命名・calendar向けキーの整合
- 画像リンクの`./assets/<file>`運用

ルート方針文書の`AGENTS.md`、`README.md`、`Home.md`はfrontmatterを必須としない。`local-only`配下はfrontmatterと`confidential: true`を必須とする。

### type別frontmatterスキーマ

- 共通許容キー: `type`, `created`, `updated`, `created_at`, `description`, `tags`, `confidential`
- `note`: `type`, `created`を必須とする。
- `record`: `type`, `created`を必須とし、`source_raw`, `source_canonical`, `clip_title`, `author`, `published`, `file_name`を追加で許容する。
- `living-document`: `type`を必須とし、`marp`, `theme`, `size`, `paginate`, `date`を追加で許容する。
- `checkpoint`: `type`, `created`を必須とし、`date`, `week`, `week_start`, `month`, `month_start`, `carryover_done`, `carried_from`を追加で許容する。Dailyの`carryover_done`はboolean、`carried_from`は当日より前の`YYYY-MM-DD`とする。

### CIとJSON出力

```sh
node ./99-system/tools/validate-vault-rules.mjs --fail-on-error
node ./99-system/tools/validate-vault-rules.mjs --as-json
node ./99-system/tools/validate-vault-rules.mjs --json-out-path ./99-system/tools/reports/rules-lint.json
```

`--fail-on-error`はerrorが1件でもあれば終了コード1を返す。

## autofix-vault-metadata.mjs

frontmatterと`type`を安全に補完する。既定はdry-runである。

```sh
node ./99-system/tools/autofix-vault-metadata.mjs
node ./99-system/tools/autofix-vault-metadata.mjs --apply
node ./99-system/tools/autofix-vault-metadata.mjs --apply --max-apply-files 10
node ./99-system/tools/autofix-vault-metadata.mjs --apply --allow-large-apply
node ./99-system/tools/autofix-vault-metadata.mjs --include-prefixes 20-work/例
```

安全ガードは次のとおりである。

- strict UTF-8で読み、不正なUTF-8または置換文字を含むファイルを更新しない。
- BOMと改行コードを維持する。
- `--apply`は既定で20ファイルまでとする。
- 上限超過時は`--allow-large-apply`なしで更新しない。

## run-vault-maintenance.mjs

整理、補完、lintを一括実行する。

```sh
node ./99-system/tools/run-vault-maintenance.mjs
node ./99-system/tools/run-vault-maintenance.mjs --apply
node ./99-system/tools/run-vault-maintenance.mjs --apply --include-prefixes 20-work/例 --max-apply-files 10
node ./99-system/tools/run-vault-maintenance.mjs --apply --include-prefixes 20-work/例 --allow-large-apply
node ./99-system/tools/run-vault-maintenance.mjs --apply --fail-on-error
```

## 共通オプション

- `--vault-root <path>`: Vaultルートを指定する。既定は現在ディレクトリである。
- `--include-prefixes <a,b>`: 対象のVault内パスをカンマ区切りで指定する。
- オプション名はOSに依存しないkebab-caseとする。

## テスト

```sh
node --test ./99-system/tools/vault-tools.test.mjs
```

## Git Hook Guard

`confidential: true`が含まれるファイルをコミットさせないためにpre-commitフックを使う。

```sh
git config core.hooksPath .githooks
```

## 推奨手順

1. `run-vault-maintenance.mjs`をdry-runで実行する。
2. 差分見込みと対象件数を確認する。
3. 小さい`--max-apply-files`で`--apply`を実行する。
4. 直後に`validate-vault-rules.mjs`で再検証する。
5. 問題なければ次の小さい単位へ進む。
