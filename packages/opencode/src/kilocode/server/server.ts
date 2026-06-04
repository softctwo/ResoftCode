// kilocode_change - new file
// Kilo-specific overrides for the server control plane.
// Imported by ../../server/server.ts with minimal kilocode_change markers.

import { Brand } from "@/kilocode/brand"

/** Additional CORS origin check for *.kilo.ai */
export function corsOrigin(input: string): string | undefined {
  if (/^https:\/\/([a-z0-9-]+\.)*kilo\.ai$/.test(input)) {
    return input
  }
  return undefined
}

export const DOC_TITLE = Brand.product
export const DOC_DESCRIPTION = `${Brand.product} API`
