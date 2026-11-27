// Copies the Draco decoder out of three's examples into /public/draco so a
// Draco-compressed GLB decodes locally (no CDN).
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve('node_modules/three/examples/jsm/libs/draco/gltf')
const dst = resolve('public/draco')
if (existsSync(src)) {
  mkdirSync(dst, { recursive: true })
  cpSync(src, dst, { recursive: true })
  console.log('[isabella] draco decoder copied to public/draco')
}
