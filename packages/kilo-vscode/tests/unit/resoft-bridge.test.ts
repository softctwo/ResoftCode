import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { resolveCliPath } from "../../src/services/cli-backend/server-manager"

const BUNDLED = "/extension/bin/kilo"

type PathState = {
  saved: { PATH?: string; PATHEXT?: string }
  dir: string
}

function withIsolatedPath(): PathState {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resoft-bridge-test-"))
  // Fake executables on the isolated PATH
  fs.writeFileSync(path.join(dir, "resoftcode"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  fs.writeFileSync(path.join(dir, "resoft"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  fs.writeFileSync(path.join(dir, "kilo"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  const saved = { PATH: process.env["PATH"], PATHEXT: process.env["PATHEXT"] }
  process.env["PATH"] = dir
  // POSIX: clear PATHEXT to avoid Windows-only branch
  delete process.env["PATHEXT"]
  return { saved, dir }
}

function restorePath(state: PathState) {
  if (state.saved.PATH === undefined) delete process.env["PATH"]
  else process.env["PATH"] = state.saved.PATH
  if (state.saved.PATHEXT === undefined) delete process.env["PATHEXT"]
  else process.env["PATHEXT"] = state.saved.PATHEXT
  fs.rmSync(state.dir, { recursive: true, force: true })
}

describe("resolveCliPath (Resoft bridge)", () => {
  let state: PathState

  beforeEach(() => {
    state = withIsolatedPath()
  })

  afterEach(() => {
    restorePath(state)
  })

  it("returns the bundled CLI when bridge is disabled", () => {
    const result = resolveCliPath(BUNDLED, { enabled: false, prefer: "auto" })
    expect(result).toEqual({ path: BUNDLED, via: "bundled" })
  })

  it("prefers resoftcode over bundled when bridge is enabled and resoftcode is on PATH", () => {
    const result = resolveCliPath(BUNDLED, { enabled: true, prefer: "auto" })
    expect(result.via).toBe("resoft-bridge")
    expect(result.path).toBe(path.join(state.dir, "resoftcode"))
  })

  it("falls back to resoft when only resoft is on PATH", () => {
    fs.rmSync(path.join(state.dir, "resoftcode"))
    const result = resolveCliPath(BUNDLED, { enabled: true, prefer: "auto" })
    expect(result.via).toBe("resoft-bridge")
    expect(result.path).toBe(path.join(state.dir, "resoft"))
  })

  it("falls back to bundled when no resoft binary is on PATH", () => {
    fs.rmSync(path.join(state.dir, "resoftcode"))
    fs.rmSync(path.join(state.dir, "resoft"))
    const result = resolveCliPath(BUNDLED, { enabled: true, prefer: "auto" })
    expect(result).toEqual({ path: BUNDLED, via: "bundled" })
  })

  it("honors an explicit executablePath and skips PATH lookup", () => {
    const explicit = path.join(state.dir, "explicit-resoftcode")
    
    fs.writeFileSync(explicit, "#!/bin/sh\nexit 0\n", { mode: 0o755 })
    try {
      const result = resolveCliPath(BUNDLED, {
        enabled: true,
        prefer: "auto",
        executablePath: explicit,
      })
      expect(result).toEqual({ path: explicit, via: "resoft-bridge" })
    } finally {
      
    }
  })

  it("ignores a non-existent executablePath and falls through to PATH lookup", () => {
    const result = resolveCliPath(BUNDLED, {
      enabled: true,
      prefer: "auto",
      executablePath: "/nonexistent/resoftcode",
    })
    expect(result.via).toBe("resoft-bridge")
    expect(result.path).toBe(path.join(state.dir, "resoftcode"))
  })

  it("respects prefer: 'resoft' ordering over 'resoftcode'", () => {
    const result = resolveCliPath(BUNDLED, { enabled: true, prefer: "resoft" })
    expect(result.via).toBe("resoft-bridge")
    expect(result.path).toBe(path.join(state.dir, "resoft"))
  })

  it("respects prefer: 'resoftcode' explicit ordering", () => {
    const result = resolveCliPath(BUNDLED, { enabled: true, prefer: "resoftcode" })
    expect(result.via).toBe("resoft-bridge")
    expect(result.path).toBe(path.join(state.dir, "resoftcode"))
  })

  it("tolerates a PATH with empty entries", () => {
    process.env["PATH"] = `::${state.dir}::`
    const result = resolveCliPath(BUNDLED, { enabled: true, prefer: "auto" })
    expect(result.via).toBe("resoft-bridge")
    expect(result.path).toBe(path.join(state.dir, "resoftcode"))
  })
})
