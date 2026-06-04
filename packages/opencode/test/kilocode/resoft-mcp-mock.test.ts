import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { spawn, type Subprocess } from "bun"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const SERVER_PATH = `${import.meta.dir}/../../src/kilocode/resoft/mcp-mock-server.ts`

type TestClient = {
  client: Client
  proc: Subprocess
}

async function startServer(env: Record<string, string> = {}): Promise<TestClient> {
  const proc = spawn({
    cmd: ["bun", "run", SERVER_PATH],
    stdout: "pipe",
    stderr: "pipe",
    env: { ...(process.env as Record<string, string>), ...env },
  })

  // Wait for the "ready" line on stderr so we know the server is up.
  const ready = new Promise<void>((resolve, reject) => {
    let buf = ""
    const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader()
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += new TextDecoder().decode(value)
          if (buf.includes("resoft-mock-sql ready")) {
            resolve()
            return
          }
        }
      } catch (err) {
        reject(err)
      }
    })()
  })
  await ready

  const client = new Client({ name: "resoft-mcp-mock-test", version: "0.0.0" }, { capabilities: {} })
  const transport = new StdioClientTransport({
    command: "bun",
    args: ["run", SERVER_PATH],
    env: { ...(process.env as Record<string, string>), ...env },
  })
  await client.connect(transport)
  return { client, proc }
}

async function stopServer(handle: TestClient): Promise<void> {
  try {
    await handle.client.close()
  } catch {
    // ignore
  }
  try {
    handle.proc.kill()
  } catch {
    // ignore
  }
}

describe("resoft mock SQL MCP server", () => {
  let handle: TestClient

  beforeAll(async () => {
    handle = await startServer()
  })

  afterAll(async () => {
    await stopServer(handle)
  })

  test("advertises the expected tool surface", async () => {
    const { tools } = await handle.client.listTools()
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(["mock_csv_list", "mock_sql_query"])
  })

  test("mock_sql_query SHOW TABLES returns the dataset table list", async () => {
    const result = await handle.client.callTool({ name: "mock_sql_query", arguments: { sql: "SHOW TABLES" } })
    const text = (result.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? "")
      .join("")
    const parsed = JSON.parse(text) as { tables: string[]; dataset: string }
    expect(parsed.dataset).toBe("regulatory_demo")
    expect(parsed.tables).toContain("regulatory_demo")
  })

  test("mock_sql_query SELECT … FROM returns mock rows with columns", async () => {
    const result = await handle.client.callTool({
      name: "mock_sql_query",
      arguments: { sql: "SELECT * FROM regulatory_demo", row_limit: 2 },
    })
    const text = (result.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? "")
      .join("")
    const parsed = JSON.parse(text) as { rows: string[][]; columns: string[]; table: string }
    expect(parsed.table).toBe("regulatory_demo")
    expect(parsed.columns).toContain("metric_code")
    expect(parsed.rows).toHaveLength(2)
  })

  test("mock_sql_query COUNT(*) returns row count without payload", async () => {
    const result = await handle.client.callTool({
      name: "mock_sql_query",
      arguments: { sql: "SELECT COUNT(*) FROM loan_portfolio" },
    })
    const text = (result.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? "")
      .join("")
    const parsed = JSON.parse(text) as { count: number; table: string }
    expect(parsed.table).toBe("loan_portfolio")
    expect(parsed.count).toBe(3)
  })

  test("mock_sql_query against an unknown table returns an empty rows envelope", async () => {
    const result = await handle.client.callTool({
      name: "mock_sql_query",
      arguments: { sql: "SELECT * FROM does_not_exist" },
    })
    const text = (result.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? "")
      .join("")
    const parsed = JSON.parse(text) as { rows: unknown[]; note: string }
    expect(parsed.rows).toEqual([])
    expect(parsed.note).toMatch(/not found/)
  })

  test("mock_csv_list returns three synthetic CSV files", async () => {
    const result = await handle.client.callTool({ name: "mock_csv_list", arguments: { dir: "/data" } })
    const text = (result.content as Array<{ type: string; text?: string }>)
      .map((c) => c.text ?? "")
      .join("")
    const parsed = JSON.parse(text) as { files: Array<{ name: string; rows: number }> }
    expect(parsed.files).toHaveLength(3)
    for (const f of parsed.files) {
      expect(f.name).toMatch(/^regulatory_demo_.*\.csv$/)
      expect(f.rows).toBeGreaterThan(0)
    }
  })
})

describe("resoft mock SQL MCP server error lane", () => {
  let handle: TestClient

  beforeAll(async () => {
    handle = await startServer({ RESOFT_MOCK_FAIL_QUERY: "1" })
  })

  afterAll(async () => {
    await stopServer(handle)
  })

  test("RESOFT_MOCK_FAIL_QUERY=1 makes mock_sql_query report isError", async () => {
    const result = await handle.client.callTool({
      name: "mock_sql_query",
      arguments: { sql: "SELECT * FROM regulatory_demo" },
    })
    expect(result.isError).toBe(true)
  })
})
