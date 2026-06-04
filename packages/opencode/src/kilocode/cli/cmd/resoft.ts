import path from "path"
import fs from "fs/promises"
import { cmd } from "@/cli/cmd/cmd"
import { UI } from "@/cli/ui"
import { Brand } from "@/kilocode/brand"
import { ResoftStarter } from "@/kilocode/resoft/starter"

function formatRow(provider: ResoftStarter.Provider): string {
  const ref = `${provider.id}/${provider.model.id}`
  const baseURL = provider.baseURL
  return `  ${provider.id.padEnd(12)} ${provider.name.padEnd(28)} ${ref.padEnd(36)} ${baseURL.padEnd(40)} ${provider.apiKeyEnv}`
}

function formatCustomRow(provider: ResoftStarter.Provider, source: string): string {
  const ref = `${provider.id}/${provider.model.id}`
  return `  ${provider.id.padEnd(12)} ${provider.name.padEnd(28)} ${ref.padEnd(36)} ${source}`
}

function self() {
  const script = process.argv[1]
  if (script && /\.(ts|js|mjs|cjs)$/.test(script)) {
    const file = path.isAbsolute(script) ? script : path.resolve(process.cwd(), script)
    const dir = path.dirname(file)
    const root = path.basename(dir) === "src" ? path.dirname(dir) : process.cwd()
    return { command: process.execPath, args: [...process.execArgv, file], cwd: root }
  }
  return { command: process.execPath, args: [] as string[], cwd: undefined }
}

function quote(value: string) {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value
  return JSON.stringify(value)
}

function printCommand(command: string, args: string[]) {
  return [command, ...args].map(quote).join(" ")
}

export const ResoftCommand = cmd({
  command: "project",
  aliases: ["resoft"],
  describe: `${Brand.product} project tools`,
  builder: (yargs) =>
    yargs
      .command(
        cmd({
          command: "providers",
          describe: `list available ${Brand.product} model provider presets`,
          builder: (inner) =>
            inner.option("dir", {
              type: "string",
              describe: "project directory used to discover project-level custom providers",
            }),
          handler: async (args) => {
            const dir = args.dir ? path.resolve(args.dir) : undefined
            const sections = ResoftStarter.listProviderSections({ dir })

            UI.println("Built-in providers:")
            if (sections.builtin.length === 0) {
              UI.println("  (none)")
            } else {
              for (const provider of sections.builtin) UI.println(formatRow(provider))
            }

            if (sections.user.length > 0) {
              UI.println("")
              UI.println("Custom providers (user-global):")
              for (const entry of sections.user)
                UI.println(formatCustomRow(entry.provider, entry.file))
            }

            if (sections.project.length > 0) {
              UI.println("")
              UI.println("Custom providers (project-local):")
              for (const entry of sections.project)
                UI.println(formatCustomRow(entry.provider, entry.file))
            }

            if (dir) {
              const custom = ResoftStarter.loadCustomProviders(dir)
              if (custom.errors.length > 0) {
                UI.println("")
                UI.println("Custom provider errors:")
                for (const err of custom.errors) UI.println(`  ${err.file}: ${err.message}`)
              }
            }

            UI.println("")
            UI.println("Use --provider <id> on `resoft init` to apply a preset.")
          },
        }),
      )
      .command(
        cmd({
          command: "init",
          describe: `write ${Brand.product} regulatory reporting V1 templates`,
          builder: (inner) =>
            inner
              .option("dir", {
                type: "string",
                describe: "target project directory",
              })
              .option("force", {
                type: "boolean",
                default: false,
                describe: "overwrite existing starter files",
              })
              .option("dry-run", {
                type: "boolean",
                default: false,
                describe: "print actions without writing files",
              })
              .option("provider", {
                type: "string",
                default: "resoft",
                describe: `provider preset id (run 'resoft providers' to list)`,
              })
              .option("base-url", {
                type: "string",
                describe: "override provider baseURL",
              })
              .option("api-key-env", {
                type: "string",
                describe: "env var name holding the API key",
              })
              .option("model", {
                type: "string",
                describe: "override model id within the chosen provider",
              })
              .option("model-name", {
                type: "string",
                describe: "override model display name",
              })
              // kilocode_change - opt-in: also write a .kilo/mcp.json that wires the
              // resoft mock SQL MCP server so the V1 starter's data-aware
              // agents (quality-analyst, etl-developer, data-tester,
              // data-analyst) have something concrete to call during local
              // development and demos.
              .option("with-mcp", {
                type: "boolean",
                default: false,
                describe: "also write a .kilo/mcp.json that wires the resoft mock SQL MCP server",
              }),
          handler: async (args) => {
            const dir = path.resolve(args.dir ?? process.cwd())
            const providerInput: ResoftStarter.ProviderInput = {
              provider: args.provider,
              baseURL: args["base-url"],
              apiKeyEnv: args["api-key-env"],
              model: args.model,
              modelName: args["model-name"],
            }
            let provider: ResoftStarter.Provider
            try {
              provider = ResoftStarter.resolveProvider(providerInput, { dir })
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              UI.error(msg)
              process.exitCode = 2
              return
            }
            const result = await ResoftStarter.install({
              dir,
              force: args.force,
              dry: args["dry-run"],
              provider: providerInput,
            })
            UI.println(
              `${Brand.product} V1 starter ${args["dry-run"] ? "preview" : "installed"} in ${dir}`,
            )
            UI.println(`  provider: ${provider.id}/${provider.model.id} (${provider.name})`)
            UI.println(`  baseURL:  ${provider.baseURL}`)
            UI.println(`  apiKey:   {env:${provider.apiKeyEnv}}`)
            for (const file of result.written) UI.println(`  write ${file}`)
            for (const file of result.skipped) UI.println(`  skip  ${file}`)
            if (result.skipped.length > 0 && !args.force)
              UI.println("  use --force to overwrite existing files")
            // kilocode_change - opt-in: merge an `mcp` block into kilo.jsonc so
            // the kilo CLI spawns the resoft mock SQL MCP server alongside
            // the model provider. kilo reads MCP config from the `mcp:`
            // field of the project config, not from a separate
            // `.kilo/mcp.json` file, so we update kilo.jsonc in place
            // rather than emitting a sibling file.
            if (args["with-mcp"]) {
              const cfgPath = path.join(dir, "kilo.jsonc")
              if (await Bun.file(cfgPath).exists()) {
                const raw = await Bun.file(cfgPath).text()
                const parsed = JSON.parse(raw) as Record<string, unknown>
                const block = JSON.parse(ResoftStarter.mcpConfigTemplate()) as Record<string, unknown>
                parsed["mcp"] = block
                if (!args["dry-run"]) {
                  await Bun.write(cfgPath, JSON.stringify(parsed, null, 2) + "\n")
                }
                UI.println(`  merge mcp into kilo.jsonc`)
              }
            }
          },
        }),
      )
      .command(
        cmd({
          command: "validate",
          describe: `validate a ${Brand.product} regulatory reporting V1 project`,
          builder: (inner) =>
            inner
              .option("dir", {
                type: "string",
                describe: "target project directory",
              })
              .option("strict-env", {
                type: "boolean",
                default: false,
                describe: "fail when the configured API key env var is not set",
              }),
          handler: async (args) => {
            const dir = path.resolve(args.dir ?? process.cwd())
            const result = await ResoftStarter.validate({
              dir,
              strictEnv: args["strict-env"],
            })
            UI.println(`${Brand.product} V1 validation ${result.ready ? "passed" : "failed"} in ${dir}`)
            for (const check of result.checks) {
              UI.println(`  ${check.status.padEnd(4)} ${check.id}: ${check.message}`)
            }
            if (!result.ready) process.exitCode = 1
          },
        }),
      )
      .command(
        ResoftStartCommand,
      )
      .demandCommand(),
  handler: () => {},
})

export const ResoftStartCommand = cmd({
  command: "start [message..]",
  describe: `start ${Brand.product} in the current terminal`,
  builder: (inner) =>
    inner
      .positional("message", {
        describe: "optional first message to send to the CodingAgent",
        type: "string",
        array: true,
        default: [],
      })
      .option("dir", {
        type: "string",
        describe: "target project directory",
      })
      .option("init", {
        type: "boolean",
        default: true,
        describe: "install the V1 starter pack when missing",
      })
      .option("force-init", {
        type: "boolean",
        default: false,
        describe: "overwrite starter files before starting",
      })
      .option("strict-env", {
        type: "boolean",
        default: true,
        describe: "fail when the configured API key env var is not set",
      })
      .option("dry-run", {
        type: "boolean",
        default: false,
        describe: "print the resolved run command without starting the TUI",
      })
      .option("provider", {
        type: "string",
        default: "resoft",
        describe: `provider preset id used when starter files are installed`,
      })
      .option("base-url", {
        type: "string",
        describe: "override provider baseURL when starter files are installed",
      })
      .option("api-key-env", {
        type: "string",
        describe: "env var name holding the API key when starter files are installed",
      })
      .option("model", {
        type: "string",
        describe: "override model id when starter files are installed",
      })
      .option("model-name", {
        type: "string",
        describe: "override model display name when starter files are installed",
      }),
  handler: async (args) => {
    const dir = path.resolve(args.dir ?? process.cwd())
    const providerInput: ResoftStarter.ProviderInput = {
      provider: args.provider,
      baseURL: args["base-url"],
      apiKeyEnv: args["api-key-env"],
      model: args.model,
      modelName: args["model-name"],
    }
    const exists = await Bun.file(path.join(dir, "kilo.jsonc")).exists()
    if (args.init && (!exists || args["force-init"])) {
      try {
        const result = await ResoftStarter.install({
          dir,
          force: args["force-init"],
          provider: providerInput,
        })
        UI.println(`${Brand.product} V1 starter ready in ${dir}`)
        for (const file of result.written) UI.println(`  write ${file}`)
        for (const file of result.skipped) UI.println(`  keep  ${file}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        UI.error(msg)
        process.exitCode = 2
        return
      }
    }

    const result = await ResoftStarter.validate({
      dir,
      strictEnv: args["strict-env"],
    })
    for (const check of result.checks.filter((check) => check.status !== "pass")) {
      UI.println(`  ${check.status.padEnd(4)} ${check.id}: ${check.message}`)
    }
    if (!result.ready) {
      UI.error(`${Brand.product} is not ready to start; run '${Brand.cli} resoft validate --dir ${dir}'`)
      process.exitCode = 1
      return
    }

    const current = self()
    const msg = [...args.message, ...(args["--"] || [])]
    const run = ["run", "--interactive", "--dir", dir, ...msg]
    UI.println(`${Brand.product} starting in ${dir}`)
    UI.println(`  command: ${printCommand(current.command, [...current.args, ...run])}`)
    if (args["dry-run"]) return

    const child = Bun.spawn([current.command, ...current.args, ...run], {
      cwd: current.cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        RESOFT_CLI: "1",
      },
    })
    const code = await child.exited
    process.exitCode = code
  },
})
