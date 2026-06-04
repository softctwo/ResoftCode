import { describe, expect, test } from "bun:test"
import path from "path"
import { OpenApi } from "effect/unstable/httpapi"
import { Brand } from "../../src/kilocode/brand"
import { ConfigConsoleApi } from "../../src/kilocode/server/httpapi/groups/config-console"

const root = path.join(__dirname, "..", "..")
const groups = [
  "agent-builder",
  "background-process",
  "commit-message",
  "config-console",
  "enhance-prompt",
  "indexing",
  "kilo-gateway",
  "kilocode",
  "network",
  "remote",
  "session-import",
  "suggestion",
  "telemetry",
]

async function src(file: string) {
  return Bun.file(path.join(root, file)).text()
}

describe("Resoft OEM branding", () => {
  test("startup TUI surfaces use the Resoft brand layer", async () => {
    const files = await Promise.all([
      src("src/kilocode/plugins/home-onboarding.tsx"),
      src("src/kilocode/plugins/sidebar-footer.tsx"),
      src("src/kilocode/components/tips.tsx"),
      src("src/kilocode/cli/cmd/tui/app.tsx"),
    ])
    const text = files.join("\n")

    expect(text).toContain("Brand.product")
    expect(text).toContain("Brand.name")
    expect(text).not.toContain("Kilo includes free models")
    expect(text).not.toContain("Ask Kilo")
    expect(text).not.toContain("headless API access to Kilo")
    expect(text).not.toContain('APP_TITLE = "Kilo CLI"')
    expect(text).toContain("APP_TITLE = Brand.cliTitle")
    expect(Brand.cliTitle).toBe("Resoft CLI")
  })

  test("config console metadata uses Resoft product labels", () => {
    const spec = OpenApi.fromApi(ConfigConsoleApi)

    expect(spec.info.title).toBe(`${Brand.product} HttpApi`)
    expect(spec.info.description).toBe(`${Brand.product} HttpApi surface.`)
    expect(JSON.stringify(spec.paths["/config/rules"]?.get)).toContain(Brand.product)
    expect(JSON.stringify(spec.paths["/config/model-state"]?.patch)).toContain(Brand.product)
  })

  test("kilocode HTTP API groups use Resoft product shell metadata", async () => {
    const files = await Promise.all(
      groups.map((group) => src(`src/kilocode/server/httpapi/groups/${group}.ts`)),
    )
    const text = files.join("\n")

    expect(text).not.toContain('title: "kilo HttpApi"')
    expect(text).not.toContain("Kilo HttpApi surface.")
  })
})

describe("Resoft brand constants", () => {
  test("Brand module exposes the expected public surface", () => {
    expect(Brand.name).toBe("Resoft")
    expect(Brand.product).toBe("Resoft CodingAgent")
    expect(Brand.cliTitle).toBe("Resoft CLI")
    expect(Brand.cli).toBe("resoftcode")
    expect(Brand.configSkill).toBe("kilo-config")
    expect(Brand.cliAliases).toEqual(["resoft", "kilo", "kilocode"])
    expect(Brand.repository).toMatch(/^https:\/\/github\.com\/softctwo\/Resoftcode/)
    expect(Brand.issues).toMatch(/^https:\/\/github\.com\/softctwo\/Resoftcode\/issues/)
  })

  test("Brand.product is referenced in user-visible kilocode UI", async () => {
    const root = path.join(__dirname, "..", "..")
    const sidebar = await Bun.file(path.join(root, "src/kilocode/plugins/sidebar-footer.tsx")).text()
    expect(sidebar).toContain("Brand.product")
  })
})
