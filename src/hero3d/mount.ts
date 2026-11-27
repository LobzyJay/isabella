/**
 * Isabella hero: the 3D tower inside the one-pager's own hero.
 *
 * The design's hero logic (hb in renderVals) still runs and still computes,
 * every frame, the tower's box, tilt, scan line and callouts. This module
 * reads that box from the DOM and frames a 3D camera so the GLB fills it
 * exactly, then hides the flat cutout and line drawing. Layout, copy,
 * callouts and timing all stay the design's.
 *
 * Rules from the brief:
 *  - no 360 spin: the design's sway becomes a small orbit, clamped
 *  - the roof is never seen from above: the eye always stays below the crown
 *  - one building: the hero backdrop swaps to the tower-free sky plate
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing'

export const HERO3D = {
  /** Isabella v3: v2 geometry with the render's diffuse light baked into lightmaps, plants fitted. */
  model: '/models/isabella_v3.glb',
  modelMobile: '/models/isabella_v3.glb',
  /**
   * Baked lighting (v3 handoff). The maps already hold the diffuse light, so the direct lights drop
   * to a whisper (otherwise light counts twice); the sky env stays for the glossy sheen and glass.
   * gain: tune 0.4–1.5 by eye against the render. Set json to '' to fall back to live lights.
   */
  lightmaps: { json: '/models/lightmaps/lightmaps.json', gain: 0.85, keyLight: 0.25, fillLight: 0.1 },
  plate: './assets/sky-plate.jpg',
  /** crown top in the GLB, metres (handoff says 200; v2 measures 195.8) */
  height: 196,
  /** a little narrower than the reference camera so the crown doesn't foreshorten away */
  fov: 40,
  /** distance from the axis to the tower's front face, metres (v2 drum reaches z ≈ 33) */
  frontRadius: 32,
  /** eye height as a fraction of the tower: handoff reference camera is 4.5 m up, level */
  eye: 0.0225,
  /** the eye never rises above this fraction of the tower (the roof is never seen from above) */
  eyeMax: 0.8,
  /** design rotateY (deg) → camera orbit (deg), clamped so it never spins */
  swayGain: 1.4,
  swayMax: 12,
  /** design rotateX (deg) → camera pitch (deg). 0: pitching makes the verticals converge (reads as a lean) */
  tiltGain: 0,
  /** handoff asks for Neutral at about −1.3 stops; real-time has no light bounce, so we sit a little higher */
  exposure: 0.62,
  /**
   * Cycles bounces the LED and amber soffit light onto the pearl bands; a real-time renderer
   * doesn't, so the bands get that warm bounce as a soft emissive term instead.
   */
  fasciaBounce: { color: '#ffa338', intensity: 0.3, envMapIntensity: 0.3 },
  /** the client rejected glow: at most a very tight, low bloom on the hottest LED points */
  bloom: { intensity: 0.06, threshold: 2.2, smoothing: 0.1 },
  /** reflections: a plain blue-hour gradient (handoff: not a photo HDRI) */
  envIntensity: 2.1,
  /** handoff strengths; matched by material name prefix */
  emissive: { LED_Amber: 3, Soffit_Amber: 2.2, Interior_Ceiling: 4, Interior_Wall: 1.1, PartyWall: 0.8, Lobby_Interior: 2.5 } as Record<string, number>,
  /** handoff: LED colour (1, 0.55, 0.2); party walls get a faint warm glow */
  ledColor: [1, 0.55, 0.2] as [number, number, number],
  partyWallGlow: '#3a2414',
  /** handoff: transparent glass, opacity ~0.5, roughness 0.05 (transmission is too costly on the web) */
  glass: { opacity: 0.58, railOpacity: 0.18, roughness: 0.05, color: '#8fb0f0' },
  /** handoff: satin pearl, must not read as glossy plastic; clearcoat capped */
  fasciaClearcoatMax: 0.5,
  /** base sinks into the plate: alpha fade over the bottom metres */
  baseFade: 10,
  /**
   * When the model has its own ground (plaza, water, landscape), keep the whole base and
   * fade only the ground's far edge into the backdrop, so the tower stands on its floor.
   * The fade follows the ground's own outline (an ellipse measured from the model), as a
   * fraction of it: solid out to `from`, gone by `to`, so no rim or slab edge is ever seen.
   */
  groundFade: { from: 0.45, to: 0.9, below: 3 },
  /** scan band, design px: blueprint from the line up to bandPx, back to the render by featherPx */
  bandPx: 70,
  featherPx: 90,
  traceColor: '#F4B03E',
  floorHeight: 7.06, // 2.33 x 3.03 m (README_HANDOFF)
}

const U = {
  uScanY: { value: 9999 },
  uScanOn: { value: 0 },
  uBand: { value: 10 },
  uFeather: { value: 10 },
  uLineW: { value: 0.4 },
  uFloorH: { value: HERO3D.floorHeight },
  uTrace: { value: new THREE.Color(HERO3D.traceColor) },
  uBaseFade: { value: HERO3D.baseFade },
  uGround: { value: 0 },
  uGroundR0: { value: HERO3D.groundFade.from },
  uGroundR1: { value: HERO3D.groundFade.to },
  uGroundE: { value: new THREE.Vector2(80, 80) },
  uGroundBelow: { value: HERO3D.groundFade.below },
}

const PARS = /* glsl */ `
varying vec3 vIsaW;
varying vec3 vIsaN;
uniform float uScanY, uScanOn, uBand, uFeather, uLineW, uFloorH, uBaseFade, uGround, uGroundR0, uGroundR1, uGroundBelow;
uniform vec3 uTrace;
uniform vec2 uGroundE;
float isaGrid(float v){ float w = fwidth(v); return 1.0 - smoothstep(0.0, 1.5 * w, abs(fract(v - 0.5) - 0.5)); }
`

const POST = /* glsl */ `
{
  float y = vIsaW.y;
  float on = uScanOn;
  float band = smoothstep(uScanY, uScanY + uLineW * 2.0, y) * (1.0 - smoothstep(uScanY + uBand, uScanY + uBand + uFeather, y)) * on;
  if (band > 0.001) {
    // thin gold line work over the real render: floor lines and mullions only, no tint
    float floors = isaGrid(y / uFloorH);
    float a1 = atan(vIsaW.z, vIsaW.x) / 6.2831853 * 72.0;
    float a2 = atan(-vIsaW.z, -vIsaW.x) / 6.2831853 * 72.0;
    float mull = fwidth(a1) < 36.0 ? isaGrid(a1) : isaGrid(a2);
    float lines = max(floors, mull * 0.45);
    gl_FragColor.rgb = mix(gl_FragColor.rgb * mix(1.0, 0.85, band), uTrace * 1.6, lines * band * 0.65);
  }
  // the gold scan line itself is the design's own HTML line, drawn over the canvas
  // the base sinks into the plate (premultiplied for the transparent canvas)
  // no ground in the model: the base sinks into the backdrop (bottom metres fade out)
  float aTower = smoothstep(0.0, uBaseFade, y);
  // model with its own ground: keep the base whole, melt only the ground's far edge
  float edge = 1.0 - smoothstep(uGroundR0, uGroundR1, length(vIsaW.xz / uGroundE));
  // everything low (plaza, curb, planters) follows the edge fade fully; the podium and tower
  // above it are kept whole, blending in over the next few metres
  float aGround = max(edge, smoothstep(uGroundBelow, uGroundBelow * 2.0, y));
  float a = mix(aTower, aGround, uGround);
  gl_FragColor *= a;
}
`

function patch(mat: THREE.Material, emissiveFromVertexColor: boolean) {
  const m = mat as THREE.MeshPhysicalMaterial
  if (emissiveFromVertexColor) {
    m.vertexColors = true
    // vertex colour drives the room light only, not the base colour
    if (!m.emissive || m.emissive.getHex() === 0) m.emissive = new THREE.Color(1, 0.75, 0.45)
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIsaW;\nvarying vec3 vIsaN;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        { vec4 p = vec4(transformed, 1.0);
          vec3 nn = objectNormal;
          #ifdef USE_INSTANCING
            p = instanceMatrix * p; nn = mat3(instanceMatrix) * nn;
          #endif
          vIsaW = (modelMatrix * p).xyz;
          vIsaN = normalize(mat3(modelMatrix) * nn); }`,
      )
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS)
    if (emissiveFromVertexColor) {
      // README: emissive = vertex colour (baked per apartment); keep the diffuse neutral
      f = f.replace('#include <color_fragment>', '')
      f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif')
    }
    f = f.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' + POST)
    sh.fragmentShader = f
  }
  m.customProgramCacheKey = () => 'isa3d-' + (emissiveFromVertexColor ? 'vc' : 'std')
  m.needsUpdate = true
}

/** ~2,400 objects → one mesh per material (README performance note) */
function mergeByMaterial(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const sig = new Map<THREE.Material, string>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) return
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld)
    const s = Object.keys(g.attributes).sort().join()
    const mat = m.material as THREE.Material
    const key = sig.get(mat)
    if (key !== undefined && key !== s) {
      // keep only the attributes every piece shares
      for (const n of Object.keys(g.attributes)) if (!key.split(',').includes(n)) g.deleteAttribute(n)
    }
    if (!sig.has(mat)) sig.set(mat, s)
    if (!groups.has(mat)) groups.set(mat, [])
    groups.get(mat)!.push(g.index ? g : g)
  })
  const out = new THREE.Group()
  for (const [mat, geos] of groups) {
    const common = Object.keys(geos[0].attributes).filter((n) => geos.every((g) => n in g.attributes))
    geos.forEach((g) => Object.keys(g.attributes).forEach((n) => !common.includes(n) && g.deleteAttribute(n)))
    const indexed = geos.every((g) => g.index)
    const list = indexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g))
    const merged = mergeGeometries(list, false)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, mat)
    mesh.name = mat.name
    out.add(mesh)
  }
  return out
}

/** A plain blue-hour sky as an equirect texture: deep blue overhead, a softer blue at the horizon, dark below. */
function blueGradientEnv() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#0d2a6b')
  grad.addColorStop(0.35, '#1f4a99')
  grad.addColorStop(0.49, '#6f8fca')
  grad.addColorStop(0.5, '#3a3d52')
  grad.addColorStop(1, '#0e0c10')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 256)
  const t = new THREE.CanvasTexture(c)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function applyFraming(cam: THREE.PerspectiveCamera, o: { top: number; bot: number; sx: number; az: number; tilt: number }, frameW: number, frameH: number) {
  const H = HERO3D.height
  const span = Math.max(0.05, o.bot - o.top)
  const K = 2 * Math.tan((HERO3D.fov * Math.PI) / 360)
  // Frame on the tower's FRONT face, not its centre line: looking up from street level, the
  // nearer crown edge projects higher, so centre-line framing pushed the crown into the header.
  const dFront = H / (span * K)
  const d = dFront + HERO3D.frontRadius
  const eyeY = Math.min(HERO3D.eyeMax, HERO3D.eye) * H
  const az = (o.az * Math.PI) / 180
  cam.fov = HERO3D.fov
  cam.aspect = frameW / frameH
  cam.position.set(Math.sin(az) * d, eyeY, Math.cos(az) * d)
  cam.lookAt(0, eyeY, 0)
  if (o.tilt) cam.rotateX((o.tilt * Math.PI) / 180)
  cam.near = Math.max(0.5, dFront * 0.05)
  cam.far = d * 4
  cam.updateProjectionMatrix()
  // lens shift keeps the verticals straight (architectural framing)
  const e = cam.projectionMatrix.elements
  e[8] = 1 - 2 * o.sx
  e[9] = 2 * (o.top - 0.5 + (H - eyeY) / (dFront * K))
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()
  cam.updateMatrixWorld()
}

type Read = { x: number; y: number; w: number; h: number; ry: number; rx: number; scanY: number; scanO: number; opacity: string }
type Els = { container: HTMLElement; before: HTMLElement; alive: () => boolean; plate: HTMLImageElement | null; read: () => Read | null }
type Layout = { name: string; frameW: number; frameH: number; bandPx: number; featherPx: number; maxDpr: number; flatCss: string; find: () => Els | null }

const CUT = '071a923d6fdc9229a9386bbec89d4317'
const LINE = '69b048cf8aa4f3e4165ae9466126c943'
const RENDER = '011ef5cbfb41f0246d673125863485ee'

/** Desktop board (1440 x 900): the design writes the tower box into inline styles every frame. */
const DESKTOP: Layout = {
  name: 'desktop',
  frameW: 1440,
  frameH: 900,
  bandPx: HERO3D.bandPx,
  featherPx: HERO3D.featherPx,
  maxDpr: 2,
  flatCss: `html.isa-3d-on #hero img[src*="${CUT}"],html.isa-3d-on #hero img[src*="${LINE}"]{visibility:hidden!important}`,
  find() {
    const cut = document.querySelector<HTMLImageElement>(`#hero img[src*="${CUT}"]`)
    if (!cut) return null
    const tw = cut.parentElement as HTMLElement
    const layer = tw.parentElement as HTMLElement
    const scan = [...layer.children].find((c) => (c as HTMLElement).style.boxShadow?.includes('18px')) as HTMLElement | undefined
    const plate =
      [...document.querySelectorAll<HTMLImageElement>(`#hero img[src*="${RENDER}"], #hero img[src*="sky-plate"]`)].find((i) =>
        i.parentElement?.style.width.startsWith('1760'),
      ) ?? null
    return {
      container: layer,
      before: tw,
      alive: () => tw.isConnected,
      plate,
      read() {
        const st = tw.style
        const tf = st.transform || ''
        return {
          x: parseFloat(st.left),
          y: parseFloat(st.top),
          w: parseFloat(st.width),
          h: parseFloat(st.height),
          ry: parseFloat(/rotateY\(([-\d.]+)deg\)/.exec(tf)?.[1] || '0'),
          rx: parseFloat(/rotateX\(([-\d.]+)deg\)/.exec(tf)?.[1] || '0'),
          scanY: scan ? parseFloat(scan.style.top) : NaN,
          scanO: scan ? parseFloat(scan.style.opacity || '0') : 0,
          opacity: st.opacity || '1',
        }
      },
    }
  },
}

/** Mobile board (390 x 844): the tower box is animated by CSS scroll timelines, so read its live position. */
const MOBILE: Layout = {
  name: 'mobile',
  frameW: 390,
  frameH: 844,
  bandPx: 40,
  featherPx: 50,
  maxDpr: 1.5,
  flatCss: 'html.isa-3d-on .hb .twr,html.isa-3d-on .hb .twl{visibility:hidden!important}',
  find() {
    const stage = document.querySelector<HTMLElement>('.hb .stage')
    const tw = stage?.querySelector<HTMLElement>('.tw')
    if (!stage || !tw) return null
    const scan = stage.querySelector<HTMLElement>('.scan')
    return {
      container: stage,
      // after the tower box: on mobile the backdrop plate lives inside it and must stay behind the 3D
      before: (tw.nextElementSibling as HTMLElement) ?? tw,
      alive: () => tw.isConnected,
      plate: stage.querySelector<HTMLImageElement>('.hri'),
      read() {
        const sr = stage.getBoundingClientRect()
        if (!sr.width) return null
        const k = sr.width / 390 // design px per screen px, whatever the zoom
        const r = tw.getBoundingClientRect()
        const scanR = scan?.getBoundingClientRect()
        return {
          x: (r.left - sr.left) / k,
          y: (r.top - sr.top) / k,
          w: r.width / k,
          h: r.height / k,
          ry: 0,
          rx: 0,
          scanY: scanR ? (scanR.top - sr.top) / k : NaN,
          scanO: scan ? parseFloat(getComputedStyle(scan).opacity) : 0,
          opacity: '1',
        }
      },
    }
  },
}

async function start() {
  // whichever board this page renders
  let L: Layout | null = null
  while (!L) {
    if (document.querySelector('.hb .stage .tw')) L = MOBILE
    else if (document.querySelector(`#hero img[src*="${CUT}"]`)) L = DESKTOP
    else await new Promise((r) => setTimeout(r, 100))
  }
  const layout = L

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'isa-3d'
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: layout.frameW + 'px', height: layout.frameH + 'px', pointerEvents: 'none', opacity: '0', transition: 'opacity .8s ease' })

  // The design runtime may render more than once and discard the first set of
  // elements, so (re)bind whenever the elements we hold are gone.
  let els: Els | null = null
  let ready = false
  const bind = () => {
    if (els && els.alive() && canvas.isConnected) return true
    const f = layout.find()
    if (!f) return false
    els = f
    f.container.insertBefore(canvas, f.before)
    last = ''
    if (ready) hideFlat()
    return true
  }
  // a stylesheet rule survives the runtime re-creating the images
  const flatCss = document.createElement('style')
  flatCss.textContent = layout.flatCss
  document.head.appendChild(flatCss)
  const hideFlat = () => {
    document.documentElement.classList.add('isa-3d-on')
    const plate = els?.plate
    if (plate && !plate.src.includes('sky-plate')) plate.src = HERO3D.plate
  }
  let last = ''
  while (!bind()) await new Promise((r) => setTimeout(r, 100))

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(layout.maxDpr, devicePixelRatio * (parseFloat(document.documentElement.style.zoom) || 1)))
  renderer.setSize(layout.frameW, layout.frameH, false)
  renderer.toneMappingExposure = HERO3D.exposure

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  // handoff: reflections from a plain blue-hour gradient, not a photo HDRI
  scene.environment = pmrem.fromEquirectangular(blueGradientEnv()).texture
  scene.environmentIntensity = HERO3D.envIntensity
  // handoff: only a soft fill plus a warm key from front-left; the building's own glow does the rest
  const key = new THREE.DirectionalLight('#ffd6a8', 1.2)
  key.position.set(-220, 180, 300)
  const fill = new THREE.HemisphereLight('#7d8fc4', '#2a1d14', 0.35)
  scene.add(key, fill)

  const camera = new THREE.PerspectiveCamera(HERO3D.fov, layout.frameW / layout.frameH, 1, 5000)

  // 4x anti-aliasing so thin LED lines and mullions stay crisp (2x on phones)
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, alpha: true, multisampling: layout.name === 'mobile' ? 2 : 4 } as any)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new BloomEffect({ mipmapBlur: true, intensity: HERO3D.bloom.intensity, luminanceThreshold: HERO3D.bloom.threshold, luminanceSmoothing: HERO3D.bloom.smoothing })
  composer.addPass(new EffectPass(camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL })))

  const draco = new DRACOLoader().setDecoderPath('/draco/')
  const [gltf, lm] = await Promise.all([
    new GLTFLoader().setDRACOLoader(draco).loadAsync(layout.name === 'mobile' ? HERO3D.modelMobile : HERO3D.model),
    HERO3D.lightmaps.json ? fetch(HERO3D.lightmaps.json).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null),
  ])
  // Baked parts get their own copy of the material before merging, so they merge only with each
  // other and keep their second UV set (the merge drops attributes the group doesn't share).
  const baked = new Map<THREE.Material, { file: string; lightMapIntensity: number }>()
  if (lm) {
    const copies = new Map<string, THREE.Material>()
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.geometry.attributes.uv1) return
      // multi-material parts load as a Group named LM_* with child meshes
      const key = Object.keys(lm).find((k) => m.name === k || m.parent?.name === k)
      if (!key) return
      const swap = (mat: THREE.Material) => {
        const id = key + '|' + mat.uuid
        if (!copies.has(id)) { const c = mat.clone(); c.name = mat.name; copies.set(id, c); baked.set(c, lm[key]) }
        return copies.get(id)!
      }
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
    })
  }
  const tower = mergeByMaterial(gltf.scene)
  if (baked.size) {
    const tl = new THREE.TextureLoader()
    const tex = new Map<string, THREE.Texture>()
    tower.traverse((o) => {
      const m = o as THREE.Mesh
      const e = m.isMesh ? baked.get(m.material as THREE.Material) : undefined
      if (!e) return
      if (!tex.has(e.file)) {
        const t = tl.load('/models/' + e.file, () => { last = '' })
        t.flipY = false // glTF UV convention
        t.colorSpace = THREE.SRGBColorSpace // stored sRGB-encoded
        t.channel = 1 // TEXCOORD_1
        tex.set(e.file, t)
      }
      const mat = m.material as THREE.MeshStandardMaterial
      mat.lightMap = tex.get(e.file)!
      mat.lightMapIntensity = e.lightMapIntensity * HERO3D.lightmaps.gain
      mat.userData.lmBase = e.lightMapIntensity
      // the bake already holds the soffit/LED bounce, so the v2 stand-in (a warm emissive) goes
      if (mat.name.startsWith('Fascia')) mat.emissiveIntensity = 0
      mat.needsUpdate = true
    })
    key.intensity = HERO3D.lightmaps.keyLight
    fill.intensity = HERO3D.lightmaps.fillLight
  }
  tower.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.MeshPhysicalMaterial
    const name = mat.name || ''
    const k = Object.entries(HERO3D.emissive).find(([n]) => name.startsWith(n))?.[1]
    if (k !== undefined && 'emissiveIntensity' in mat) mat.emissiveIntensity = k
    if (/^(Glass|RailGlass)/.test(name)) {
      mat.transmission = 0
      mat.transparent = true
      mat.opacity = name.startsWith('Rail') ? HERO3D.glass.railOpacity : HERO3D.glass.opacity
      mat.depthWrite = false
      mat.roughness = HERO3D.glass.roughness
      mat.metalness = 0
      if (name === 'Glass') mat.color.set(HERO3D.glass.color)
    }
    if (/^LED/.test(name) && mat.emissive) mat.emissive.setRGB(...HERO3D.ledColor)
    if (name.startsWith('Fascia') && 'clearcoat' in mat) {
      mat.clearcoat = Math.min(mat.clearcoat, HERO3D.fasciaClearcoatMax)
      mat.emissive.set(HERO3D.fasciaBounce.color)
      // baked parts carry the real bounce in their lightmap
      mat.emissiveIntensity = mat.lightMap ? 0 : HERO3D.fasciaBounce.intensity
      // the bands are satin, not mirrors: they keep a little sky, the glass carries the rest
      mat.envMapIntensity = HERO3D.fasciaBounce.envMapIntensity
    }
    if (name.startsWith('PartyWall') && mat.emissive) mat.emissive.set(HERO3D.partyWallGlow)
    patch(m.material as THREE.Material, /^Interior_/.test(name) && !!m.geometry.attributes.color)
  })
  scene.add(tower)
  // does this model bring its own floor?
  let hasGround = false
  tower.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && /^(Plaza|Ground|Water|Terrain|Landscape|Floor)/i.test((m.material as THREE.Material).name || '')) hasGround = true
  })
  U.uGround.value = hasGround ? 1 : 0
  // the ground's outline (plaza ellipse) for the edge fade
  if (hasGround) {
    const gb = new THREE.Box3()
    tower.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && /^(Plaza|Ground|Water|Terrain|Landscape|Floor)/i.test((m.material as THREE.Material).name || '')) {
        m.geometry.computeBoundingBox()
        gb.union(m.geometry.boundingBox!)
      }
    })
    U.uGroundE.value.set(Math.max(Math.abs(gb.min.x), gb.max.x, 1), Math.max(Math.abs(gb.min.z), gb.max.z, 1))
  }
  ;(window as any).__isa3d = {
    scene, renderer, camera, composer, HERO3D, layout: layout.name, U, baked: baked.size,
    /** look-dev: change the lightmap gain live */
    setLightmapGain(g: number) {
      HERO3D.lightmaps.gain = g
      tower.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.userData?.lmBase) m.lightMapIntensity = m.userData.lmBase * g })
      last = ''
    },
    render: () => { last = '' },
    /** look-dev: render from the handoff's reference camera (4.5 m up, 212 m back, level) and return a PNG */
    refShot() {
      // same canvas size as live; the tower is framed in the centre and the page crops it
      const keep = { fov: HERO3D.fov, eye: HERO3D.eye, scan: U.uScanOn.value }
      const H = HERO3D.height
      const top = 0.055, bot = 0.985
      HERO3D.fov = (2 * Math.atan(H / (bot - top) / 2 / 212) * 180) / Math.PI
      HERO3D.eye = 4.5 / H
      U.uScanOn.value = 0
      applyFraming(camera, { top, bot, sx: 0.5, az: 0, tilt: 0 }, layout.frameW, layout.frameH)
      composer.render()
      const url = renderer.domElement.toDataURL('image/png')
      Object.assign(HERO3D, { fov: keep.fov, eye: keep.eye })
      U.uScanOn.value = keep.scan
      last = ''
      return url
    },
  }

  // one building: hide the flat tower and line drawing, swap the backdrop to the tower-free plate
  ready = true
  bind()
  hideFlat()
  canvas.style.opacity = '1'

  const tick = () => {
    requestAnimationFrame(tick)
    if (!bind() || !els) return
    hideFlat()
    const b = els.read()
    if (!b || !isFinite(b.h) || b.h <= 0) return
    const state = [b.x, b.y, b.w, b.h, b.ry, b.rx, b.scanY, b.scanO, b.opacity].map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join()
    if (state === last) return // nothing moved: no redraw, nothing jitters
    last = state
    canvas.style.opacity = b.opacity

    const az = Math.max(-HERO3D.swayMax, Math.min(HERO3D.swayMax, -b.ry * HERO3D.swayGain))
    applyFraming(
      camera,
      { top: b.y / layout.frameH, bot: (b.y + b.h) / layout.frameH, sx: (b.x + b.w / 2) / layout.frameW, az, tilt: b.rx * HERO3D.tiltGain },
      layout.frameW,
      layout.frameH,
    )

    const H = HERO3D.height
    const pxToM = H / b.h
    const scanning = isFinite(b.scanY) && b.scanO > 0.001
    U.uScanOn.value = scanning ? b.scanO : 0
    U.uScanY.value = scanning ? (b.y + b.h - b.scanY) * pxToM : 9999
    U.uBand.value = layout.bandPx * pxToM
    U.uFeather.value = layout.featherPx * pxToM
    U.uLineW.value = 0.8 * pxToM
    composer.render()
  }
  tick()
}

// Version 4 keeps the design's original picture hero: the server on port 5184 (VITE_HERO=picture), or any /v2 path
const pictureHero = import.meta.env.VITE_HERO === 'picture' || location.pathname.startsWith('/v2')
if (!pictureHero) start().catch((e) => console.error('[isabella] 3D hero failed, keeping the flat hero', e))
