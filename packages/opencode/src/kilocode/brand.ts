// kilocode_change - new file
export const Brand = {
  name: "Resoft",
  product: "Resoft CodingAgent",
  cliTitle: "Resoft CLI",
  // Canonical CLI binary name. `resoft`, `kilo`, and `kilocode` remain installed as
  // backward-compatible aliases via the npm `bin` map.
  cli: "resoftcode",
  // Configuration skill name is intentionally kept as `kilo-config` so
  // existing `.kilo/...` config files keep working across the rebrand.
  configSkill: "kilo-config",
  tagline: "Regulatory delivery coding agent",
  repository: "https://github.com/softctwo/Resoftcode",
  issues: "https://github.com/softctwo/Resoftcode/issues",
  cliAliases: ["resoft", "kilo", "kilocode"] as const,
}
