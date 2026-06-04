export const dict = {
  "server.processExited": "CLI process exited with code {{code}} before server started",
  "server.startupTimeout": "Server startup timeout after {{seconds}} seconds",
  "remote.connected": "Kilo Remote: Connected",
  "remote.connecting": "Kilo Remote: Connecting\u2026",
  "kilo-code.new.resoftBridge.enabled.description": "Bridge the Kilo Code backend to a system-installed @chinaresoft/resoftcode binary instead of using the CLI bundled with this extension. Useful when you want the Kilo Code VS Code extension to drive the Resoft CodingAgent CLI for regulatory reporting workflows. Leave disabled to keep using the bundled CLI.",
  "kilo-code.new.resoftBridge.prefer.description": "When the Resoft bridge is enabled, which binary name to look up first on PATH. 'auto' tries resoftcode then resoft; the others invert the lookup order. Ignored when 'executablePath' is set explicitly.",
  "kilo-code.new.resoftBridge.executablePath.description": "Absolute path to a specific resoftcode / resoft binary. When set, PATH lookup is skipped. Leave empty to use the resolver above.",
} as const
