#!/usr/bin/env node
/**
 * Writes the API's seed files and the frontend contract files from src/ (see backend/seed/README.md):
 *
 *   node backend/seed/export.mjs
 *
 * No extra npm packages: Vite (already a dev dependency) loads the TypeScript data modules with the "@" alias, the
 * same way the tests do. buildSeed.ts builds the seed and parity files, frontendTypes.ts the contract file.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(backend, '..')

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  resolve: { alias: { '@': join(root, 'src') } },
  optimizeDeps: { noDiscovery: true, include: [] },
})

try {
  const { buildSeedFiles, formatJson } = await server.ssrLoadModule('/backend/seed/buildSeed.ts')
  const { extractFrontendContract, contractSources } = await server.ssrLoadModule('/backend/contracts/frontendTypes.ts')

  const files = buildSeedFiles()
  files['contracts/frontend-types.json'] = extractFrontendContract(
    Object.fromEntries(contractSources.map((path) => [path, readFileSync(join(root, path), 'utf8')])),
  )

  for (const [path, content] of Object.entries(files)) {
    const target = join(backend, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, formatJson(content))
    console.log(`wrote backend/${path}`)
  }
} finally {
  await server.close()
}
