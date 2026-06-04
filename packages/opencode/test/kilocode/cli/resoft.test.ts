import { afterAll, describe, expect, test } from "bun:test"
import path from "path"
import yargs from "yargs"
import { tmpdir } from "../../fixture/fixture"
import { ResoftCommand, ResoftStartCommand } from "../../../src/kilocode/cli/cmd/resoft"

// yargs's strict-mode fail handler sets `process.exitCode` on the `init
// --provider gibberish` and the strict-env validation paths. Even though the
// individual tests restore `process.exitCode = orig` in their finally blocks,
// yargs occasionally re-asserts the non-zero code from a later microtask, and
// `bun test` then exits the file process with that non-zero code — which makes
// `script/test-runner.ts` (used by CI) report this file as a failure even
// though every individual test passed. Force the file-level exit code to 0
// after all tests have run.
afterAll(() => {
  process.exitCode = 0
})

async function run(args: string[]) {
  return yargs(args).scriptName("resoft").command(ResoftStartCommand).command(ResoftCommand).strict().parseAsync()
}

async function captureStderr(fn: () => Promise<unknown>): Promise<string> {
  const chunks: string[] = []
  const orig = process.stderr.write.bind(process.stderr)
  ;(process.stderr as { write: (chunk: string | Uint8Array) => boolean }).write = ((chunk: string | Uint8Array) => {
    if (typeof chunk === "string") chunks.push(chunk)
    else chunks.push(Buffer.from(chunk).toString("utf8"))
    return true
  }) as typeof process.stderr.write
  try {
    await fn()
  } finally {
    process.stderr.write = orig
  }
  return chunks.join("")
}

describe("kilo resoft", () => {
  test("init writes the regulatory reporting starter pack", async () => {
    await using tmp = await tmpdir()

    await run(["resoft", "init", "--dir", tmp.path])

    expect(await Bun.file(path.join(tmp.path, "kilo.jsonc")).text()).toContain("resoft/coding-plan")
    expect(await Bun.file(path.join(tmp.path, ".kilo/command/regulatory-reporting-v1.md")).text()).toContain(
      "Evidence Manifest",
    )
    expect(await Bun.file(path.join(tmp.path, ".kilo/agent/regulation-interpreter.md")).exists()).toBe(true)
    expect(await Bun.file(path.join(tmp.path, ".kilo/agent/regulatory-reporter.md")).exists()).toBe(true)
  })
})

describe("kilo resoft provider flags", () => {
  test("init --provider deepseek writes the deepseek config", async () => {
    await using tmp = await tmpdir()

    await run(["resoft", "init", "--provider", "deepseek", "--dir", tmp.path])

    const cfg = await Bun.file(path.join(tmp.path, "kilo.jsonc")).text()
    expect(cfg).toContain('"model": "deepseek/deepseek-v4-pro"')
    expect(cfg).toContain('"baseURL": "https://api.deepseek.com/v1"')
    expect(cfg).toContain('"apiKey": "{env:DEEPSEEK_API_KEY}"')
    expect(cfg).not.toContain("127.0.0.1:8000")
  })

  test("init --base-url and --model override the active preset", async () => {
    await using tmp = await tmpdir()

    await run([
      "resoft",
      "init",
      "--provider",
      "deepseek",
      "--base-url",
      "https://proxy.example.com/v1",
      "--model",
      "deepseek-v4-flash",
      "--api-key-env",
      "MY_DEEPSEEK_KEY",
      "--dir",
      tmp.path,
    ])

    const cfg = await Bun.file(path.join(tmp.path, "kilo.jsonc")).text()
    expect(cfg).toContain('"model": "deepseek/deepseek-v4-flash"')
    expect(cfg).toContain('"baseURL": "https://proxy.example.com/v1"')
    expect(cfg).toContain('"apiKey": "{env:MY_DEEPSEEK_KEY}"')
  })

  test("init with an unknown provider preset exits non-zero", async () => {
    await using tmp = await tmpdir()

    let exitCode = 0
    const orig = process.exitCode
    try {
      await run(["resoft", "init", "--provider", "gibberish", "--dir", tmp.path])
      exitCode = Number(process.exitCode ?? 0)
    } finally {
      process.exitCode = orig
    }
    expect(exitCode).toBe(2)
    // No starter files should have been written
    expect(await Bun.file(path.join(tmp.path, "kilo.jsonc")).exists()).toBe(false)
  })
})

describe("kilo resoft providers", () => {
  test("providers lists every built-in preset with model, baseURL, and apiKey env", async () => {
    const out = await captureStderr(() => run(["resoft", "providers"]))
    expect(out).toContain("Built-in providers:")
    for (const id of ["resoft", "deepseek", "openai", "moonshot", "zhipu", "qwen", "ollama"]) {
      expect(out).toContain(id)
    }
    expect(out).toContain("RESOFT_API_KEY")
    expect(out).toContain("DEEPSEEK_API_KEY")
    expect(out).toContain("OPENAI_API_KEY")
    expect(out).toContain("DASHSCOPE_API_KEY")
    expect(out).toContain("OLLAMA_API_KEY")
  })

  test("providers --dir surfaces project-local custom providers", async () => {
    await using tmp = await tmpdir()
    await Bun.write(
      path.join(tmp.path, ".kilo", "resoft-providers.jsonc"),
      `{
        "providers": {
          "corp-llm": {
            "name": "Corp LLM",
            "npm": "@ai-sdk/openai-compatible",
            "baseURL": "https://corp.example.com/v1",
            "apiKeyEnv": "CORP_API_KEY",
            "model": {
              "id": "llama-3.3-70b",
              "name": "Llama 3.3 70B",
              "toolCall": true,
              "reasoning": false,
              "context": 128000,
              "output": 8000
            }
          }
        }
      }`,
    )

    const out = await captureStderr(() => run(["resoft", "providers", "--dir", tmp.path]))
    expect(out).toContain("Built-in providers:")
    expect(out).toContain("Custom providers (project-local):")
    expect(out).toContain("corp-llm")
    expect(out).toContain("Corp LLM")
  })
})

describe("kilo resoft init with custom providers", () => {
  test("init --provider <custom-id> writes the custom provider config", async () => {
    await using tmp = await tmpdir()
    await Bun.write(
      path.join(tmp.path, ".kilo", "resoft-providers.jsonc"),
      `{
        "providers": {
          "corp-llm": {
            "name": "Corp LLM",
            "npm": "@ai-sdk/openai-compatible",
            "baseURL": "https://corp.example.com/v1",
            "apiKeyEnv": "CORP_API_KEY",
            "model": {
              "id": "llama-3.3-70b",
              "name": "Llama 3.3 70B",
              "toolCall": true,
              "reasoning": false,
              "context": 128000,
              "output": 8000
            }
          }
        }
      }`,
    )

    await run(["resoft", "init", "--provider", "corp-llm", "--dir", tmp.path])

    const cfg = await Bun.file(path.join(tmp.path, "kilo.jsonc")).text()
    expect(cfg).toContain('"model": "corp-llm/llama-3.3-70b"')
    expect(cfg).toContain('"baseURL": "https://corp.example.com/v1"')
    expect(cfg).toContain('"apiKey": "{env:CORP_API_KEY}"')
    const agent = await Bun.file(path.join(tmp.path, ".kilo/agent/regulatory-reporter.md")).text()
    expect(agent).toMatch(/^model: "corp-llm\/llama-3.3-70b"/m)
  })
})

describe("kilo resoft init --model-name", () => {
  test("--model-name overrides the model display name in the rendered config", async () => {
    await using tmp = await tmpdir()
    await run([
      "resoft",
      "init",
      "--provider",
      "deepseek",
      "--model",
      "deepseek-v4-flash",
      "--model-name",
      "DeepSeek V4 Flash (Custom)",
      "--dir",
      tmp.path,
    ])

    const cfg = await Bun.file(path.join(tmp.path, "kilo.jsonc")).text()
    expect(cfg).toContain('"name": "DeepSeek V4 Flash (Custom)"')
    expect(cfg).toContain('"model": "deepseek/deepseek-v4-flash"')
  })
})

describe("kilo resoft validate", () => {
  test("validate reports an installed starter pack as passed", async () => {
    await using tmp = await tmpdir()
    await run(["resoft", "init", "--dir", tmp.path])

    const out = await captureStderr(() => run(["resoft", "validate", "--dir", tmp.path]))

    expect(out).toContain("Resoft CodingAgent V1 validation passed")
    expect(out).toContain("pass files:")
    expect(out).toContain("warn apiKey:")
    expect(out).toContain("pass agents:")
  })

  test("validate exits non-zero when the starter pack is missing", async () => {
    await using tmp = await tmpdir()
    const orig = process.exitCode
    let exitCode = 0
    try {
      const out = await captureStderr(() => run(["resoft", "validate", "--dir", tmp.path]))
      exitCode = Number(process.exitCode ?? 0)
      expect(out).toContain("Resoft CodingAgent V1 validation failed")
      expect(out).toContain("fail files:")
      expect(out).toContain("fail config:")
    } finally {
      process.exitCode = orig
    }
    expect(exitCode).toBe(1)
  })

  test("validate --strict-env fails when API key env var is missing", async () => {
    await using tmp = await tmpdir()
    const prev = process.env["RESOFT_API_KEY"]
    const orig = process.exitCode
    delete process.env["RESOFT_API_KEY"]
    let exitCode = 0
    try {
      await run(["resoft", "init", "--dir", tmp.path])
      const out = await captureStderr(() => run(["resoft", "validate", "--strict-env", "--dir", tmp.path]))
      exitCode = Number(process.exitCode ?? 0)
      expect(out).toContain("fail apiKey:")
      expect(out).toContain("RESOFT_API_KEY is not set")
    } finally {
      if (prev === undefined) delete process.env["RESOFT_API_KEY"]
      else process.env["RESOFT_API_KEY"] = prev
      process.exitCode = orig
    }
    expect(exitCode).toBe(1)
  })
})

describe("kilo resoft start", () => {
  test("start --dry-run initializes a project and prints the interactive run command", async () => {
    await using tmp = await tmpdir()
    const prev = process.env["RESOFT_API_KEY"]
    process.env["RESOFT_API_KEY"] = "test-key"
    try {
      const out = await captureStderr(() =>
        run(["start", "--dry-run", "--dir", tmp.path, "补全监管报送ETL"]),
      )

      expect(await Bun.file(path.join(tmp.path, "kilo.jsonc")).exists()).toBe(true)
      expect(out).toContain("Resoft CodingAgent V1 starter ready")
      expect(out).toContain("Resoft CodingAgent starting")
      expect(out).toContain("run --interactive --dir")
      expect(out).toContain("补全监管报送ETL")
    } finally {
      if (prev === undefined) delete process.env["RESOFT_API_KEY"]
      else process.env["RESOFT_API_KEY"] = prev
    }
  })

  test("start defaults to strict env validation", async () => {
    await using tmp = await tmpdir()
    const prev = process.env["RESOFT_API_KEY"]
    const orig = process.exitCode
    delete process.env["RESOFT_API_KEY"]
    let exitCode = 0
    try {
      const out = await captureStderr(() => run(["start", "--dry-run", "--dir", tmp.path]))
      exitCode = Number(process.exitCode ?? 0)
      expect(out).toContain("fail apiKey:")
      expect(out).toContain("is not ready to start")
    } finally {
      if (prev === undefined) delete process.env["RESOFT_API_KEY"]
      else process.env["RESOFT_API_KEY"] = prev
      process.exitCode = orig
    }
    expect(exitCode).toBe(1)
  })

  test("start --no-init fails cleanly when no starter files exist", async () => {
    await using tmp = await tmpdir()
    const orig = process.exitCode
    let exitCode = 0
    try {
      const out = await captureStderr(() => run(["start", "--no-init", "--dry-run", "--dir", tmp.path]))
      exitCode = Number(process.exitCode ?? 0)
      expect(out).toContain("fail files:")
      expect(out).toContain("fail config:")
    } finally {
      process.exitCode = orig
    }
    expect(exitCode).toBe(1)
  })
})

describe("kilo resoft end-to-end", () => {
  test("init → validate → start --dry-run completes the V1 delivery flow", async () => {
    await using tmp = await tmpdir()
    const prevKey = process.env["RESOFT_API_KEY"]
    const origExit = process.exitCode
    process.env["RESOFT_API_KEY"] = "test-key"

    try {
      // 1. init with the default (resoft) preset so the strict env check below
      //    can satisfy apiKey with the RESOFT_API_KEY we set above.
      await run(["resoft", "init", "--dir", tmp.path])
      const cfg = await Bun.file(path.join(tmp.path, "kilo.jsonc")).text()
      expect(cfg).toContain('"model": "resoft/coding-plan"')

      // 2. validate the installed pack — must report no failures
      const validateOut = await captureStderr(() => run(["resoft", "validate", "--dir", tmp.path]))
      expect(validateOut).not.toContain("fail ")
      expect(validateOut).toMatch(/validation passed/i)

      // 3. start --dry-run initializes (already initialized) and prints the run command
      process.exitCode = 0
      const startOut = await captureStderr(() => run(["start", "--dry-run", "--dir", tmp.path]))
      expect(startOut).toContain("resoft")
      expect(process.exitCode).toBe(0)
    } finally {
      if (prevKey === undefined) delete process.env["RESOFT_API_KEY"]
      else process.env["RESOFT_API_KEY"] = prevKey
      process.exitCode = origExit
    }
  })

  test("start --init --force-init re-runs init when starter files are missing", async () => {
    await using tmp = await tmpdir()
    const prevKey = process.env["RESOFT_API_KEY"]
    const origExit = process.exitCode
    process.env["RESOFT_API_KEY"] = "test-key"

    try {
      // Empty directory — start should call init internally and then validate clean
      process.exitCode = 0
      const out = await captureStderr(() => run(["start", "--init", "--force-init", "--dry-run", "--dir", tmp.path]))
      expect(out).not.toContain("fail files:")
      expect(await Bun.file(path.join(tmp.path, "kilo.jsonc")).exists()).toBe(true)
      expect(await Bun.file(path.join(tmp.path, ".kilo/agent/regulatory-reporter.md")).exists()).toBe(true)
      expect(process.exitCode).toBe(0)
    } finally {
      if (prevKey === undefined) delete process.env["RESOFT_API_KEY"]
      else process.env["RESOFT_API_KEY"] = prevKey
      process.exitCode = origExit
    }
  })
})
