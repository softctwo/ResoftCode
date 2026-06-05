// kilocode_change - new file
//
// Round-trip the sync + check scripts against the real
// `packages/opencode/package.json` and the sibling
// `.resoft-version` OEM marker file. The whole point of these
// scripts is that they keep the version-aware marker alive
// after package manager round-trips; the test exercises the
// real path (bump the version, run sync, re-run check) instead
// of mocking anything. The version is restored in a `finally`
// so the run is non-destructive to the source tree.
import { describe, expect, test } from "bun:test"
import { spawnSync } from "bun"
import fs from "node:fs"
import path from "node:path"

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..")
const SYNC = path.join(REPO_ROOT, "script", "sync-resoft-markers.ts")
const CHECK = path.join(REPO_ROOT, "script", "check-resoft-markers.ts")
const PKG_PATH = path.join(REPO_ROOT, "package.json")
const MARKER_FILE = path.join(REPO_ROOT, ".resoft-version")
const PKG_CWD = path.dirname(PKG_PATH)

function runBun(script: string, cwd: string) {
  return spawnSync({
    cmd: ["bun", "run", script],
    cwd,
    env: { ...process.env, BUN_BIN: process.env["BUN_BIN"] ?? "bun" },
  })
}

describe("resoft_change marker scripts", () => {
  test("bumping package.json version forces a sync re-write and check passes", () => {
    const beforePkg = fs.readFileSync(PKG_PATH, "utf-8")
    const beforeMarker = fs.readFileSync(MARKER_FILE, "utf-8")
    const bumpedPkg = beforePkg.replace(/"version"\s*:\s*"[^"]+"/, '"version": "9.9.9-test"')
    expect(bumpedPkg).not.toBe(beforePkg)
    fs.writeFileSync(PKG_PATH, bumpedPkg)

    try {
      const checkFailed = runBun(CHECK, PKG_CWD)
      expect(checkFailed.exitCode).toBe(1)
      expect(checkFailed.stderr.toString()).toContain("FAIL")

      const synced = runBun(SYNC, PKG_CWD)
      expect(synced.exitCode).toBe(0)
      expect(synced.stdout.toString()).toContain(".resoft-version rewritten to match package.json")

      const checkPass = runBun(CHECK, PKG_CWD)
      expect(checkPass.exitCode).toBe(0)
      expect(checkPass.stdout.toString()).toContain("OK")

      const afterMarker = fs.readFileSync(MARKER_FILE, "utf-8")
      expect(afterMarker).toContain("9.9.9-test")
    } finally {
      fs.writeFileSync(PKG_PATH, beforePkg)
      fs.writeFileSync(MARKER_FILE, beforeMarker)
    }
  })

  test("running sync twice is a no-op (idempotent)", () => {
    const firstSync = runBun(SYNC, PKG_CWD)
    expect(firstSync.exitCode).toBe(0)
    const afterFirst = fs.readFileSync(MARKER_FILE, "utf-8")

    const secondSync = runBun(SYNC, PKG_CWD)
    expect(secondSync.exitCode).toBe(0)
    const afterSecond = fs.readFileSync(MARKER_FILE, "utf-8")

    expect(afterFirst).toBe(afterSecond)
    expect(secondSync.stdout.toString()).toContain("already matches package.json")
  })
})
