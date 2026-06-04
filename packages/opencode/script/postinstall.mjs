#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import childProcess from "child_process"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// kilocode_change start - variant detection matching bin/kilo logic
const platformMap = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
}
const archMap = {
  x64: "x64",
  arm64: "arm64",
  arm: "arm",
}

function detectPlatformAndArch() {
  const platform = platformMap[os.platform()] || os.platform()
  const arch = archMap[os.arch()] || os.arch()
  return { platform, arch }
}

function supportsAvx2() {
  const { platform, arch } = detectPlatformAndArch()
  if (arch !== "x64") return false

  if (platform === "linux") {
    try {
      return /(^|\s)avx2(\s|$)/i.test(fs.readFileSync("/proc/cpuinfo", "utf8"))
    } catch {
      return false
    }
  }

  if (platform === "darwin") {
    try {
      const result = childProcess.spawnSync("sysctl", ["-n", "hw.optional.avx2_0"], {
        encoding: "utf8",
        timeout: 1500,
      })
      if (result.status !== 0) return false
      return (result.stdout || "").trim() === "1"
    } catch {
      return false
    }
  }

  return false
}

function isMusl() {
  try {
    if (fs.existsSync("/etc/alpine-release")) return true
  } catch {
    // ignore
  }

  try {
    const result = childProcess.spawnSync("ldd", ["--version"], { encoding: "utf8" })
    const text = ((result.stdout || "") + (result.stderr || "")).toLowerCase()
    if (text.includes("musl")) return true
  } catch {
    // ignore
  }

  return false
}

function getPackageNames() {
  const { platform, arch } = detectPlatformAndArch()
  // resoft_change start - canonical China Resoft scope with legacy fallbacks
  const base = `@chinaresoft/resoftcode-${platform}-${arch}`
  const scopeBase = `@chinaresoft/cli-${platform}-${arch}`
  const priorBase = `@resoft/cli-${platform}-${arch}`
  const legacyBase = `@kilocode/cli-${platform}-${arch}`
  // resoft_change end
  const avx2 = supportsAvx2()
  const baseline = arch === "x64" && !avx2

  if (platform === "linux") {
    const musl = isMusl()
    if (musl) {
      if (arch === "x64") {
        if (baseline) return [`${base}-baseline-musl`, `${base}-musl`, `${base}-baseline`, base, `${scopeBase}-baseline-musl`, `${scopeBase}-musl`, `${scopeBase}-baseline`, scopeBase, `${priorBase}-baseline-musl`, `${priorBase}-musl`, `${priorBase}-baseline`, priorBase, `${legacyBase}-baseline-musl`, `${legacyBase}-musl`, `${legacyBase}-baseline`, legacyBase]
        return [`${base}-musl`, `${base}-baseline-musl`, base, `${base}-baseline`, `${scopeBase}-musl`, `${scopeBase}-baseline-musl`, scopeBase, `${scopeBase}-baseline`, `${priorBase}-musl`, `${priorBase}-baseline-musl`, priorBase, `${priorBase}-baseline`, `${legacyBase}-musl`, `${legacyBase}-baseline-musl`, legacyBase, `${legacyBase}-baseline`]
      }
      return [`${base}-musl`, base, `${scopeBase}-musl`, scopeBase, `${priorBase}-musl`, priorBase, `${legacyBase}-musl`, legacyBase]
    }
    if (arch === "x64") {
      if (baseline) return [`${base}-baseline`, base, `${base}-baseline-musl`, `${base}-musl`, `${scopeBase}-baseline`, scopeBase, `${scopeBase}-baseline-musl`, `${scopeBase}-musl`, `${priorBase}-baseline`, priorBase, `${priorBase}-baseline-musl`, `${priorBase}-musl`, `${legacyBase}-baseline`, legacyBase, `${legacyBase}-baseline-musl`, `${legacyBase}-musl`]
      return [base, `${base}-baseline`, `${base}-musl`, `${base}-baseline-musl`, scopeBase, `${scopeBase}-baseline`, `${scopeBase}-musl`, `${scopeBase}-baseline-musl`, priorBase, `${priorBase}-baseline`, `${priorBase}-musl`, `${priorBase}-baseline-musl`, legacyBase, `${legacyBase}-baseline`, `${legacyBase}-musl`, `${legacyBase}-baseline-musl`]
    }
    return [base, `${base}-musl`, scopeBase, `${scopeBase}-musl`, priorBase, `${priorBase}-musl`, legacyBase, `${legacyBase}-musl`]
  }

  if (arch === "x64") {
    if (baseline) return [`${base}-baseline`, base, `${scopeBase}-baseline`, scopeBase, `${priorBase}-baseline`, priorBase, `${legacyBase}-baseline`, legacyBase]
    return [base, `${base}-baseline`, scopeBase, `${scopeBase}-baseline`, priorBase, `${priorBase}-baseline`, legacyBase, `${legacyBase}-baseline`]
  }
  return [base, scopeBase, priorBase, legacyBase]
}

function findBinary() {
  const { platform } = detectPlatformAndArch()
  // resoft_change start - prefer resoftcode binary, fall back to prior names
  const binaryName = platform === "windows" ? "resoftcode.exe" : "resoftcode"
  const scopeBinaryName = platform === "windows" ? "resoft.exe" : "resoft"
  const legacyBinaryName = platform === "windows" ? "kilo.exe" : "kilo"
  // resoft_change end
  const names = getPackageNames()

  for (const packageName of names) {
    try {
      const packageJsonPath = require.resolve(`${packageName}/package.json`)
      const packageDir = path.dirname(packageJsonPath)
      const binaryPath = path.join(packageDir, "bin", binaryName)

      if (fs.existsSync(binaryPath)) {
        return { binaryPath, binaryName }
      }
      const scopePath = path.join(packageDir, "bin", scopeBinaryName)
      if (fs.existsSync(scopePath)) {
        return { binaryPath: scopePath, binaryName: scopeBinaryName }
      }
      // resoft_change start - try the legacy binary name in the same package
      const legacyPath = path.join(packageDir, "bin", legacyBinaryName)
      if (fs.existsSync(legacyPath)) {
        return { binaryPath: legacyPath, binaryName: legacyBinaryName }
      }
      // resoft_change end
    } catch {
      // package not installed, try next variant
    }
  }

  throw new Error(`Could not find any binary package. Tried: ${names.map((n) => `"${n}"`).join(", ")}`)
}
// kilocode_change end

// kilocode_change start - copy runtime resources next to cached binary
function copyTreeSitterResources(binaryPath) {
  const source = path.join(path.dirname(binaryPath), "tree-sitter")
  const target = path.join(__dirname, "bin", "tree-sitter")
  const runtime = path.join(source, "tree-sitter.wasm")

  if (!fs.existsSync(runtime)) return

  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true })
}

function copyConsoleResources(binaryPath) {
  const source = path.join(path.dirname(binaryPath), "console")
  const target = path.join(__dirname, "bin", "console")
  const index = path.join(source, "index.html")

  if (!fs.existsSync(index)) return

  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true })
}
// kilocode_change end

function main() {
  if (os.platform() === "win32") {
    // On Windows, the .exe is already included in the package and bin field points to it
    console.log("Windows detected: binary setup not needed (using packaged .exe)")
    return
  }

  const { binaryPath, binaryName } = findBinary()
  // resoft_change start - publish to both .resoft (canonical) and .kilo (legacy alias)
  const targets = [
    path.join(__dirname, "bin", ".resoft"),
    path.join(__dirname, "bin", ".kilo"),
  ]
  for (const target of targets) {
    if (fs.existsSync(target)) fs.unlinkSync(target)
    try {
      fs.linkSync(binaryPath, target)
    } catch {
      fs.copyFileSync(binaryPath, target)
    }
    fs.chmodSync(target, 0o755)
  }
  copyTreeSitterResources(binaryPath) // kilocode_change
  copyConsoleResources(binaryPath) // kilocode_change
  fs.chmodSync(target, 0o755)
||||||| parent of 81c9a4d0b8 (feat: ship Resoft CodingAgent V1 CLI as @chinaresoft/resoftcode)
  fs.chmodSync(target, 0o755)
  // resoft_change end
}

try {
  void main()
} catch (error) {
  console.error("Failed to setup resoft binary:", error.message)
  process.exit(1)
}
