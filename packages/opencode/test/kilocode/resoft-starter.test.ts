import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { ResoftStarter } from "../../src/kilocode/resoft/starter"

describe("Resoft regulatory reporting starter", () => {
  test("defines a complete V1 CLI workflow pack", () => {
    const files = ResoftStarter.files()
    const paths = files.map((file) => file.path)
    const cmd = files.find((file) => file.path === ".kilo/command/regulatory-reporting-v1.md")
    const agents = paths.filter((item) => item.startsWith(".kilo/agent/"))

    expect(paths).toContain("kilo.jsonc")
    expect(cmd?.content).toContain("Evidence Manifest")
    expect(cmd?.content).toContain("@regulatory-reporter")
    expect(agents).toHaveLength(9)
    for (const name of [
      "business-analyst",
      "quality-analyst",
      "etl-developer",
      "data-tester",
      "testdata-builder",
      "script-developer",
      "data-analyst",
      "regulatory-reporter",
      "regulation-interpreter",
    ]) {
      expect(paths).toContain(`.kilo/agent/${name}.md`)
      expect(cmd?.content).toContain(`@${name}`)
    }
  })

  test("installs starter files without overwriting by default", async () => {
    await using tmp = await tmpdir()
    const target = path.join(tmp.path, "kilo.jsonc")
    await Bun.write(target, "existing")

    const result = await ResoftStarter.install({ dir: tmp.path })

    expect(result.skipped).toContain("kilo.jsonc")
    expect(result.written).toContain(".kilo/command/regulatory-reporting-v1.md")
    expect(await Bun.file(target).text()).toBe("existing")
    expect(await Bun.file(path.join(tmp.path, ".kilo/agent/regulatory-reporter.md")).exists()).toBe(true)
  })

  test("supports dry runs and forced overwrites", async () => {
    await using tmp = await tmpdir()
    const target = path.join(tmp.path, "kilo.jsonc")
    await Bun.write(target, "existing")

    const dry = await ResoftStarter.install({ dir: tmp.path, force: true, dry: true })
    expect(dry.written).toContain("kilo.jsonc")
    expect(await Bun.file(target).text()).toBe("existing")

    await ResoftStarter.install({ dir: tmp.path, force: true })
    expect(await Bun.file(target).text()).toContain("resoft/coding-plan")
  })

  test("validates an installed starter pack", async () => {
    await using tmp = await tmpdir()
    await ResoftStarter.install({ dir: tmp.path })

    const result = await ResoftStarter.validate({ dir: tmp.path })

    expect(result.ready).toBe(true)
    expect(result.checks.find((check) => check.id === "files")?.status).toBe("pass")
    expect(result.checks.find((check) => check.id === "apiKey")?.status).toBe("warn")
    expect(result.checks.find((check) => check.id === "agents")?.status).toBe("pass")
  })

  test("validation fails when required files are missing", async () => {
    await using tmp = await tmpdir()

    const result = await ResoftStarter.validate({ dir: tmp.path })

    expect(result.ready).toBe(false)
    expect(result.checks.find((check) => check.id === "files")?.status).toBe("fail")
    expect(result.checks.find((check) => check.id === "config")?.status).toBe("fail")
  })

  test("strict env validation fails when configured API key is unset", async () => {
    await using tmp = await tmpdir()
    const prev = process.env["RESOFT_API_KEY"]
    delete process.env["RESOFT_API_KEY"]
    try {
      await ResoftStarter.install({ dir: tmp.path })

      const result = await ResoftStarter.validate({ dir: tmp.path, strictEnv: true })

      expect(result.ready).toBe(false)
      expect(result.checks.find((check) => check.id === "apiKey")?.status).toBe("fail")
    } finally {
      if (prev === undefined) delete process.env["RESOFT_API_KEY"]
      else process.env["RESOFT_API_KEY"] = prev
    }
  })
})

describe("Resoft provider presets", () => {
  test("default provider is resoft with local baseURL", () => {
    const p = ResoftStarter.resolveProvider()
    expect(p.id).toBe("resoft")
    expect(p.model.id).toBe("coding-plan")
    expect(p.baseURL).toBe("http://127.0.0.1:8000/v1")
    expect(p.apiKeyEnv).toBe("RESOFT_API_KEY")
  })

  test("deepseek preset uses api.deepseek.com and deepseek-v4-pro", () => {
    const p = ResoftStarter.resolveProvider({ provider: "deepseek" })
    expect(p.id).toBe("deepseek")
    expect(p.model.id).toBe("deepseek-v4-pro")
    expect(p.baseURL).toBe("https://api.deepseek.com/v1")
    expect(p.apiKeyEnv).toBe("DEEPSEEK_API_KEY")
    expect(p.model.toolCall).toBe(true)
    expect(p.model.reasoning).toBe(true)
  })

  test("preset overrides apply on top of base preset", () => {
    const p = ResoftStarter.resolveProvider({
      provider: "deepseek",
      baseURL: "https://proxy.example.com/v1",
      apiKeyEnv: "MY_KEY",
      model: "deepseek-v4-flash",
      modelName: "DeepSeek V4 Flash",
    })
    expect(p.baseURL).toBe("https://proxy.example.com/v1")
    expect(p.apiKeyEnv).toBe("MY_KEY")
    expect(p.model.id).toBe("deepseek-v4-flash")
    expect(p.model.name).toBe("DeepSeek V4 Flash")
    // Untouched fields keep preset defaults
    expect(p.id).toBe("deepseek")
    expect(p.npm).toBe("@ai-sdk/openai-compatible")
    expect(p.model.toolCall).toBe(true)
  })

  test("unknown provider preset throws a helpful error", () => {
    expect(() => ResoftStarter.resolveProvider({ provider: "gibberish" })).toThrow(/Unknown provider/)
  })

  test("listProviders advertises at least resoft and deepseek", () => {
    const ids = ResoftStarter.listProviders()
    expect(ids).toContain("resoft")
    expect(ids).toContain("deepseek")
  })
})

describe("Resoft starter renders provider-aware files", () => {
  test("default files keep the legacy resoft/coding-plan reference", () => {
    const cfg = ResoftStarter.files().find((f) => f.path === "kilo.jsonc")?.content ?? ""
    expect(cfg).toContain('"model": "resoft/coding-plan"')
    expect(cfg).toContain('"enabled_providers": ["resoft"]')
    expect(cfg).toContain('"apiKey": "{env:RESOFT_API_KEY}"')
    expect(cfg).toContain('"baseURL": "http://127.0.0.1:8000/v1"')
  })

  test("deepseek preset rewrites model, baseURL, apiKey env, and provider block", () => {
    const cfg = ResoftStarter.files({ provider: "deepseek" }).find((f) => f.path === "kilo.jsonc")?.content ?? ""
    expect(cfg).toContain('"model": "deepseek/deepseek-v4-pro"')
    expect(cfg).toContain('"enabled_providers": ["deepseek"]')
    expect(cfg).toContain('"apiKey": "{env:DEEPSEEK_API_KEY}"')
    expect(cfg).toContain('"baseURL": "https://api.deepseek.com/v1"')
    expect(cfg).not.toContain("127.0.0.1:8000")
    expect(cfg).not.toContain("resoft/coding-plan")
  })

  test("agent frontmatter model reference tracks the provider", () => {
    const files = ResoftStarter.files({ provider: "deepseek" })
    const agent = files.find((f) => f.path === ".kilo/agent/regulatory-reporter.md")?.content ?? ""
    expect(agent).toMatch(/^model: "deepseek\/deepseek-v4-pro"/m)
  })
})

describe("Resoft extra built-in provider presets", () => {
  test.each([
    [
      "openai",
      {
        id: "gpt-4o",
        name: "GPT-4o",
        baseURL: "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
        toolCall: true,
        reasoning: false,
      },
    ],
    [
      "moonshot",
      {
        id: "kimi-k2-0711-preview",
        name: "Kimi K2",
        baseURL: "https://api.moonshot.cn/v1",
        apiKeyEnv: "MOONSHOT_API_KEY",
        toolCall: true,
        reasoning: false,
      },
    ],
    [
      "zhipu",
      {
        id: "glm-4.5",
        name: "GLM-4.5",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        apiKeyEnv: "ZHIPU_API_KEY",
        toolCall: true,
        reasoning: true,
      },
    ],
    [
      "qwen",
      {
        id: "qwen3-coder-plus",
        name: "Qwen3 Coder Plus",
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKeyEnv: "DASHSCOPE_API_KEY",
        toolCall: true,
        reasoning: true,
      },
    ],
    [
      "ollama",
      {
        id: "qwen2.5-coder:32b",
        name: "Qwen 2.5 Coder 32B (local)",
        baseURL: "http://127.0.0.1:11434/v1",
        apiKeyEnv: "OLLAMA_API_KEY",
        toolCall: true,
        reasoning: false,
      },
    ],
  ] as const)("preset %s renders correct kilo.jsonc and agent model reference", (id, expected) => {
    const provider = ResoftStarter.resolveProvider({ provider: id })
    expect(provider.id).toBe(id)
    expect(provider.model.id).toBe(expected.id)
    expect(provider.model.name).toBe(expected.name)
    expect(provider.baseURL).toBe(expected.baseURL)
    expect(provider.apiKeyEnv).toBe(expected.apiKeyEnv)
    expect(provider.model.toolCall).toBe(expected.toolCall)
    expect(provider.model.reasoning).toBe(expected.reasoning)
    expect(provider.npm).toBe("@ai-sdk/openai-compatible")

    const cfg = ResoftStarter.files({ provider: id }).find((f) => f.path === "kilo.jsonc")?.content ?? ""
    expect(cfg).toContain(`"model": "${id}/${expected.id}"`)
    expect(cfg).toContain(`"enabled_providers": ["${id}"]`)
    expect(cfg).toContain(`"apiKey": "{env:${expected.apiKeyEnv}}"`)

    const agent = ResoftStarter.files({ provider: id }).find(
      (f) => f.path === ".kilo/agent/regulatory-reporter.md",
    )?.content ?? ""
    expect(agent).toContain(`model: "${id}/${expected.id}"`)
  })

  test("listProviders advertises every built-in preset", () => {
    const ids = ResoftStarter.listProviders()
    for (const id of ["resoft", "deepseek", "openai", "moonshot", "zhipu", "qwen", "ollama"]) {
      expect(ids).toContain(id)
    }
  })
})

describe("Resoft custom provider files", () => {
  test("customProviderPaths returns user-global then project-local", () => {
    const paths = ResoftStarter.customProviderPaths("/tmp/proj")
    expect(paths).toHaveLength(2)
    expect(paths[0]).toContain("resoft-providers.jsonc")
    expect(paths[0]).not.toContain("/tmp/proj")
    expect(paths[1]).toBe(path.join("/tmp/proj", ".kilo", "resoft-providers.jsonc"))
  })

  test("project-local providers are merged on top of built-ins", async () => {
    await using tmp = await tmpdir()
    const dir = path.join(tmp.path, ".kilo")
    await Bun.write(
      path.join(dir, "resoft-providers.jsonc"),
      `{
        // a comment is fine
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

    const ids = ResoftStarter.listProviders({ dir: tmp.path })
    expect(ids).toContain("corp-llm")
    expect(ids).toContain("resoft")

    const provider = ResoftStarter.resolveProvider({ provider: "corp-llm" }, { dir: tmp.path })
    expect(provider.name).toBe("Corp LLM")
    expect(provider.baseURL).toBe("https://corp.example.com/v1")
    expect(provider.apiKeyEnv).toBe("CORP_API_KEY")
    expect(provider.model.id).toBe("llama-3.3-70b")

    const cfg = ResoftStarter.files({ provider: "corp-llm" }, { dir: tmp.path })
      .find((f) => f.path === "kilo.jsonc")?.content ?? ""
    expect(cfg).toContain('"model": "corp-llm/llama-3.3-70b"')
    expect(cfg).toContain('"baseURL": "https://corp.example.com/v1"')
  })

  test("user-global custom provider is discovered when KILO_CONFIG_DIR is set", async () => {
    await using tmp = await tmpdir()
    const prev = process.env["KILO_CONFIG_DIR"]
    process.env["KILO_CONFIG_DIR"] = tmp.path
    try {
      await Bun.write(
        path.join(tmp.path, "resoft-providers.jsonc"),
        `{
          "providers": {
            "global-llm": {
              "name": "Global LLM",
              "npm": "@ai-sdk/openai-compatible",
              "baseURL": "https://global.example.com/v1",
              "apiKeyEnv": "GLOBAL_KEY",
              "model": {
                "id": "g-1",
                "name": "G1",
                "toolCall": true,
                "reasoning": false,
                "context": 64000,
                "output": 4000
              }
            }
          }
        }`,
      )

      const ids = ResoftStarter.listProviders({ dir: tmp.path })
      expect(ids).toContain("global-llm")

      const sections = ResoftStarter.listProviderSections({ dir: tmp.path })
      const userIds = sections.user.map((e) => e.provider.id)
      expect(userIds).toContain("global-llm")
      expect(sections.user[0].file).toContain("resoft-providers.jsonc")
    } finally {
      if (prev === undefined) delete process.env["KILO_CONFIG_DIR"]
      else process.env["KILO_CONFIG_DIR"] = prev
    }
  })

  test("project-local overrides user-global when ids collide", async () => {
    await using tmp = await tmpdir()
    const prev = process.env["KILO_CONFIG_DIR"]
    process.env["KILO_CONFIG_DIR"] = tmp.path
    try {
      // User-global: original baseURL
      await Bun.write(
        path.join(tmp.path, "resoft-providers.jsonc"),
        `{
          "providers": {
            "shared": {
              "name": "Shared User",
              "npm": "@ai-sdk/openai-compatible",
              "baseURL": "https://user.example.com/v1",
              "apiKeyEnv": "USER_KEY",
              "model": { "id": "u", "name": "U", "toolCall": true, "reasoning": false, "context": 1, "output": 1 }
            }
          }
        }`,
      )
      // Project-local: override
      const projectDir = path.join(tmp.path, "project")
      await Bun.write(
        path.join(projectDir, ".kilo", "resoft-providers.jsonc"),
        `{
          "providers": {
            "shared": {
              "name": "Shared Project",
              "npm": "@ai-sdk/openai-compatible",
              "baseURL": "https://project.example.com/v1",
              "apiKeyEnv": "PROJECT_KEY",
              "model": { "id": "p", "name": "P", "toolCall": true, "reasoning": false, "context": 2, "output": 2 }
            }
          }
        }`,
      )

      const provider = ResoftStarter.resolveProvider({ provider: "shared" }, { dir: projectDir })
      expect(provider.name).toBe("Shared Project")
      expect(provider.baseURL).toBe("https://project.example.com/v1")
      expect(provider.model.id).toBe("p")

      const sections = ResoftStarter.listProviderSections({ dir: projectDir })
      const allCustom = [...sections.user, ...sections.project].map((e) => e.provider.id)
      expect(allCustom.filter((id) => id === "shared")).toHaveLength(1)
      expect(sections.project.find((e) => e.provider.id === "shared")?.provider.baseURL).toBe(
        "https://project.example.com/v1",
      )
    } finally {
      if (prev === undefined) delete process.env["KILO_CONFIG_DIR"]
      else process.env["KILO_CONFIG_DIR"] = prev
    }
  })

  test("invalid custom provider file surfaces an error and does not crash", async () => {
    await using tmp = await tmpdir()
    const projectDir = path.join(tmp.path, "project")
    await Bun.write(
      path.join(projectDir, ".kilo", "resoft-providers.jsonc"),
      `not-json-at-all`,
    )

    const load = ResoftStarter.loadCustomProviders(projectDir)
    expect(load.files).toContain(path.join(projectDir, ".kilo", "resoft-providers.jsonc"))
    expect(load.errors).toHaveLength(1)
    expect(load.errors[0].file).toContain("resoft-providers.jsonc")
    expect(load.errors[0].message).toMatch(/Invalid custom provider file/)

    // The built-ins must still resolve cleanly.
    const provider = ResoftStarter.resolveProvider({ provider: "deepseek" }, { dir: projectDir })
    expect(provider.id).toBe("deepseek")
  })

  test("missing custom provider files are silently skipped", () => {
    const load = ResoftStarter.loadCustomProviders("/nonexistent/path/that/never/exists")
    expect(load.files).toEqual([])
    expect(Object.keys(load.entries)).toEqual([])
    expect(load.errors).toEqual([])
  })
})
