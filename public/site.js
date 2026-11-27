/*
 * Isabella one-pager: every section is linked by page scroll.
 *
 * The design export plays three sequences inside their own scroll boxes
 * (hero, handover, House of Sujimoto). A scroll box captures the wheel, so
 * the page felt locked until the box ran out. Here each box stops scrolling
 * on its own: its section pins to the page (CSS sticky), the page scroll is
 * fed into the box, and when the sequence ends the page simply carries on.
 * Scrolling back up reverses it. The animations themselves are untouched.
 */
(function () {
  var linked = [] // { box, frame, wrap }

  // sections whose sequence starts while they are still rising into view (fraction of the screen height)
  var LEAD = { invitation: 0.85 }
  // page scroll per step of a sequence (1 = one to one; higher = slower)
  var PACE = { invitation: 1.7 }
  // sequences that glide to the scroll position instead of stepping with each wheel tick
  var GLIDE = { invitation: 0.14 }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  function link(box) {
    var frame = box.closest('section')
    if (!frame || box.__linked) return
    box.__linked = true
    var wrap = document.createElement('div')
    wrap.className = 'scroll-link'
    wrap.style.position = 'relative'
    frame.parentNode.insertBefore(wrap, frame)
    wrap.appendChild(frame)
    frame.style.position = 'sticky'
    frame.style.top = '0px'
    // the box no longer scrolls by itself, so it can't capture the wheel
    box.style.overflowY = 'hidden'
    box.style.overscrollBehavior = 'auto'
    box.removeAttribute('tabindex')
    linked.push({ box: box, frame: frame, wrap: wrap })
    measure()
  }

  function measure() {
    linked.forEach(function (l) {
      var range = l.box.scrollHeight - l.box.clientHeight
      l.range = Math.max(0, range)
      // page scroll per step of the sequence (1 = one to one; higher = slower, more deliberate)
      l.wrap.style.height = l.frame.offsetHeight + Math.round(l.range * (PACE[l.frame.id] || 1)) + 'px'
    })
    sync()
  }


  function sync() {
    linked.forEach(function (l) {
      var w = l.wrap.getBoundingClientRect()
      var f = l.frame.getBoundingClientRect()
      var travel = w.height - f.height
      // the visible height in the same units as the rects (page zoom cancels out)
      var lead = (LEAD[l.frame.id] || 0) * f.height
      var p = travel + lead > 0 ? Math.min(1, Math.max(0, (lead - w.top) / (travel + lead))) : 0
      var top = p * l.range
      var k = GLIDE[l.frame.id]
      if (!k || reduce) { l.cur = top; put(l, top); return }
      l.target = top
      if (l.cur == null) l.cur = top
      if (!l.raf) l.raf = requestAnimationFrame(function step() {
        l.cur += (l.target - l.cur) * k
        if (Math.abs(l.target - l.cur) < 0.5) l.cur = l.target
        put(l, l.cur)
        l.raf = l.cur === l.target ? 0 : requestAnimationFrame(step)
      })
    })
  }

  function put(l, top) {
    top = Math.round(top)
    if (l.box.scrollTop !== top) l.box.scrollTop = top
  }

  function scan() {
    document.querySelectorAll('#hero [aria-label^="Hero into the building"], .ho-scroller, .hs-scroller').forEach(link)
  }

  addEventListener('scroll', sync, { passive: true })
  addEventListener('resize', measure)
  addEventListener('load', measure)
  if (document.fonts) document.fonts.ready.then(measure)

  // the design runtime renders after this script; link the boxes as they appear
  var mo = new MutationObserver(scan)
  mo.observe(document.documentElement, { childList: true, subtree: true })
  scan()
  // content heights settle as images load; re-measure for a few seconds
  var n = 0
  var t = setInterval(function () {
    measure()
    if (++n > 10) clearInterval(t)
  }, 500)
})()

/*
 * Hotel and residence cards.
 * - Every card leads with its own photo; no photo is used twice on the page's cards.
 * - Click, tap or Enter opens the suite panel; "Reserve this suite" selects the
 *   unit in the reserve form and takes you there.
 */
;(function () {
  var A = './assets/'
  // lead photo first; any further photos form the panel's gallery.
  // "incl" comes from the Isabella de' Medici initial project brief (accommodation mix);
  // sizes, prices and storeys on the page stay as the site states them.
  var TWO_BED = ['Two bedrooms', 'Bathrooms', 'Living and dining', 'Kitchen', 'Storage', 'Premium finishes']
  var SUITES = [
    { photos: ['2cd0212cd485b7326be3d1f3d5e3b71c', 'fafe48b166e4a6c0ac81fc1ceb3d5428'], // The Medici Classic: pendant bedroom, wardrobe
      incl: ['Sleeping area', 'Bathroom', 'Wardrobe', 'Workstation', 'TV and media'] },
    { photos: ['cf51d5ff04480e9467f96bc57be40ff8'], // The Isabella: marble bathroom
      incl: ['Bedroom', 'Bathroom', 'Living area', 'Kitchenette', 'Dining area', 'Workstation'] },
    { photos: ['da8544351ad71af790c5542db3f9833b'], incl: TWO_BED }, // The Duchess: fireplace living room
    { photos: ['7edc370b55b340b909cf336ea291d31a', 'decc5a38e1887cc847d6f3243e1b259b'], // The Florence: skyline living, dining
      incl: ['Three bedrooms', 'Larger living and dining', 'Premium kitchen', 'Enhanced master suite', 'Outdoor space where possible'] },
    { photos: ['240cbf76323a0d47120fe17fbfa0f7b1'], incl: TWO_BED }, // The Duchess Residence: marble TV-wall bedroom
    { photos: ['e8e8c7c7391d2b9277ea23d42485a668', '5ada6e5364a2b2e253c339eaf3363851'], // The Crown of Medici: rooftop pool at sunset, bedroom
      incl: ['Two levels', 'Four bedrooms', 'Private pool', 'Premium kitchen', 'Private access', 'High-level views'] },
  ]
  var EVERY = 'Smart room controls and digital guest services'
  var src = function (id) { return A + id + '.webp' }

  function isRes(card) { return /244,\s*236,\s*219|F4ECDB/i.test(card.style.background || card.getAttribute('style') || '') }

  function cards() { return Array.prototype.slice.call(document.querySelectorAll('.rc2')) }


  // Cards lead with the bedroom type ("Two bedrooms"), not the suite name.
  // The name stays readable to the code (photos are keyed by it); the text is
  // changed on the runtime's own text node so its re-renders still land.
  function retitle(el, sub) {
    if (!el) return { name: '', title: '' }
    var shown = el.textContent.trim()
    var name = el.__isaSet === shown ? el.__isaOrig : shown
    var raw = sub ? sub.textContent.trim() : ''
    var t = raw.split('·').pop().trim()
    var title = t ? t.charAt(0).toUpperCase() + t.slice(1) : name
    if (sub) sub.classList.add('isa-typeline')
    if (shown !== title) {
      var tn = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null
      if (tn) tn.nodeValue = title; else el.textContent = title
    }
    el.__isaOrig = name; el.__isaSet = title
    return { name: name, title: title }
  }

  function read(card) {
    var sum = card.firstElementChild
    var marDivs = sum.querySelectorAll(':scope > .mar')
    var figs = sum.querySelectorAll('.fig')
    var tag = sum.firstElementChild && sum.firstElementChild.lastElementChild
    var rvText = card.querySelector('.rv > div:not(.rph)')
    var desc = rvText && rvText.children[1]
    var sub = marDivs[0] && marDivs[0].nextElementSibling
    var rt = retitle(marDivs[0], sub)
    return {
      name: rt.name,
      title: rt.title,
      type: sub ? sub.textContent.trim() : '',
      size: figs[0] ? figs[0].textContent.trim() : '',
      price: figs.length ? figs[figs.length - 1].textContent.trim() : '',
      tag: tag ? tag.textContent.trim() : '',
      desc: desc ? desc.textContent.trim() : '',
      residence: isRes(card),
    }
  }

  // idempotent: safe to run on every runtime re-render
  function prepare() {
    cards().forEach(function (card, k) {
      var suite = SUITES[k]
      if (!suite) return
      var lead = card.querySelector('.rph .b')
      var other = card.querySelector('.rph img:not(.b)')
      if (lead && lead.getAttribute('src') !== src(suite.photos[0])) lead.setAttribute('src', src(suite.photos[0]))
      if (other && suite.photos[1] && other.getAttribute('src') !== src(suite.photos[1])) other.setAttribute('src', src(suite.photos[1]))
      var rd = read(card)   // also sets the bedroom-type title
      if (lead) lead.alt = rd.title
      card.classList.toggle('isa-res', isRes(card))
      if (!card.__isa) {
        card.__isa = true
        card.tabIndex = 0
        card.setAttribute('role', 'button')
        card.setAttribute('aria-haspopup', 'dialog')
        card.setAttribute('aria-label', rd.title + ', ' + rd.tag + ', view details')
        card.addEventListener('click', function () { open(k, card) })
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(k, card) }
        })
      }
      // what the suite holds (first three items from the brief) fills the card between size and price
      var sizeEl = card.firstElementChild && card.firstElementChild.querySelector(':scope > .fig')
      if (sizeEl) sizeEl.classList.add('isa-size')
      if (sizeEl && !(sizeEl.nextElementSibling && sizeEl.nextElementSibling.classList.contains('isa-has'))) {
        var has = document.createElement('ul')
        has.className = 'isa-has'
        has.setAttribute('aria-label', 'In the suite')
        suite.incl.filter(function (t) { return t.toLowerCase() !== rd.title.toLowerCase() }).slice(0, 3).forEach(function (t) { var li = document.createElement('li'); li.textContent = t; has.appendChild(li) })
        sizeEl.after(has)
      }
      var priceRow = card.firstElementChild && card.firstElementChild.lastElementChild
      if (priceRow && !priceRow.querySelector('.isa-more')) {
        var more = document.createElement('span')
        more.className = 'isa-more'
        more.setAttribute('aria-hidden', 'true')   // the whole card is the button; this is its visible affordance
        more.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        priceRow.appendChild(more)
      }
    })
  }

  // ---- panel
  var dlg, panel, galImgs = [], dots = [], at = 0, opener = null, current = -1

  function build() {
    dlg = document.createElement('div')
    dlg.className = 'isa-dlg'
    dlg.innerHTML =
      '<div class="isa-dlg-bg"></div>' +
      '<div class="isa-dlg-panel" role="dialog" aria-modal="true" aria-labelledby="isa-dlg-h">' +
      '<button class="isa-dlg-close" type="button" aria-label="Close">✕</button>' +
      '<div class="isa-gal"><div class="isa-gal-nav"><button type="button" class="prev" aria-label="Previous photo">←</button><button type="button" class="next" aria-label="Next photo">→</button><span class="isa-gal-dots"></span></div></div>' +
      '<div class="isa-dlg-body">' +
      '<span class="isa-dlg-tag"></span>' +
      '<h3 id="isa-dlg-h"></h3>' +
      '<div class="isa-dlg-type"></div>' +
      '<p class="isa-dlg-desc"></p>' +
      '<div class="isa-dlg-incl"><div class="k">In the suite</div><ul></ul><div class="isa-dlg-every"></div></div>' +
      '<div class="isa-dlg-facts"><div><div class="k">Size</div><div class="v size"></div></div><div><div class="k">From</div><div class="v price"></div></div></div>' +
      '<div class="isa-dlg-cta"><a class="btn g reserve" href="#reserve">Reserve this suite →</a></div>' +
      '</div></div>'
    document.body.appendChild(dlg)
    panel = dlg.querySelector('.isa-dlg-panel')
    dlg.querySelector('.isa-dlg-bg').addEventListener('click', close)
    dlg.querySelector('.isa-dlg-close').addEventListener('click', close)
    dlg.querySelector('.prev').addEventListener('click', function () { show(at - 1) })
    dlg.querySelector('.next').addEventListener('click', function () { show(at + 1) })
    dlg.querySelector('.reserve').addEventListener('click', function (e) { e.preventDefault(); reserve(current) })
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') show(at + 1)
      if (e.key === 'ArrowLeft') show(at - 1)
      if (e.key === 'Tab') trap(e)
    })
    // swipe the gallery on touch
    var gal = dlg.querySelector('.isa-gal'), x0 = null, t0 = 0
    gal.addEventListener('pointerdown', function (e) { x0 = e.clientX; t0 = Date.now() })
    gal.addEventListener('pointerup', function (e) {
      if (x0 === null) return
      var dx = e.clientX - x0, v = Math.abs(dx) / Math.max(1, Date.now() - t0)
      if (Math.abs(dx) > 40 || v > 0.11) show(at + (dx < 0 ? 1 : -1))
      x0 = null
    })
  }

  function trap(e) {
    var f = panel.querySelectorAll('button, a[href]')
    var first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  function show(i) {
    if (!galImgs.length) return
    at = (i + galImgs.length) % galImgs.length
    galImgs.forEach(function (im, j) { im.classList.toggle('on', j === at) })
    dots.forEach(function (d, j) { d.classList.toggle('on', j === at) })
  }

  function open(k, card) {
    if (!dlg) build()
    current = k
    opener = card
    var d = read(card)
    var gal = dlg.querySelector('.isa-gal')
    galImgs.forEach(function (im) { im.remove() })
    var dotBox = dlg.querySelector('.isa-gal-dots')
    dotBox.innerHTML = ''
    galImgs = SUITES[k].photos.map(function (id) {
      var im = document.createElement('img')
      im.src = src(id)
      im.alt = d.title
      gal.insertBefore(im, gal.firstChild)
      return im
    })
    dots = galImgs.map(function () { var i = document.createElement('i'); dotBox.appendChild(i); return i })
    dlg.querySelector('.isa-gal-nav').style.display = galImgs.length > 1 ? '' : 'none'
    var tag = dlg.querySelector('.isa-dlg-tag')
    tag.textContent = d.tag
    tag.classList.toggle('res', d.residence)
    dlg.querySelector('h3').textContent = d.title
    dlg.querySelector('.isa-dlg-type').textContent = d.residence ? 'Residence' : 'Hotel suite'
    dlg.querySelector('.isa-dlg-desc').textContent = d.desc
    var ul = dlg.querySelector('.isa-dlg-incl ul')
    ul.innerHTML = ''
    SUITES[k].incl.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li) })
    dlg.querySelector('.isa-dlg-every').textContent = EVERY
    dlg.querySelector('.v.size').textContent = d.size
    dlg.querySelector('.v.price').textContent = d.price
    // hotel suites are reserved as suites; residences as units
    dlg.querySelector('.reserve').textContent = d.residence ? 'Reserve this unit →' : 'Reserve this suite →'
    show(0)
    panel.scrollTop = 0
    document.documentElement.style.overflow = 'hidden'
    requestAnimationFrame(function () {
      dlg.classList.add('open')
      dlg.querySelector('.isa-dlg-close').focus({ preventScroll: true })
    })
  }

  function close() {
    if (!dlg || !dlg.classList.contains('open')) return
    dlg.classList.remove('open')
    document.documentElement.style.overflow = ''
    if (opener) opener.focus({ preventScroll: true })
  }

  // pick this suite in the reserve form (its unit rows follow the same order as the cards) and go there
  function reserve(k) {
    close()
    var rows = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
      return /^0\d/.test(b.textContent.trim()) && /m²/.test(b.textContent)
    })
    var row = rows[k]
    if (!row) return
    row.click()
    // the rows are hidden behind the dropdowns now: bring the selection panel into view
    var panel = row.closest('.isa-res-panel') || row
    setTimeout(function () { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 280)
  }

  var t = setInterval(prepare, 400)
  setTimeout(function () { clearInterval(t); setInterval(prepare, 2000) }, 8000)
  addEventListener('load', prepare)
})()

/*
 * Reserve panel: "Way to own" (hotel or residence) and "Suite" dropdowns
 * replace the design's six rows. The rows stay in the page, hidden, and the
 * dropdowns press them, so the design's own logic keeps driving the headline,
 * tag, total and floor-plan pins. The panel keeps one shape whatever is picked.
 */
;(function () {
  var OWN = {
    hotel: { label: 'Hotel', note: 'Managed for you', pill: 'h' },
    res: { label: 'Residence', note: 'A private home to live in', pill: 'r' },
  }
  var P = null

  function find() {
    var k = Array.prototype.find.call(document.querySelectorAll('.k.kd'), function (e) { return /Your selection/.test(e.textContent) })
    if (!k) return null
    var panel = k.parentElement
    var kids = panel.children
    var rows = Array.prototype.filter.call(panel.querySelectorAll('button'), function (b) { return /m²/.test(b.textContent) && /^0\d/.test(b.textContent.trim()) })
    if (rows.length < 6) return null
    var units = Array.prototype.find.call(kids, function (c) { return /^Units/i.test(c.textContent.trim()) })
    var total = Array.prototype.find.call(kids, function (c) { return /Total today/i.test(c.textContent) })
    return { panel: panel, title: kids[1], hotel: rows[0].parentElement, res: rows[4].parentElement, rows: rows, units: units, total: total }
  }

  function unitOf(btn, i) {
    var t = btn.textContent.replace(/\s+/g, ' ').trim()
    var m = /^(\d\d)\s*(.*?)\s*(\d+)\s*m²\s*(US\$[\d,]+)/.exec(t) || []
    return { i: i, no: m[1] || '', type: m[2] || '', size: m[3] || '', price: m[4] || '', name: m[2] || '', own: i < 4 ? 'hotel' : 'res' }
  }
  function units() { return P.rows.map(unitOf) }
  function current() {
    var i = P.rows.findIndex(function (b) { return b.style.opacity === '1' })
    return i < 0 ? 0 : i
  }
  function count() {
    var b = P.units && Array.prototype.find.call(P.units.querySelectorAll('*'), function (e) { return /^\d+$/.test(e.textContent.trim()) && !e.children.length })
    return b ? b.textContent.trim() : '1'
  }

  function field(id, label) {
    var f = document.createElement('div')
    f.className = 'isa-field'
    f.innerHTML =
      '<label id="' + id + '-l">' + label + '</label>' +
      '<button class="isa-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' + id + '-l ' + id + '-v"><span class="v" id="' + id + '-v"></span><span class="m"></span><i class="isa-chev"></i></button>' +
      '<ul class="isa-list" role="listbox" aria-labelledby="' + id + '-l" tabindex="-1"></ul>'
    return f
  }

  function dropdown(f, options, onPick) {
    var btn = f.querySelector('.isa-trigger'), list = f.querySelector('.isa-list'), active = 0
    function render() {
      var opts = options()
      list.innerHTML = ''
      opts.forEach(function (o, i) {
        var li = document.createElement('li')
        li.className = 'isa-opt' + (o.own ? ' own' : '')
        li.setAttribute('role', 'option')
        li.id = f.id + '-o' + i
        li.setAttribute('aria-selected', String(o.selected))
        li.innerHTML = o.html
        li.addEventListener('click', function () { onPick(o.value); close(true) })
        li.addEventListener('mousemove', function () { setActive(i) })
        list.appendChild(li)
      })
      return opts
    }
    function setActive(i) {
      var items = list.children
      if (!items.length) return
      active = (i + items.length) % items.length
      Array.prototype.forEach.call(items, function (el, j) { el.classList.toggle('active', j === active) })
      list.setAttribute('aria-activedescendant', items[active].id)
    }
    function open() {
      document.querySelectorAll('.isa-field.open').forEach(function (o) { if (o !== f) o.__close() })
      var opts = render()
      f.classList.add('open')
      btn.setAttribute('aria-expanded', 'true')
      setActive(Math.max(0, opts.findIndex(function (o) { return o.selected })))
      list.focus({ preventScroll: true })
    }
    function close(refocus) {
      f.classList.remove('open')
      btn.setAttribute('aria-expanded', 'false')
      if (refocus) btn.focus({ preventScroll: true })
    }
    f.__close = function () { close(false) }
    btn.addEventListener('click', function () { f.classList.contains('open') ? close(true) : open() })
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open() } })
    list.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); list.children[active].click() }
      else if (e.key === 'Escape' || e.key === 'Tab') close(e.key === 'Escape')
    })
    document.addEventListener('pointerdown', function (e) { if (!f.contains(e.target)) close(false) })
  }

  var fOwn, fSuite, title

  function build() {
    P = find()
    if (!P || P.panel.classList.contains('isa-res-panel')) return
    P.panel.classList.add('isa-res-panel')
    P.title.classList.add('isa-hide')
    P.hotel.classList.add('isa-hide')
    P.res.classList.add('isa-hide')
    title = document.createElement('div')
    title.className = 'isa-title'
    P.title.insertAdjacentElement('afterend', title)
    fOwn = field('isa-own', 'Way to own')
    fOwn.id = 'isa-own'
    fSuite = field('isa-suite', 'Suite')
    fSuite.id = 'isa-suite'
    P.panel.insertBefore(fOwn, P.units)
    P.panel.insertBefore(fSuite, P.units)
    var fig = P.total && Array.prototype.find.call(P.total.querySelectorAll('*'), function (e) { return !e.children.length && /^US\$[\d,]+$/.test(e.textContent.trim()) })
    if (fig) fig.classList.add('isa-total-fig')

    dropdown(fOwn, function () {
      var cur = units()[current()].own
      return Object.keys(OWN).map(function (k) {
        var o = OWN[k]
        return { value: k, own: true, selected: k === cur, html: '<span class="n"><span class="isa-pill ' + o.pill + '">' + o.label + '</span><span style="font:300 13px Poppins;color:#5a4034">' + o.note + '</span></span><i class="ok"></i>' }
      })
    }, function (k) {
      var u = units(), cur = current()
      if (u[cur].own !== k) P.rows[u.findIndex(function (x) { return x.own === k })].click()
    })

    dropdown(fSuite, function () {
      var u = units(), cur = current()
      return u.filter(function (x) { return x.own === u[cur].own }).map(function (x) {
        return { value: x.i, selected: x.i === cur, html: '<span class="d"><span>' + x.no + '</span></span><span class="n">' + x.name + '<small>' + x.size + ' m²</small></span><span class="p">' + x.price + '</span><i class="ok"></i>' }
      })
    }, function (i) { P.rows[i].click() })

    sync()
    new MutationObserver(sync).observe(P.panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style'] })
  }

  function set(el, prop, val) { if (el && el[prop] !== val) el[prop] = val }

  // mirror the design's state (what the hidden rows say) into the dropdowns and headline
  function sync() {
    if (!P || !fOwn) return
    var u = units()[current()], o = OWN[u.own]
    set(title, 'textContent', count() + ' × ' + u.name)
    set(fOwn.querySelector('.v'), 'innerHTML', '<span class="isa-pill ' + o.pill + '">' + o.label + '</span>')
    var m = fOwn.querySelector('.m')
    set(m, 'textContent', o.note)
    set(m, 'className', 'm note')
    var v = fSuite.querySelector('.v')
    if (!v.firstChild) v.innerHTML = '<span class="t"></span>'
    set(v.firstChild, 'textContent', u.name)
    set(fSuite.querySelector('.m'), 'textContent', u.price)
    // the form's button follows the choice: hotel suites are reserved as suites, residences as units
    var sec = P.panel.closest('section')
    var cta = sec && Array.prototype.find.call(sec.querySelectorAll('a, button'), function (b) { return /^Reserve my (unit|suite)/i.test(b.textContent.trim()) })
    if (cta) set(cta, 'textContent', u.own === 'res' ? 'Reserve my unit →' : 'Reserve my suite →')
  }

  // the runtime may render the section late or re-render it: (re)build when needed
  setInterval(function () {
    var k = Array.prototype.find.call(document.querySelectorAll('.k.kd'), function (e) { return /Your selection/.test(e.textContent) })
    if (k && !k.parentElement.classList.contains('isa-res-panel')) build()
  }, 600)
})()

/*
 * The fifty seals stamp in once, the first time the grid is well into view.
 */
;(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  function find() {
    var img = document.querySelector('div[style*="aspect-ratio"] > img[src*="945a0cc659159dd00ebca4ef851b4f81"]')
    return img && img.parentElement && img.parentElement.parentElement
  }
  function arm(grid) {
    if (grid.__isa) return
    grid.__isa = true
    var cells = Array.prototype.slice.call(grid.children)
    var cols = 10
    cells.forEach(function (c, i) {
      var row = Math.floor(i / cols), col = i % cols
      c.style.setProperty('--d', (row + col) * 34 + 'ms') // diagonal wave from the top-left
      if (parseFloat(c.style.opacity || '1') > 0.5) c.classList.add('isa-taken')
    })
    // already on screen (e.g. reload mid-page): don't hide it, just leave it
    var r = grid.getBoundingClientRect()
    if (r.top < innerHeight && r.bottom > 0) return
    grid.classList.add('isa-seals', 'isa-wait')
    var done = false
    function play() {
      if (done) return
      done = true
      removeEventListener('scroll', check)
      grid.classList.remove('isa-wait')
      grid.classList.add('isa-go')
    }
    // play once about a third of the grid is on screen (scroll check is the backstop: seals must never stay hidden)
    function check() {
      var b = grid.getBoundingClientRect()
      var visible = Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)
      if (visible > b.height * 0.35) play()
    }
    addEventListener('scroll', check, { passive: true })
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting })) { io.disconnect(); play() }
      }, { threshold: 0.35 })
      io.observe(grid)
    }
  }
  var t = setInterval(function () {
    var g = find()
    if (g) { arm(g); clearInterval(t) }
  }, 300)
})()

/*
 * Amenities overlay: full-screen takeover with the page locked behind it.
 * Closes with Esc, the Close button, or by scrolling on past its last chapter.
 */
;(function () {
  var current = null
  function arm() {
    var sc = document.querySelector('.as-scroller')
    if (!sc) {
      if (current) { current = null; document.documentElement.style.overflow = '' }
      return
    }
    var top = sc.parentElement && sc.parentElement.parentElement && sc.parentElement.parentElement.parentElement
    if (!top || top === current) return
    current = top
    top.classList.add('isa-amov')
    document.documentElement.style.overflow = 'hidden'
    Array.prototype.forEach.call(top.querySelectorAll('span'), function (s) {
      if (/scroll inside/i.test(s.textContent)) s.classList.add('isa-hide-label')
    })
    var closeBtn = Array.prototype.find.call(top.querySelectorAll('button'), function (b) { return /close/i.test(b.textContent) })
    var close = function () { if (closeBtn) closeBtn.click() }
    // keep scrolling past the end: hand back to the page
    var push = 0
    function atEnd() { return sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 2 }
    sc.addEventListener('wheel', function (e) {
      if (e.deltaY > 0 && atEnd()) { push += e.deltaY; if (push > 260) close() } else push = 0
    }, { passive: true })
    var ty = null
    sc.addEventListener('touchstart', function (e) { ty = e.touches[0].clientY }, { passive: true })
    sc.addEventListener('touchmove', function (e) {
      if (ty === null) return
      if (atEnd() && ty - e.touches[0].clientY > 90) { ty = null; close() }
    }, { passive: true })
    var onKey = function (e) { if (e.key === 'Escape' && current) close() }
    addEventListener('keydown', onKey)
    sc.focus && sc.setAttribute('tabindex', '-1')
    sc.focus({ preventScroll: true })
  }
  new MutationObserver(arm).observe(document.documentElement, { childList: true, subtree: true })
})()

/*
 * "Watch the film": the film card expands to fill the screen and plays with sound.
 * Close (button, Esc or a click outside the video) shrinks it back into the card.
 */
;(function () {
  var box, vid, card, loop, opener
  function rectInset(r) {
    // the card's rectangle as an inset() clip on a full-screen layer (page zoom cancels out in the ratio)
    var W = innerWidth, H = innerHeight, z = parseFloat(document.documentElement.style.zoom) || 1
    var t = (r.top * z) / H * 100, l = (r.left * z) / W * 100, b = 100 - (r.bottom * z) / H * 100, rt = 100 - (r.right * z) / W * 100
    return 'inset(' + t + '% ' + rt + '% ' + b + '% ' + l + '% round 16px)'
  }
  function build(src, poster) {
    box = document.createElement('div')
    box.className = 'isa-film'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')
    box.setAttribute('aria-label', 'The site film')
    box.innerHTML = '<button type="button" class="isa-film-close" aria-label="Close the film">✕ Close</button><video playsinline controls preload="metadata"></video>'
    vid = box.querySelector('video')
    vid.src = src
    if (poster) vid.poster = poster
    box.querySelector('.isa-film-close').addEventListener('click', close)
    box.addEventListener('click', function (e) { if (e.target === box) close() })
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('open')) close() })
    document.body.appendChild(box)
  }
  function open() {
    if (!box) build(loop.currentSrc || loop.src, loop.getAttribute('poster'))
    box.style.setProperty('--from', rectInset(card.getBoundingClientRect()))
    box.classList.remove('open')
    box.style.display = 'flex'
    document.documentElement.style.overflow = 'hidden'
    loop.pause()
    void box.offsetWidth
    requestAnimationFrame(function () {
      box.classList.add('open')
      vid.currentTime = 0
      vid.muted = false
      vid.play().catch(function () {})
      box.querySelector('.isa-film-close').focus({ preventScroll: true })
    })
  }
  function close() {
    if (!box || !box.classList.contains('open')) return
    vid.pause()
    box.style.setProperty('--from', rectInset(card.getBoundingClientRect()))
    box.classList.remove('open')
    document.documentElement.style.overflow = ''
    setTimeout(function () { box.style.display = 'none'; loop.play().catch(function () {}) }, 280)
    if (opener) opener.focus({ preventScroll: true })
  }
  function arm() {
    loop = document.querySelector('video[src*="d562f2e79dbbb900de549fac81d6b23d"]')
    if (!loop) return false
    card = loop.closest('div[style*="border-radius"]') || loop.parentElement
    var label = Array.prototype.find.call(card.querySelectorAll('span'), function (s) { return /Watch the film/i.test(s.textContent) })
    ;[label, card].forEach(function (el) {
      if (!el || el.__isaFilm) return
      el.__isaFilm = true
      el.classList.add('isa-film-trigger')
      if (el === label) { el.setAttribute('role', 'button'); el.tabIndex = 0 }
      el.addEventListener('click', function (e) { e.stopPropagation(); opener = label || card; open() })
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opener = el; open() } })
    })
    return true
  }
  var t = setInterval(function () { if (arm()) clearInterval(t) }, 400)
})()

/*
 * Floor plan: pins select their unit (the design's rows), lift on hover, and the
 * plate tilts gently toward the pointer with a deeper shadow beneath it.
 */
;(function () {
  var PIN_TO_ROW = [0, 1, 2, 3, 5] // design: pins 01–05 → studio, one, two, three bedrooms, penthouse
  function arm() {
    var img = document.querySelector('img[src*="e17a3a668b9990c59d341daff1bc95f2"], img[src*="3e5291ef9fa4df52a21e7cd8a505668a"], img[src*="78445b0b140fead12860b0c49d9ecf3f"]')
    var plate = img && img.parentElement
    if (!plate || plate.__isa) return !!plate
    plate.__isa = true
    var frame = plate.parentElement
    frame.classList.add('isa-plan')
    plate.classList.add('isa-plate')
    function rows() {
      var panel = document.querySelector('.isa-res-panel') || frame.parentElement
      return Array.prototype.filter.call(panel.querySelectorAll('button'), function (b) { return /m²/.test(b.textContent) && /^0\d/.test(b.textContent.trim()) })
    }
    function pins() { return Array.prototype.filter.call(plate.children, function (c) { return c !== img && c.tagName === 'DIV' }) }
    function wire() {
      pins().forEach(function (p, i) {
        if (p.__isa) return
        p.__isa = true
        p.classList.add('isa-pin')
        p.setAttribute('role', 'button')
        p.tabIndex = 0
        p.setAttribute('aria-label', 'Select ' + p.textContent.replace(/\s+/g, ' ').trim())
        var pick = function () { var r = rows()[PIN_TO_ROW[i]]; if (r) r.click() }
        p.addEventListener('click', pick)
        p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick() } })
      })
    }
    wire()
    new MutationObserver(wire).observe(plate, { childList: true })
    if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame.addEventListener('pointermove', function (e) {
        var r = frame.getBoundingClientRect()
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
        plate.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg')
        plate.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg')
      })
      frame.addEventListener('pointerleave', function () { plate.style.setProperty('--rx', '0deg'); plate.style.setProperty('--ry', '0deg') })
    }
    return true
  }
  var t = setInterval(function () { if (arm()) clearInterval(t) }, 500)
})()

/* "Tap a place to open its detail →" promised something the page doesn't do: removed. */
;(function () {
  var t = setInterval(function () {
    var el = Array.prototype.find.call(document.querySelectorAll('span, div, p'), function (e) { return !e.children.length && /^Tap a place to open its detail/i.test(e.textContent.trim()) })
    if (el) { el.style.display = 'none'; clearInterval(t) }
  }, 500)
  setTimeout(function () { clearInterval(t) }, 15000)
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
