/*
 * Isabella: one responsive rule for both boards.
 *
 * The site has two fixed-size boards from the design: desktop (1440 x 900) and
 * mobile (390 x 844). Each pinned section is one board-height tall, so a board
 * must fit the screen's height as well as its width, or the bottom of every
 * pinned frame is cut off.
 *
 * Which board:  phones and portrait tablets (and an unfolded foldable held
 *               upright) get the mobile board; landscape screens get desktop.
 *               Rotating or folding switches live.
 * How big:      the board scales to fit both width and height, and is centred
 *               when height is the limit (the sides take the page colour).
 *
 * Testing: add ?desktop or ?mobile to force a board.
 */
;(function () {
  var html = document.documentElement
  var page = /mobile\.html$/.test(location.pathname) ? 'mobile' : 'desktop'
  // /v2 is the same site with the picture hero; keep visitors inside it when switching boards
  var base = /^\/v2(\/|$)/.test(location.pathname) ? '/v2' : ''
  var BOARD = { desktop: { w: 1440, h: 900 }, mobile: { w: 390, h: 844 } }
  // pinned frames may lose this much at the bottom before we shrink further
  var CROP = { desktop: 0.04, mobile: 0.02 }
  // the desktop board's outer margin (content starts 88px in) may be trimmed by this much per side
  var SIDE = { desktop: 60, mobile: 0 }
  var forced = /[?&]desktop/.test(location.search) ? 'desktop' : /[?&]mobile/.test(location.search) ? 'mobile' : null

  // Browsers disagree on whether innerWidth/innerHeight include the page zoom,
  // so measure with the zoom cleared (the next line sets it again, same frame).
  function screenSize() {
    html.style.zoom = ''
    return { w: innerWidth, h: innerHeight }
  }

  function boardFor(s) {
    if (forced) return forced
    if (s.w < 768) return 'mobile'
    // portrait tablets and upright foldables: the tall board reads far better
    if (s.w / s.h < 0.9 && s.w < 1100) return 'mobile'
    return 'desktop'
  }

  function fit() {
    var s = screenSize()
    var want = boardFor(s)
    if (want !== page) {
      location.replace(base + (want === 'mobile' ? '/mobile.html' : '/') + location.search + location.hash)
      return
    }
    var b = BOARD[page]
    var zw = s.w / b.w
    var zh = s.h / b.h
    // whichever side limits the board gets its small allowance, so pinned frames fill the screen;
    // a screen with the board's own shape (1440 x 900) shows it at exactly 1:1
    var z = zw < zh ? Math.min(s.w / (b.w - 2 * SIDE[page]), zh) : Math.min(zw, s.h / (b.h * (1 - CROP[page])))
    z = page === 'mobile' ? Math.max(0.7, Math.min(2.2, z)) : Math.max(0.45, z)
    html.style.zoom = String(z)
    // centre the board; a negative offset trims its outer margin equally on both sides
    html.style.setProperty('--isa-off', ((s.w / z - b.w) / 2).toFixed(1) + 'px')
    // the screen's height in board px: pinned sections grow to it so no empty band is left below them
    html.style.setProperty('--isa-vh', (s.h / z).toFixed(1) + 'px')
    html.dataset.board = page
  }

  fit()
  var t = 0
  addEventListener('resize', function () {
    clearTimeout(t)
    t = setTimeout(fit, 120)
  })
  // folding / rotating
  if (screen.orientation) screen.orientation.addEventListener('change', fit)
})()
