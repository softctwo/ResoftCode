import path from "path"
import fs from "fs/promises"
import { existsSync, readFileSync } from "fs"
import { type ParseError as JsoncParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser"
import { Global } from "@opencode-ai/core/global"
import { Brand } from "@/kilocode/brand"

export namespace ResoftStarter {
  export type File = {
    path: string
    content: string
  }

  export type Result = {
    written: string[]
    skipped: string[]
    files: File[]
  }

  export type CheckStatus = "pass" | "warn" | "fail"

  export type Check = {
    id: string
    status: CheckStatus
    message: string
  }

  export type Validation = {
    dir: string
    ready: boolean
    checks: Check[]
  }

  export type ProviderModel = {
    id: string
    name: string
    toolCall: boolean
    reasoning: boolean
    context: number
    output: number
  }

  export type Provider = {
    id: string
    name: string
    npm: string
    baseURL: string
    apiKeyEnv: string
    model: ProviderModel
  }

  export type ProviderInput = {
    provider?: string
    baseURL?: string
    apiKeyEnv?: string
    model?: string
    modelName?: string
  }

  export type ResolveOptions = {
    // Project directory used to discover project-level custom providers.
    // Global custom providers are loaded from `Global.Path.config` regardless.
    dir?: string
  }

  export type InstallInput = {
    dir: string
    force?: boolean
    dry?: boolean
    provider?: ProviderInput
  }

  export type ValidateInput = {
    dir: string
    strictEnv?: boolean
  }

  export type CustomProviderSource = "user" | "project"

  export type CustomProviderEntry = {
    provider: Provider
    source: CustomProviderSource
    file: string
  }

  export type CustomProviderLoad = {
    entries: Record<string, CustomProviderEntry>
    files: string[]
    errors: Array<{ file: string; message: string }>
  }

  export type ProviderListSection = {
    builtin: Provider[]
    user: Array<CustomProviderEntry>
    project: Array<CustomProviderEntry>
  }

  // Built-in provider presets. Add a new entry here to support a new
  // OpenAI-compatible provider without touching CLI or template code.
  // All presets use @ai-sdk/openai-compatible because the listed providers
  // expose an OpenAI-shaped /v1 chat completions endpoint.
  const PRESETS: Record<string, Provider> = {
    resoft: {
      id: "resoft",
      name: "Resoft Coding Plan",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "http://127.0.0.1:8000/v1",
      apiKeyEnv: "RESOFT_API_KEY",
      model: {
        id: "coding-plan",
        name: "Coding Plan Local",
        toolCall: true,
        reasoning: true,
        context: 128000,
        output: 16000,
      },
    },
    deepseek: {
      id: "deepseek",
      name: "DeepSeek",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      model: {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        toolCall: true,
        reasoning: true,
        context: 128000,
        output: 16000,
      },
    },
    openai: {
      id: "openai",
      name: "OpenAI",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      model: {
        id: "gpt-4o",
        name: "GPT-4o",
        toolCall: true,
        reasoning: false,
        context: 128000,
        output: 16000,
      },
    },
    moonshot: {
      id: "moonshot",
      name: "Moonshot Kimi",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "https://api.moonshot.cn/v1",
      apiKeyEnv: "MOONSHOT_API_KEY",
      model: {
        id: "kimi-k2-0711-preview",
        name: "Kimi K2",
        toolCall: true,
        reasoning: false,
        context: 128000,
        output: 16000,
      },
    },
    zhipu: {
      id: "zhipu",
      name: "Zhipu GLM",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      apiKeyEnv: "ZHIPU_API_KEY",
      model: {
        id: "glm-4.5",
        name: "GLM-4.5",
        toolCall: true,
        reasoning: true,
        context: 128000,
        output: 16000,
      },
    },
    qwen: {
      id: "qwen",
      name: "Alibaba Qwen (DashScope)",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKeyEnv: "DASHSCOPE_API_KEY",
      model: {
        id: "qwen3-coder-plus",
        name: "Qwen3 Coder Plus",
        toolCall: true,
        reasoning: true,
        context: 128000,
        output: 16000,
      },
    },
    ollama: {
      id: "ollama",
      name: "Ollama (local)",
      npm: "@ai-sdk/openai-compatible",
      baseURL: "http://127.0.0.1:11434/v1",
      apiKeyEnv: "OLLAMA_API_KEY",
      model: {
        id: "qwen2.5-coder:32b",
        name: "Qwen 2.5 Coder 32B (local)",
        toolCall: true,
        reasoning: false,
        context: 32000,
        output: 8000,
      },
    },
  }

  // Resolve the well-known file paths for custom provider definitions, in
  // load order (lowest to highest precedence):
  //   1. User-global:   $KILO_CONFIG_DIR/resoft-providers.jsonc (or ~/.config/kilo/...)
  //   2. Project-local: <dir>/.kilo/resoft-providers.jsonc
  // The project file overrides the user file when both define the same id.
  export function customProviderPaths(dir?: string): string[] {
    const out: string[] = []
    out.push(path.join(Global.make().config, "resoft-providers.jsonc"))
    if (dir) out.push(path.join(dir, ".kilo", "resoft-providers.jsonc"))
    return out
  }

  function readProviderFile(file: string): Record<string, Provider> {
    const text = readFileSync(file, "utf8")
    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const first = errors[0]
      const before = text.substring(0, first.offset).split("\n")
      const line = before.length
      const column = before[before.length - 1].length + 1
      const msg = `${printParseErrorCode(first.error)} at line ${line}, column ${column}`
      throw new Error(`Invalid custom provider file ${file}: ${msg}`)
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Invalid custom provider file ${file}: expected an object with a "providers" field`)
    }
    const raw = (data as { providers?: unknown }).providers
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Invalid custom provider file ${file}: "providers" must be an object`)
    }
    const result: Record<string, Provider> = {}
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue
      const v = value as Record<string, unknown>
      if (typeof v.name !== "string") {
        throw new Error(`Invalid custom provider "${id}" in ${file}: "name" is required`)
      }
      if (typeof v.npm !== "string") {
        throw new Error(`Invalid custom provider "${id}" in ${file}: "npm" is required`)
      }
      if (typeof v.baseURL !== "string") {
        throw new Error(`Invalid custom provider "${id}" in ${file}: "baseURL" is required`)
      }
      if (typeof v.apiKeyEnv !== "string") {
        throw new Error(`Invalid custom provider "${id}" in ${file}: "apiKeyEnv" is required`)
      }
      const m = v.model as Record<string, unknown> | undefined
      if (!m || typeof m !== "object" || Array.isArray(m)) {
        throw new Error(`Invalid custom provider "${id}" in ${file}: "model" is required`)
      }
      if (typeof m.id !== "string" || typeof m.name !== "string") {
        throw new Error(`Invalid custom provider "${id}" in ${file}: "model.id" and "model.name" are required`)
      }
      result[id] = {
        id,
        name: v.name,
        npm: v.npm,
        baseURL: v.baseURL,
        apiKeyEnv: v.apiKeyEnv,
        model: {
          id: m.id,
          name: m.name,
          toolCall: Boolean(m.toolCall),
          reasoning: Boolean(m.reasoning),
          context: typeof m.context === "number" ? m.context : 0,
          output: typeof m.output === "number" ? m.output : 0,
        },
      }
    }
    return result
  }

  export function loadCustomProviders(dir?: string): CustomProviderLoad {
    const entries: Record<string, CustomProviderEntry> = {}
    const files: string[] = []
    const errors: Array<{ file: string; message: string }> = []
    for (const file of customProviderPaths(dir)) {
      if (!existsSync(file)) continue
      files.push(file)
      const source: CustomProviderSource = file === customProviderPaths(dir)[0] ? "user" : "project"
      try {
        const parsed = readProviderFile(file)
        for (const [id, provider] of Object.entries(parsed)) {
          entries[id] = { provider, source, file }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        errors.push({ file, message })
      }
    }
    return { entries, files, errors }
  }

  function mergedPresets(options: ResolveOptions = {}): Record<string, Provider> {
    const out: Record<string, Provider> = { ...PRESETS }
    if (options.dir) {
      const custom = loadCustomProviders(options.dir)
      for (const entry of Object.values(custom.entries)) {
        out[entry.provider.id] = entry.provider
      }
    }
    return out
  }

  export function listProviders(options: ResolveOptions = {}): string[] {
    return Object.keys(mergedPresets(options))
  }

  export function listProviderSections(options: ResolveOptions = {}): ProviderListSection {
    const builtin: Provider[] = Object.values(PRESETS)
    const user: Array<CustomProviderEntry> = []
    const project: Array<CustomProviderEntry> = []
    if (options.dir) {
      const custom = loadCustomProviders(options.dir)
      for (const entry of Object.values(custom.entries)) {
        if (entry.source === "project") project.push(entry)
        else user.push(entry)
      }
      // Stable order within each section by id.
      const byId = (a: CustomProviderEntry, b: CustomProviderEntry) => a.provider.id.localeCompare(b.provider.id)
      user.sort(byId)
      project.sort(byId)
    }
    return { builtin, user, project }
  }

  export function resolveProvider(input: ProviderInput = {}, options: ResolveOptions = {}): Provider {
    const presets = mergedPresets(options)
    const presetId = input.provider ?? "resoft"
    const preset = presets[presetId]
    if (!preset) {
      const known = Object.keys(presets).join(", ")
      throw new Error(`Unknown provider preset "${presetId}". Known presets: ${known}`)
    }
    return {
      ...preset,
      baseURL: input.baseURL ?? preset.baseURL,
      apiKeyEnv: input.apiKeyEnv ?? preset.apiKeyEnv,
      model: {
        ...preset.model,
        id: input.model ?? preset.model.id,
        name: input.modelName ?? preset.model.name,
      },
    }
  }

  const agents = [
    {
      id: "business-analyst",
      tools: ["read", "glob", "grep", "todowrite", "skill"],
      description: "Regulatory reporting business analysis agent.",
      prompt:
        "Map regulatory requirements to reporting scope, data owners, business terms, rules, assumptions, and open questions. Produce an acceptance-ready business contract with field-level interpretation and traceability.",
    },
    {
      id: "quality-analyst",
      tools: ["read", "glob", "grep", "bash", "todowrite", "skill"],
      description: "Data quality analysis agent.",
      prompt:
        "Analyze source data quality for completeness, uniqueness, consistency, timeliness, validity, and reconciliation risk. Produce executable quality checks, thresholds, exception handling, and evidence requirements.",
    },
    {
      id: "etl-developer",
      tools: ["read", "write", "edit", "glob", "grep", "bash", "todowrite", "skill"],
      description: "ETL development agent.",
      prompt:
        "Design and implement regulatory ETL logic from source contracts to target reporting datasets. Prefer explicit transformations, idempotent jobs, lineage notes, and rollback-safe scripts.",
    },
    {
      id: "data-tester",
      tools: ["read", "write", "edit", "glob", "grep", "bash", "todowrite", "skill"],
      description: "Data testing agent.",
      prompt:
        "Create data tests for mappings, joins, aggregates, boundaries, null handling, historical periods, reconciliation totals, and regulatory output assertions. Report pass/fail evidence and residual risk.",
    },
    {
      id: "testdata-builder",
      tools: ["read", "write", "edit", "glob", "grep", "bash", "todowrite"],
      description: "Test data construction agent.",
      prompt:
        "Construct compact test datasets that cover normal cases, edge cases, bad data, missing data, reconciliation breaks, and regulation-specific scenarios. Keep fixtures deterministic and auditable.",
    },
    {
      id: "script-developer",
      tools: ["read", "write", "edit", "glob", "grep", "bash", "todowrite"],
      description: "Script development agent.",
      prompt:
        "Build operational scripts for validation, export, packaging, comparison, scheduling support, and evidence collection. Keep scripts parameterized, logged, and repeatable.",
    },
    {
      id: "data-analyst",
      tools: ["read", "glob", "grep", "bash", "todowrite", "skill"],
      description: "Data analysis agent.",
      prompt:
        "Investigate metric changes, source-to-report variances, anomaly drivers, and trend breaks. Produce concise analysis with reviewed dimensions, denominators, sample sizes, and caveats.",
    },
    {
      id: "regulatory-reporter",
      tools: ["read", "glob", "grep", "todowrite", "skill"],
      description: "Regulatory reporting agent.",
      prompt:
        "Assemble the final regulatory reporting package: target files, validation result, reconciliation summary, evidence manifest, unresolved issues, and sign-off checklist.",
    },
    {
      id: "regulation-interpreter",
      tools: ["read", "glob", "grep", "webfetch", "todowrite", "skill"],
      description: "Regulation interpretation agent.",
      prompt:
        "Interpret policies, regulatory notices, and reporting instructions. Extract obligations, scope, deadlines, field definitions, exceptions, and change impact without inventing unstated rules.",
    },
  ] as const

  const command = `---
description: Run the ${Brand.product} regulatory reporting V1 delivery workflow
agent: build
---
# ${Brand.product} Regulatory Reporting V1

User request:
$ARGUMENTS

Run a CLI-first regulatory reporting delivery loop. Treat this as an implementation workflow, not a brainstorming session.

## Required Inputs

If any required input is missing, create a short "missing inputs" section first and proceed with reasonable placeholders only where the work remains reversible.

- Regulation or reporting scope
- Target report/table/file name
- Source systems, tables, files, or sample data
- Reporting period and organization scope
- Expected output format
- Current codebase or script location

## Agent Workflow

Use the specialized agents as bounded lanes:

- @regulation-interpreter: extract reporting obligations, field definitions, deadlines, and interpretation risks.
- @business-analyst: turn obligations into business terms, mappings, assumptions, owners, and acceptance criteria.
- @quality-analyst: define source and target data quality checks with thresholds and exception rules.
- @etl-developer: implement or update ETL logic, SQL, jobs, transformations, or mapping files.
- @testdata-builder: create deterministic fixtures for normal, edge, and bad-data cases.
- @data-tester: implement and run tests for mappings, calculations, quality checks, and report assertions.
- @script-developer: implement operational scripts for validation, export, comparison, and evidence collection.
- @data-analyst: investigate variances, anomalies, reconciliation breaks, and metric movements.
- @regulatory-reporter: assemble the final delivery evidence and reporting package.

## Evidence Manifest

Produce a final manifest with:

- Scope and assumptions
- Source inputs reviewed
- Files changed or generated
- Commands run
- Tests and validation evidence
- Data quality results
- Reconciliation result
- Exceptions and residual risk
- Human review checkpoints
- Promotion or submission readiness

## Stop Condition

Stop only when the deliverable is either ready for review with evidence, or blocked by a specific missing input that cannot be inferred safely.
`

  function buildConfig(provider: Provider): string {
    const modelRef = `${provider.id}/${provider.model.id}`
    return `{
  "$schema": "https://app.kilo.ai/config.json",
  "model": "${modelRef}",
  "subagent_model": "${modelRef}",
  "enabled_providers": ["${provider.id}"],
  "provider": {
    "${provider.id}": {
      "name": "${provider.name}",
      "npm": "${provider.npm}",
      "options": {
        "apiKey": "{env:${provider.apiKeyEnv}}",
        "baseURL": "${provider.baseURL}",
        "timeout": 300000
      },
      "models": {
        "${provider.model.id}": {
          "name": "${provider.model.name}",
          "tool_call": ${provider.model.toolCall},
          "reasoning": ${provider.model.reasoning},
          "limit": {
            "context": ${provider.model.context},
            "output": ${provider.model.output}
          }
        }
      }
    }
  }
}
`
  }

  function buildAgent(agent: (typeof agents)[number], provider: Provider): string {
    const modelRef = `${provider.id}/${provider.model.id}`
    // Deny-by-default tool allowlist: anything not listed is denied.
    // Mirrors the convention used by `.opencode/agent/triage.md` and keeps
    // each regulatory agent scoped to the tools its role actually needs.
    const toolEntries = [`  "*": false`, ...agent.tools.map((t) => `  "${t}": true`)]
    const toolsBlock = toolEntries.join("\n")
    return `---
description: ${agent.description}
mode: subagent
model: "${modelRef}"
tools:
${toolsBlock}
---
You are the ${Brand.product} ${agent.id} agent.

${agent.prompt}

Rules:
- Keep outputs contract-first and evidence-backed.
- Prefer executable checks, concrete file paths, and reviewed assumptions.
- Surface missing authority, missing source data, and unsafe inference explicitly.
- Do not submit or promote regulatory outputs without a human review checkpoint.
`
  }

  export function files(input: ProviderInput = {}, options: ResolveOptions = {}): File[] {
    const provider = resolveProvider(input, options)
    return [
      { path: "kilo.jsonc", content: buildConfig(provider) },
      { path: ".kilo/command/regulatory-reporting-v1.md", content: command },
      ...agents.map((agent) => ({
        path: `.kilo/agent/${agent.id}.md`,
        content: buildAgent(agent, provider),
      })),
    ]
  }

  async function file(path: string): Promise<boolean> {
    return Bun.file(path).exists()
  }

  function parseConfig(text: string, target: string): unknown {
    const errors: JsoncParseError[] = []
    const data = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const first = errors[0]
      const before = text.substring(0, first.offset).split("\n")
      const line = before.length
      const column = before[before.length - 1].length + 1
      const msg = `${printParseErrorCode(first.error)} at line ${line}, column ${column}`
      throw new Error(`${target}: ${msg}`)
    }
    return data
  }

  function value(data: unknown, key: string): unknown {
    if (!data || typeof data !== "object" || Array.isArray(data)) return undefined
    return (data as Record<string, unknown>)[key]
  }

  function providerOf(model: unknown): string | undefined {
    if (typeof model !== "string") return undefined
    const [provider, id] = model.split("/")
    if (!provider || !id) return undefined
    return provider
  }

  function envOf(apiKey: unknown): string | undefined {
    if (typeof apiKey !== "string") return undefined
    const match = apiKey.match(/^\{env:([A-Z0-9_]+)\}$/)
    return match?.[1]
  }

  export async function validate(input: ValidateInput): Promise<Validation> {
    const checks: Check[] = []
    const add = (id: string, status: CheckStatus, message: string) => checks.push({ id, status, message })
    const root = input.dir
    const required = files().map((item) => item.path)
    const missing = (
      await Promise.all(
        required.map(async (item) => ({
          item,
          ok: await file(path.join(root, item)),
        })),
      )
    )
      .filter((item) => !item.ok)
      .map((item) => item.item)
    if (missing.length) add("files", "fail", `missing starter files: ${missing.join(", ")}`)
    else add("files", "pass", "all starter files are present")

    const cfgPath = path.join(root, "kilo.jsonc")
    const cfg = await file(cfgPath)
      ? parseConfig(await Bun.file(cfgPath).text(), "kilo.jsonc")
      : undefined
    if (!cfg) {
      add("config", "fail", "kilo.jsonc is missing or unreadable")
    } else {
      add("config", "pass", "kilo.jsonc parses as JSONC")
    }

    const model = value(cfg, "model")
    const provider = providerOf(model)
    const sub = value(cfg, "subagent_model")
    if (!provider) add("model", "fail", "model must use provider/model format")
    else add("model", "pass", `active model is ${model}`)
    if (sub !== model) add("subagent_model", "warn", "subagent_model should match model for the V1 starter")
    else add("subagent_model", "pass", "subagent_model matches model")

    const enabled = value(cfg, "enabled_providers")
    if (!provider || !Array.isArray(enabled) || !enabled.includes(provider)) {
      add("enabled_providers", "fail", "enabled_providers must include the active provider")
    } else {
      add("enabled_providers", "pass", `enabled provider includes ${provider}`)
    }

    const providers = value(cfg, "provider")
    const block = provider && providers && typeof providers === "object" && !Array.isArray(providers)
      ? (providers as Record<string, unknown>)[provider]
      : undefined
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      add("provider", "fail", "active provider block is missing")
    } else {
      const opts = value(block, "options")
      const apiKey = opts && typeof opts === "object" && !Array.isArray(opts) ? value(opts, "apiKey") : undefined
      const baseURL = opts && typeof opts === "object" && !Array.isArray(opts) ? value(opts, "baseURL") : undefined
      const env = envOf(apiKey)
      if (!env) add("apiKey", "fail", "provider apiKey must use {env:NAME}")
      else if (input.strictEnv && !process.env[env]) add("apiKey", "fail", `${env} is not set`)
      else if (!process.env[env]) add("apiKey", "warn", `${env} is not set`)
      else add("apiKey", "pass", `${env} is set`)
      if (typeof baseURL === "string" && baseURL.length > 0) add("baseURL", "pass", `provider baseURL is ${baseURL}`)
      else add("baseURL", "fail", "provider baseURL is missing")
    }

    const cmd = path.join(root, ".kilo/command/regulatory-reporting-v1.md")
    if (await file(cmd)) {
      const text = await Bun.file(cmd).text()
      if (text.includes("Evidence Manifest") && text.includes("@regulatory-reporter")) {
        add("command", "pass", "regulatory-reporting-v1 command includes workflow and evidence manifest")
      } else {
        add("command", "fail", "regulatory-reporting-v1 command is incomplete")
      }
    } else {
      add("command", "fail", "regulatory-reporting-v1 command is missing")
    }

    const bad = (
      await Promise.all(
        agents.map(async (agent) => {
          const target = path.join(root, ".kilo/agent", `${agent.id}.md`)
          if (!(await file(target))) return agent.id
          const text = await Bun.file(target).text()
          if (!text.includes("mode: subagent")) return agent.id
          if (typeof model === "string" && !text.includes(`model: "${model}"`)) return agent.id
          return undefined
        }),
      )
    ).filter((item) => item !== undefined)
    if (bad.length) add("agents", "fail", `invalid agent files: ${bad.join(", ")}`)
    else add("agents", "pass", "all V1 agent files are valid")

    return {
      dir: root,
      ready: checks.every((item) => item.status !== "fail"),
      checks,
    }
  }

  export async function install(input: InstallInput): Promise<Result> {
    const list = files(input.provider, { dir: input.dir })
    const pairs = await Promise.all(
      list.map(async (file) => {
        const target = path.join(input.dir, file.path)
        const exists = await Bun.file(target).exists()
        if (exists && !input.force) return { file, status: "skipped" as const }
        if (!input.dry) {
          await fs.mkdir(path.dirname(target), { recursive: true })
          await Bun.write(target, file.content)
        }
        return { file, status: "written" as const }
      }),
    )
    return {
      files: list,
      written: pairs.filter((item) => item.status === "written").map((item) => item.file.path),
      skipped: pairs.filter((item) => item.status === "skipped").map((item) => item.file.path),
    }
  }
}
