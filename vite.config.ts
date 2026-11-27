import { defineConfig, type Plugin } from 'vite'

// "/" is the one-pager exactly as exported from the design (public/index.html),
// served as a static file so Vite never rewrites it. The 3D hero
// (src/hero3d/mount.ts) is loaded by that page as a module.
// "/v2/" serves the same pages with the original picture hero instead of the 3D.
const onePagerAtRoot: Plugin = {
  name: 'one-pager-at-root',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      // /v2 is the same site with the original picture hero (no 3D): same files, path kept for the page to read
      if (req.url === '/v2' || req.url?.startsWith('/v2/') || req.url?.startsWith('/v2?')) req.url = '/' + req.url.slice(3).replace(/^\//, '')
      if (req.url === '/' || req.url?.startsWith('/?')) req.url = '/index.html' + (req.url.slice(1) || '')
      next()
    })
  },
}

const picture = process.env.VITE_HERO === 'picture'

export default defineConfig({
  plugins: [onePagerAtRoot],
  appType: 'mpa',
  // 5183: the site with the 3D hero. 5184: Version 4, the design's picture hero.
  server: { port: picture ? 5184 : 5183, strictPort: true },
  cacheDir: picture ? 'node_modules/.vite-v4' : 'node_modules/.vite',
})
