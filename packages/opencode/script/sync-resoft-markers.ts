#!/usr/bin/env bun
// kilocode_change - new file
//
// Maintains the Resoft OEM marker in
// `packages/opencode/.resoft-version`. The marker used to live
// on the `version` field of `packages/opencode/package.json` as
// a `// resoft_change` trailing comment, but:
//   - `package.json` is JSON, and `//` comments are not legal JSON,
//   - strict JSON parsers (TypeScript's `tsgo --noEmit`,
//     `JSON.parse`, etc.) reject the file when the marker is
//     present, and
//   - every package manager round-trip (npm install, bun install,
//     `npm pkg set`) silently strips the trailing comment, so the
//     OEM signal was lost on every dep churn.
//
// The fix is to move the marker out of JSON entirely, into a
// sibling file that no JSON parser will ever touch. This script
// verifies that the version recorded in
// `packages/opencode/package.json` matches the version in
// `.resoft-version`, and re-writes `.resoft-version` if the
// package version has changed (e.g. when a maintainer bumped
// the version field but forgot to update the marker).

import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const PKG_DIR = path.resolve(import.meta.dir, "..")
const PKG_JSON = path.join(PKG_DIR, "package.json")
const MARKER_FILE = path.join(PKG_DIR, ".resoft-version")

const MARKER_HEADER = `# Resoft CodingAgent — package.json version marker
#
# The Resoft-owned version is`

const BASELINE_NOTE = `# The kilo-org baseline is 7.3.22; this file is the
# OEM signal that the version field in package.json is allowed
# to diverge from that baseline. Do not reset to 7.3.22 on
# upstream sync. If you bump the Resoft version, update both
# this file and the version field in package.json together.
`

function readPkgVersion(): string | undefined {
  const text = readFileSync(PKG_JSON, "utf-8")
  const m = text.match(/"version"\s*:\s*"([^"]+)"/)
  return m ? m[1] : undefined
}

function buildMarker(version: string): string {
  return `${MARKER_HEADER} ${version}.\n${BASELINE_NOTE}`
}

function sync(): "rewritten" | "unchanged" | "missing-version" {
  const version = readPkgVersion()
  if (!version) return "missing-version"
  const current = readFileSync(MARKER_FILE, "utf-8")
  const want = buildMarker(version)
  if (current === want) return "unchanged"
  writeFileSync(MARKER_FILE, want)
  return "rewritten"
}

const result = sync()
const label = {
  rewritten: `[sync-resoft-markers] .resoft-version rewritten to match package.json`,
  unchanged: `[sync-resoft-markers] .resoft-version already matches package.json`,
  "missing-version": `[sync-resoft-markers] FAIL: no version field found in ${PKG_JSON}`,
}[result]
console.log(label)
process.exit(result === "missing-version" ? 1 : 0)
