/*
 * Isabella mobile one-pager: site behaviour on top of the design export.
 *
 * - Sizing and which board to show live in fit.js.
 * - The design scrolls inside a phone frame. Here the page itself scrolls, so
 *   nothing traps your finger; the scroll animations use view timelines and
 *   follow the page.
 * - The menu icon pointed at a page that isn't in the export; it opens a
 *   full-screen menu sheet instead.
 */
(function () {
  var SECTIONS = [
    ['Residences', '#m-residences'],
    ['Amenities', '#m-amenities'],
    ['Location', '#m-location'],
    ['House of Sujimoto', '.hs'],
    ['Questions', '#m-faq'],
  ]

  var sheet = null
  var opener = null

  function build() {
    sheet = document.createElement('div')
    sheet.className = 'isa-menu'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-label', 'Menu')
    var links = SECTIONS.map(function (s, i) {
      return '<a href="' + (s[1][0] === '#' ? s[1] : '#') + '" data-go="' + s[1] + '" style="--i:' + i + '">' + s[0] + '</a>'
    }).join('')
    sheet.innerHTML =
      '<div class="isa-menu-top"><img src="./assets/936e38004cfd8fff7623561dfdab74ed.png" alt="Isabella"><button type="button" class="isa-menu-close" aria-label="Close menu">✕</button></div>' +
      '<nav>' + links + '</nav>' +
      '<a class="btn g isa-menu-cta" href="#m-reserve" data-go="#m-reserve">Reserve a Unit</a>'
    document.body.appendChild(sheet)
    sheet.querySelector('.isa-menu-close').addEventListener('click', close)
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') close() })
    sheet.querySelectorAll('[data-go]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault()
        var el = document.querySelector(a.getAttribute('data-go'))
        close()
        if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 200)
      })
    })
  }

  function open(from) {
    if (!sheet) build()
    opener = from
    document.documentElement.style.overflow = 'hidden'
    requestAnimationFrame(function () {
      sheet.classList.add('open')
      sheet.querySelector('.isa-menu-close').focus({ preventScroll: true })
    })
  }

  function close() {
    if (!sheet) return
    sheet.classList.remove('open')
    document.documentElement.style.overflow = ''
    if (opener) opener.focus({ preventScroll: true })
  }

  // the export's menu link goes to a page that doesn't exist: open the sheet instead
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target.closest && e.target.closest('a[href="T-Menu-Mobile.dc.html"]')
      if (!a) return
      e.preventDefault()
      open(a)
    },
    true,
  )
})()

/*
 * Mobile residence cards.
 * - The design loads card photos from canvas-only /_blob/ paths that don't exist on
 *   the site; each card gets its own photo (same set as desktop, none repeated).
 * - Tap a card: a bottom sheet with the gallery, what's in the suite, price and
 *   Reserve. Swipe it down (a quick flick is enough), tap outside or ✕ to close.
 * - The card's own "Reserve →" still goes straight to the form, as designed.
 */
;(function () {
  var A = './assets/'
  var TWO_BED = ['Two bedrooms', 'Bathrooms', 'Living and dining', 'Kitchen', 'Storage', 'Premium finishes']
  // keyed by suite name as the mobile cards show it; "incl" is from the project brief
  var SUITES = {
    'The Medici Classic': { photos: ['2cd0212cd485b7326be3d1f3d5e3b71c', 'fafe48b166e4a6c0ac81fc1ceb3d5428'], incl: ['Sleeping area', 'Bathroom', 'Wardrobe', 'Workstation', 'TV and media'] },
    'The Isabella': { photos: ['cf51d5ff04480e9467f96bc57be40ff8'], incl: ['Bedroom', 'Bathroom', 'Living area', 'Kitchenette', 'Dining area', 'Workstation'] },
    'The Duchess': { photos: ['da8544351ad71af790c5542db3f9833b'], incl: TWO_BED },
    'The Florence': { photos: ['7edc370b55b340b909cf336ea291d31a', 'decc5a38e1887cc847d6f3243e1b259b'], incl: ['Three bedrooms', 'Larger living and dining', 'Premium kitchen', 'Enhanced master suite', 'Outdoor space where possible'] },
    'The Duchess Residence': { photos: ['240cbf76323a0d47120fe17fbfa0f7b1'], incl: TWO_BED },
    'The Crown of Medici': { photos: ['e8e8c7c7391d2b9277ea23d42485a668', '5ada6e5364a2b2e253c339eaf3363851'], incl: ['Two levels', 'Four bedrooms', 'Private pool', 'Premium kitchen', 'Private access', 'High-level views'] },
  }
  var EVERY = 'Smart room controls and digital guest services'
  var src = function (id) { return A + id + '.webp' }


  // Cards lead with the bedroom type ("Two bedrooms"), not the suite name.
  // The name stays readable to the code (photos are keyed by it); the text is
  // changed on the runtime's own text node so its re-renders still land.
  function retitle(el, sub) {
    if (!el) return { name: '', title: '' }
    // phone cards: the line under the name reads "Studio · 50 m²" → title "Studio", line "50 m²"
    var shown = el.textContent.trim()
    var name = el.__isaSet === shown ? el.__isaOrig : shown
    var raw = sub ? sub.textContent.trim() : ''
    var subTxt = sub && sub.__isaSet === raw ? sub.__isaOrig : raw
    var parts = subTxt.split('·')
    var t = parts.length > 1 ? parts[0].trim() : ''
    var title = t ? t.charAt(0).toUpperCase() + t.slice(1) : name
    var rest = parts.slice(1).join('·').trim()
    var put = function (node, v) {
      var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
      var tn = w.nextNode()
      if (tn) { tn.nodeValue = v; var x; while ((x = w.nextNode())) x.nodeValue = '' } else node.textContent = v
    }
    if (shown !== title) put(el, title)
    el.__isaOrig = name; el.__isaSet = title
    if (sub && t) { if (raw !== rest) put(sub, rest); sub.__isaOrig = subTxt; sub.__isaSet = rest }
    return { name: name, title: title }
  }


  function read(card) {
    var img = card.querySelector('img')
    var tag = img && img.nextElementSibling
    var body = card.children[1]
    var mars = body ? body.querySelectorAll('div.mar') : []
    var name = mars[0]
    var sub = name && name.nextElementSibling
    var price = mars[mars.length - 1]
    var reserve = body && body.querySelector('a.btn')
    var kind = tag ? tag.textContent.trim() : ''
    var rt = retitle(name, sub)
    var n = rt.name
    return { img: img, name: n, title: rt.title, sub: sub ? sub.textContent.trim() : '', price: price ? price.textContent.trim() : '', kind: kind, reserve: reserve, suite: SUITES[n] }
  }

  // idempotent: the tabs re-render the cards
  function prepare() {
    document.querySelectorAll('#m-residences .rc').forEach(function (card) {
      var d = read(card)
      if (!d.suite) return
      var want = src(d.suite.photos[0])
      if (d.img && d.img.getAttribute('src') !== want) d.img.setAttribute('src', want)
      if (card.__isa === d.name + d.kind) return
      card.__isa = d.name + d.kind
      card.setAttribute('role', 'button')
      card.setAttribute('aria-haspopup', 'dialog')
      card.tabIndex = 0
      card.setAttribute('aria-label', d.title + ', ' + d.kind + ', view details')
      if (!card.__isaBound) {
        card.__isaBound = true
        card.addEventListener('click', function (e) {
          if (e.target.closest('a')) return // Reserve → keeps its own job
          open(card)
        })
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.target.closest('a')) open(card)
        })
      }
    })
  }

  var sheet, panel, imgs = [], dots = [], at = 0, opener = null, current = null

  function build() {
    sheet = document.createElement('div')
    sheet.className = 'isa-sheet'
    sheet.innerHTML =
      '<div class="isa-sheet-bg"></div>' +
      '<div class="isa-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="isa-sh">' +
      '<div class="isa-sheet-grab" aria-hidden="true"><i></i></div>' +
      '<button type="button" class="isa-sheet-close" aria-label="Close">✕</button>' +
      '<div class="isa-sheet-scroll">' +
      '<div class="isa-sgal"><div class="isa-sgal-dots"></div></div>' +
      '<div class="isa-sbody">' +
      '<span class="isa-stag"></span><h3 id="isa-sh"></h3><div class="isa-ssub"></div>' +
      '<div><div class="isa-sk">In the suite</div><ul></ul><div class="isa-severy"></div></div>' +
      '<div class="isa-sfoot"><div><div class="isa-sk">From</div><div class="isa-sprice"></div></div><a class="btn g" href="#m-reserve" style="min-height:46px;padding:0 20px;font-size:11px">Reserve this suite →</a></div>' +
      '</div></div></div>'
    document.body.appendChild(sheet)
    panel = sheet.querySelector('.isa-sheet-panel')
    sheet.querySelector('.isa-sheet-bg').addEventListener('click', close)
    sheet.querySelector('.isa-sheet-close').addEventListener('click', close)
    sheet.querySelector('.isa-sfoot a').addEventListener('click', function (e) {
      e.preventDefault()
      var r = current && read(current).reserve
      close()
      // the card's own Reserve picks the unit and jumps to the form
      if (r) setTimeout(function () { r.click() }, 240)
    })
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') close() })

    // gallery: tap to advance, swipe sideways to change
    var gal = sheet.querySelector('.isa-sgal'), gx = null, gt = 0
    gal.addEventListener('pointerdown', function (e) { gx = e.clientX; gt = Date.now() })
    gal.addEventListener('pointerup', function (e) {
      if (gx === null) return
      var dx = e.clientX - gx, v = Math.abs(dx) / Math.max(1, Date.now() - gt)
      show(Math.abs(dx) > 30 || v > 0.11 ? at + (dx < 0 ? 1 : -1) : at + 1)
      gx = null
    })

    // swipe the sheet down to close: a quick flick is enough, dragging up meets friction
    var y0 = null, t0 = 0, dy = 0, grab = sheet.querySelector('.isa-sheet-grab'), scroller = sheet.querySelector('.isa-sheet-scroll')
    function down(e) {
      if (e.target.closest('.isa-sgal') || (e.currentTarget === scroller && scroller.scrollTop > 0)) return
      y0 = e.touches ? e.touches[0].clientY : e.clientY
      t0 = Date.now()
      dy = 0
    }
    function move(e) {
      if (y0 === null) return
      var y = e.touches ? e.touches[0].clientY : e.clientY
      dy = y - y0
      if (dy < 0) dy = dy / (1 + Math.abs(dy) / 40) // friction instead of a hard stop
      if (Math.abs(dy) > 4) sheet.classList.add('dragging')
      panel.style.transform = 'translateY(' + dy + 'px)'
    }
    function up() {
      if (y0 === null) return
      var v = dy / Math.max(1, Date.now() - t0)
      sheet.classList.remove('dragging')
      panel.style.transform = ''
      if (dy > 120 || v > 0.11) close()
      y0 = null
    }
    ;[grab, scroller].forEach(function (el) {
      el.addEventListener('touchstart', down, { passive: true })
      el.addEventListener('touchmove', move, { passive: true })
      el.addEventListener('touchend', up)
    })
  }

  function show(i) {
    if (!imgs.length) return
    at = (i + imgs.length) % imgs.length
    imgs.forEach(function (im, j) { im.classList.toggle('on', j === at) })
    dots.forEach(function (d, j) { d.classList.toggle('on', j === at) })
  }

  function open(card) {
    if (!sheet) build()
    var d = read(card)
    if (!d.suite) return
    current = card
    opener = card
    var gal = sheet.querySelector('.isa-sgal'), dotBox = sheet.querySelector('.isa-sgal-dots')
    imgs.forEach(function (im) { im.remove() })
    dotBox.innerHTML = ''
    imgs = d.suite.photos.map(function (id) {
      var im = document.createElement('img')
      im.src = src(id)
      im.alt = d.title
      gal.insertBefore(im, dotBox)
      return im
    })
    dots = imgs.length > 1 ? imgs.map(function () { var i = document.createElement('i'); dotBox.appendChild(i); return i }) : []
    var tag = sheet.querySelector('.isa-stag')
    tag.textContent = d.kind
    tag.classList.toggle('res', /^Res/i.test(d.kind))
    sheet.querySelector('h3').textContent = d.title
    sheet.querySelector('.isa-ssub').textContent = /^Res/i.test(d.kind) ? 'Residence' : 'Hotel suite'
    var ul = sheet.querySelector('.isa-sbody ul')
    ul.innerHTML = ''
    d.suite.incl.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li) })
    sheet.querySelector('.isa-severy').textContent = EVERY
    sheet.querySelector('.isa-sprice').textContent = d.price
    // hotel suites are reserved as suites; residences as units
    sheet.querySelector('.isa-sfoot a').textContent = /^Res/i.test(d.kind) ? 'Reserve this unit →' : 'Reserve this suite →'
    sheet.querySelector('.isa-sheet-scroll').scrollTop = 0
    show(0)
    document.documentElement.style.overflow = 'hidden'
    requestAnimationFrame(function () {
      sheet.classList.add('open')
      sheet.querySelector('.isa-sheet-close').focus({ preventScroll: true })
    })
  }

  function close() {
    if (!sheet || !sheet.classList.contains('open')) return
    sheet.classList.remove('open')
    document.documentElement.style.overflow = ''
    if (opener) opener.focus({ preventScroll: true })
  }

  new MutationObserver(prepare).observe(document.documentElement, { childList: true, subtree: true })
  addEventListener('load', prepare)
})()

/*
 * Mobile FAQ: one list of topics, all closed. Tap a topic to see its questions,
 * tap a question for the answer. Opening one topic closes the other, so the
 * section stays short unless someone is curious. Questions and answers come
 * straight from the design's own FAQ data.
 */
;(function () {
  function data() {
    var sc = document.querySelector('script[data-dc-script]')
    var m = sc && /const F = (\[[\s\S]*?\]);\s*\n/.exec(sc.textContent)
    try { return m ? JSON.parse(m[1]) : null } catch (e) { return null }
  }

  function build() {
    var sec = document.getElementById('m-faq')
    var F = data()
    if (!sec || !F || sec.querySelector('.isa-faq')) return !!(sec && sec.querySelector('.isa-faq'))
    var pills = sec.querySelector('.pills')
    var box = document.createElement('div')
    box.className = 'isa-faq'
    F.forEach(function (cat, ci) {
      var c = document.createElement('div')
      c.className = 'isa-faq-cat'
      var id = 'isa-faq-' + ci
      c.innerHTML =
        '<button type="button" aria-expanded="false" aria-controls="' + id + '"><span></span><small></small><i aria-hidden="true"></i></button>' +
        '<div class="isa-faq-body" id="' + id + '"><div></div></div>'
      c.querySelector('span').textContent = cat.c
      c.querySelector('small').textContent = cat.q.length + (cat.q.length === 1 ? ' question' : ' questions')
      var list = c.querySelector('.isa-faq-body > div')
      cat.q.forEach(function (qa, qi) {
        var q = document.createElement('div')
        q.className = 'isa-faq-q'
        var aid = id + '-' + qi
        q.innerHTML = '<button type="button" aria-expanded="false" aria-controls="' + aid + '"><span></span><i aria-hidden="true"></i></button><div class="isa-faq-body" id="' + aid + '"><div><p></p></div></div>'
        q.querySelector('span').textContent = qa.q
        q.querySelector('p').textContent = qa.a
        q.querySelector('button').addEventListener('click', function () { toggle(q, list.querySelectorAll('.isa-faq-q')) })
        list.appendChild(q)
      })
      c.querySelector('button').addEventListener('click', function () { toggle(c, box.querySelectorAll('.isa-faq-cat')) })
      box.appendChild(c)
    })
    ;(pills || sec.querySelector('h2')).insertAdjacentElement('beforebegin', box)
    sec.classList.add('isa-faq-on')
    return true
  }

  // one open at a time within its group
  function toggle(el, group) {
    var open = !el.classList.contains('open')
    group.forEach(function (g) {
      if (g !== el && g.classList.contains('open')) {
        g.classList.remove('open')
        g.firstElementChild.setAttribute('aria-expanded', 'false')
        g.querySelectorAll('.isa-faq-q.open').forEach(function (q) { q.classList.remove('open'); q.firstElementChild.setAttribute('aria-expanded', 'false') })
      }
    })
    el.classList.toggle('open', open)
    el.firstElementChild.setAttribute('aria-expanded', String(open))
  }

  // the runtime may re-render the section; rebuild if our list goes missing
  var t = setInterval(function () {
    var sec = document.getElementById('m-faq')
    if (sec && !sec.querySelector('.isa-faq')) build()
  }, 500)
  setTimeout(function () { clearInterval(t); setInterval(function () { var sec = document.getElementById('m-faq'); if (sec && !sec.querySelector('.isa-faq')) build() }, 2000) }, 10000)
})()

/*
 * Reserve panel (phone): the selected unit reads "01 · Studio", not the suite name.
 * The design data keeps its names (photos are keyed by them); only the shown text changes.
 */
;(function () {
  var TYPE = {
    'The Medici Classic': 'Studio',
    'The Isabella': 'One bedroom',
    'The Duchess': 'Two bedrooms',
    'The Florence': 'Three bedrooms',
    'The Duchess Residence': 'Two bedrooms',
    'The Crown of Medici': 'Four-bedroom penthouse',
  }
  // longest first: "The Duchess" is part of "The Duchess Residence"
  var KEYS = Object.keys(TYPE).sort(function (a, b) { return b.length - a.length })
  function fix() {
    var sec = document.getElementById('m-reserve')
    if (!sec) return
    var w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT)
    var n
    while ((n = w.nextNode())) {
      var v = n.nodeValue
      KEYS.forEach(function (k) { if (v.indexOf(k) !== -1) v = v.split(k).join(TYPE[k]) })
      if (v !== n.nodeValue) n.nodeValue = v
    }
  }
  var mo = new MutationObserver(fix)
  function start() { fix(); mo.observe(document.body, { childList: true, subtree: true, characterData: true }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()

/* Sujimoto line: Isabella's card shows the full render (the design's cut-out PNG floated outside the card) */
;(function () {
  var CUT = '6a565b0c71c7f7ca80b51a697765d431', RENDER = './assets/isabella-tower.jpg'
  function swap() {
    document.querySelectorAll('img[src*="' + CUT + '"]').forEach(function (im) {
      im.classList.add('isa-tower', 'lcis')
      im.setAttribute('src', RENDER)
      im.alt = 'Isabella de’ Medici by Sujimoto, Victoria Island'
    })
  }
  new MutationObserver(swap).observe(document.documentElement, { childList: true, subtree: true })
  swap()
})()
