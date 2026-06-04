import type { Argv } from "yargs"
import { cmd } from "@/cli/cmd/cmd"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import { AppRuntime } from "@/effect/app-runtime"
import { Daemon } from "@/kilocode/daemon/daemon"

function withJson<T>(yargs: Argv<T>) {
  return yargs.option("json", {
    describe: "print daemon details as JSON",
    type: "boolean",
  })
}

function safe(input: Daemon.State | undefined) {
  if (!input) return undefined
  return {
    pid: input.pid,
    hostname: input.hostname,
    port: input.port,
    url: input.url,
    username: input.username,
    version: input.version,
    startedAt: input.startedAt,
    log: input.log,
  }
}

function print(input: Daemon.Status, json?: boolean) {
  if (json) {
    console.log(
      JSON.stringify(
        {
          ...input,
          state: safe(input.state),
        },
        null,
        2,
      ),
    )
    return
  }
  if (!input.running) {
    console.log(input.stale ? `Resoft CodingAgent daemon stale: ${input.reason}` : `Resoft CodingAgent daemon not running`)
    console.log(`state: ${input.file}`)
    if (input.state?.log) console.log(`log: ${input.state.log}`)
    return
  }
  console.log(`Resoft CodingAgent daemon running`)
  console.log(`url: ${input.state?.url}`)
  console.log(`pid: ${input.state?.pid}`)
  console.log(`version: ${input.health?.version ?? input.state?.version}`)
  console.log(`auth: enabled`)
  console.log(`state: ${input.file}`)
  console.log(`log: ${input.state?.log}`)
}

const StartCommand = cmd({
  command: "start",
  describe: "start the local Resoft CodingAgent daemon",
  builder: (yargs) => withJson(withNetworkOptions(yargs)),
  handler: async (args) => {
    const opts = await AppRuntime.runPromise(resolveNetworkOptions(args))
    const result = await Daemon.start(opts)
    if (args.json) {
      print(result, true)
      return
    }
    console.log(result.reused ? "Resoft CodingAgent daemon already running" : "Resoft CodingAgent daemon started")
    print(result)
  },
})

const StatusCommand = cmd({
  command: "status",
  describe: "show local Resoft CodingAgent daemon status",
  builder: (yargs) => withJson(yargs),
  handler: async (args) => {
    print(await Daemon.status(), Boolean(args.json))
  },
})

const StopCommand = cmd({
  command: "stop",
  describe: "stop the local Resoft CodingAgent daemon",
  builder: (yargs) => withJson(yargs),
  handler: async (args) => {
    const result = await Daemon.stop()
    if (args.json) {
      print(result, true)
      return
    }
    console.log(result.stopped ? "Resoft CodingAgent daemon stopped" : "Resoft CodingAgent daemon not running")
  },
})

const RestartCommand = cmd({
  command: "restart",
  describe: "restart the local Resoft CodingAgent daemon",
  builder: (yargs) => withJson(withNetworkOptions(yargs)),
  handler: async (args) => {
    const opts = await AppRuntime.runPromise(resolveNetworkOptions(args))
    const result = await Daemon.restart(opts)
    if (args.json) {
      print(result, true)
      return
    }
    console.log("Resoft CodingAgent daemon restarted")
    print(result)
  },
})

export const DaemonCommand = cmd({
  command: "daemon",
  describe: "manage the local Resoft CodingAgent daemon",
  builder: (yargs: Argv) =>
    yargs.command(StartCommand).command(StatusCommand).command(StopCommand).command(RestartCommand).demandCommand(),
  handler: async () => {},
})
