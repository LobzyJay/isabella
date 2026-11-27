/*
 * "When are you ready?" (reserve form, desktop and phone): a dropdown instead of a free-text box.
 * Built on the design's own field (same label, same gold underline, same type), so it reads
 * as part of the form. The picked answer is written back into the design's input, so whatever
 * the form sends still finds it there.
 */
;(function () {
  var OPTIONS = ['This quarter', 'Next quarter', 'Later this year', 'Next year', 'Not sure yet']
  var LABEL = /^when are you ready/i

  var css =
    '.isa-rd{position:relative;text-transform:none;letter-spacing:0;--ease-out:cubic-bezier(.23,1,.32,1)}' +
    '.isa-rd.open{z-index:40}' +
    '.isa-rd-btn{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;' +
    'border-bottom:1px solid rgba(201,138,43,.6);color:#FFFDF8;font:300 16px Poppins,sans-serif;padding:8px 0 12px;transition:border-color 200ms ease}' +
    '.isa-rd-btn .ph{color:rgba(255,253,248,.42)}' +
    '.isa-rd-btn:focus-visible{border-bottom-color:#F4B03E;outline:2px solid #F4B03E;outline-offset:4px;border-radius:2px}' +
    '.isa-rd.open .isa-rd-btn{border-bottom-color:#F4B03E}' +
    '.isa-rd-chev{flex:none;width:8px;height:8px;border-right:1.4px solid #C98A2B;border-bottom:1.4px solid #C98A2B;transform:translateY(-3px) rotate(45deg);transition:transform 200ms var(--ease-out)}' +
    '.isa-rd.open .isa-rd-chev{transform:translateY(1px) rotate(225deg)}' +
    '.isa-rd-list{position:absolute;left:-10px;right:-10px;top:calc(100% + 6px);margin:0;padding:6px;list-style:none;background:#1F0C0F;' +
    'border:1px solid rgba(201,138,43,.45);border-radius:12px;box-shadow:0 18px 40px rgba(0,0,0,.45);opacity:0;transform:scale(.97) translateY(-4px);' +
    'transform-origin:top center;pointer-events:none;transition:opacity 150ms ease,transform 150ms var(--ease-out)}' +
    '.isa-rd.open .isa-rd-list{opacity:1;transform:none;pointer-events:auto;transition-duration:180ms}' +
    '.isa-rd-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 12px;border-radius:8px;cursor:pointer;' +
    'font:300 16px Poppins,sans-serif;color:#EDE3D0;transition:background 120ms ease,color 120ms ease}' +
    '.isa-rd-opt.active{background:rgba(201,138,43,.12);color:#FFFDF8}' +
    '.isa-rd-opt[aria-selected="true"]{color:#F4B03E}' +
    '.isa-rd-opt i{flex:none;width:6px;height:11px;border-right:1.6px solid #F4B03E;border-bottom:1.6px solid #F4B03E;transform:rotate(45deg) translateY(-2px);opacity:0}' +
    '.isa-rd-opt[aria-selected="true"] i{opacity:1}' +
    '@media (prefers-reduced-motion:reduce){.isa-rd *{transition-duration:.01s!important}}'
  var st = document.createElement('style')
  st.textContent = css
  document.head.appendChild(st)

  var uid = 0

  function build(label) {
    var input = label.querySelector('input')
    if (!input || label.querySelector('.isa-rd')) return
    var id = 'isa-rd-' + ++uid
    var box = document.createElement('div')
    box.className = 'isa-rd'
    box.innerHTML =
      '<button type="button" class="isa-rd-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '">' +
      '<span class="ph">Choose a time</span><span class="isa-rd-chev" aria-hidden="true"></span></button>' +
      '<ul class="isa-rd-list" role="listbox" id="' + id + '" tabindex="-1"></ul>'
    var btn = box.firstChild
    var list = box.lastChild
    var val = btn.firstChild
    // the label names the button for screen readers
    var name = (label.firstChild && label.firstChild.nodeType === 3 ? label.firstChild.nodeValue : 'When are you ready?').trim()
    btn.setAttribute('aria-label', name)
    list.setAttribute('aria-label', name)
    var opts = OPTIONS.map(function (t, i) {
      var li = document.createElement('li')
      li.className = 'isa-rd-opt'
      li.id = id + '-' + i
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', 'false')
      li.innerHTML = '<span></span><i aria-hidden="true"></i>'
      li.firstChild.textContent = t
      li.addEventListener('pointermove', function () { focus(i) })
      li.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pick(i) })
      list.appendChild(li)
      return li
    })
    var at = -1, chosen = OPTIONS.indexOf(input.value)

    function focus(i) {
      at = (i + opts.length) % opts.length
      opts.forEach(function (o, k) { o.classList.toggle('active', k === at) })
      btn.setAttribute('aria-activedescendant', opts[at].id)
    }
    function open() {
      if (box.classList.contains('open')) return
      document.querySelectorAll('.isa-rd.open').forEach(function (o) { if (o !== box) o.__close() })
      box.classList.add('open')
      btn.setAttribute('aria-expanded', 'true')
      focus(chosen >= 0 ? chosen : 0)
    }
    function close() {
      box.classList.remove('open')
      btn.setAttribute('aria-expanded', 'false')
      btn.removeAttribute('aria-activedescendant')
    }
    box.__close = close
    function pick(i) {
      chosen = i
      opts.forEach(function (o, k) { o.setAttribute('aria-selected', k === i ? 'true' : 'false') })
      val.textContent = OPTIONS[i]
      val.className = ''
      input.value = OPTIONS[i]
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      close()
      btn.focus()
    }
    if (chosen >= 0) pick(chosen)

    // the button sits inside the design's <label>: stop the label re-forwarding clicks
    btn.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      box.classList.contains('open') ? close() : open()
    })
    btn.addEventListener('keydown', function (e) {
      var isOpen = box.classList.contains('open')
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!isOpen) open()
        else focus(at + (e.key === 'ArrowDown' ? 1 : -1))
      } else if (e.key === 'Home' && isOpen) { e.preventDefault(); focus(0) }
      else if (e.key === 'End' && isOpen) { e.preventDefault(); focus(opts.length - 1) }
      else if ((e.key === 'Enter' || e.key === ' ') && isOpen) { e.preventDefault(); pick(at) }
      else if (e.key === 'Escape' && isOpen) { e.preventDefault(); close() }
      else if (e.key === 'Tab' && isOpen) close()
    })
    document.addEventListener('pointerdown', function (e) { if (!box.contains(e.target)) close() })

    input.style.display = 'none'
    input.setAttribute('aria-hidden', 'true')
    input.tabIndex = -1
    input.parentNode.insertBefore(box, input)
  }

  function scan() {
    document.querySelectorAll('label.fld').forEach(function (l) {
      var t = l.firstChild && l.firstChild.nodeType === 3 ? l.firstChild.nodeValue : l.textContent
      if (LABEL.test((t || '').trim())) build(l)
    })
  }

  // the design runtime renders late and can re-render: keep the dropdown in place (idempotent)
  var mo = new MutationObserver(scan)
  function start() { scan(); mo.observe(document.body, { childList: true, subtree: true }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
