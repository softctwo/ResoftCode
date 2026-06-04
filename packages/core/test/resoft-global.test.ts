// resoft_change - new file
import { describe, expect, test } from "bun:test"
import os from "os"
import path from "path"

describe("Resoft global paths", () => {
  test("uses ~/.resoft when launched through the Resoft wrapper", async () => {
    const prev = process.env.RESOFT_CLI
    try {
      process.env.RESOFT_CLI = "1"
      const file = `${import.meta.dir}/../src/global.ts?resoft=${Date.now()}`
      const { Global } = await import(file)
      expect(Global.Path.config).toBe(path.join(os.homedir(), ".resoft"))
    } finally {
      if (prev === undefined) delete process.env.RESOFT_CLI
      else process.env.RESOFT_CLI = prev
    }
  })
})
