#!/usr/bin/env bun
// kilocode_change - new file
//
// Lint guard: the Resoft-owned `version` field in
// `packages/opencode/package.json` is allowed to diverge from
// the kilo-org baseline (7.3.22). The OEM signal lives in
// `packages/opencode/.resoft-version` and must be kept in sync.
// This script exits non-zero when the two drift apart so it can
// be wired into `bun run lint` and CI.
//
// Why a separate file (not a `// resoft_change` comment on the
// package.json version field, which is what the original
// convention was): strict JSON parsers (TypeScript's `tsgo
// --noEmit`, `JSON.parse`, etc.) reject package.json when a
// trailing `//` comment is present, and every package manager
// round-trip (npm install, bun install, `npm pkg set`) silently
// strips the comment. Splitting the marker into a sibling file
// keeps the OEM signal alive without poisoning package.json.

import { readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const PKG_DIR = path.resolve(import.meta.dir, "..")
const PKG_JSON = path.join(PKG_DIR, "package.json")
const MARKER_FILE = path.join(PKG_DIR, ".resoft-version")

const pkgText = readFileSync(PKG_JSON, "utf-8")
const pkgVersion = pkgText.match(/"version"\s*:\s*"([^"]+)"/)?.[1]
if (!pkgVersion) {
  console.error(`[check-resoft-markers] FAIL: no version field in ${PKG_JSON}`)
  process.exit(1)
}

const markerText = readFileSync(MARKER_FILE, "utf-8")
if (!markerText.includes(pkgVersion)) {
  console.error(
    `[check-resoft-markers] FAIL: ${MARKER_FILE} does not mention the current package version (${pkgVersion}).`,
  )
  console.error(
    `  Run \`bun run sync:resoft-markers\` to refresh it.`,
  )
  process.exit(1)
}

if (!markerText.includes("7.3.22")) {
  console.error(
    `[check-resoft-markers] FAIL: ${MARKER_FILE} should reference the kilo-org baseline version (7.3.22) so future maintainers know why this file exists.`,
  )
  process.exit(1)
}

console.log(
  `[check-resoft-markers] OK (package.json ${pkgVersion}, .resoft-version mentions ${pkgVersion} and the kilo-org baseline)`,
)
process.exit(0)
