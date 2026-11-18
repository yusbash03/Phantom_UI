// Generates TypeScript types from the backend OpenAPI contract (Phantom_API/contracts/openapi.json).
// Override the source with PHANTOM_API_CONTRACT (a path or URL), e.g. a deployed /openapi/v1.json.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = process.env.PHANTOM_API_CONTRACT ?? path.resolve(root, '../../backend/Phantom_API/contracts/openapi.json')
const output = path.resolve(root, 'src/api/generated/schema.ts')

if (!source.startsWith('http') && !existsSync(source)) {
  console.error(`OpenAPI contract not found at ${source}. Build Phantom_API or set PHANTOM_API_CONTRACT.`)
  process.exit(1)
}

execFileSync(path.resolve(root, 'node_modules/.bin/openapi-typescript'), [source, '-o', output], { stdio: 'inherit' })
