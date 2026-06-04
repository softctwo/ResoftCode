// kilocode_change - new file
import { expect, test } from "bun:test"
import { $ } from "bun"
import { tmpdir } from "../fixture/fixture"

test("auth list loads provider catalog with an instance context", async () => {
  await using tmp = await tmpdir()
  const out =
    await $`bun run --conditions=browser ${import.meta.dir}/../../src/index.ts auth list`.cwd(tmp.path).nothrow().text()

  expect(out).not.toContain("No context found for instance")
})

test("Resoft launch does not inherit legacy home config directories", async () => {
  await using tmp = await tmpdir()
  const home = `${tmp.path}/home`
  await Bun.write(`${home}/.opencode/opencode.json`, JSON.stringify({ model: "legacy/bad-model" }))
  await Bun.write(`${tmp.path}/kilo.jsonc`, JSON.stringify({ model: "deepseek/deepseek-v4-pro" }))

  const out =
    await $`bun run --conditions=browser ${import.meta.dir}/../../src/index.ts debug config`
      .cwd(tmp.path)
      .env({ ...process.env, HOME: home, RESOFT_CLI: "1" })
      .text()
  const cfg = JSON.parse(out)

  expect(cfg.model).toBe("deepseek/deepseek-v4-pro")
})
