/* Bagzinic – shared behaviour: preloader, progress bar, story reveals, parallax, menu, search, forms */
(function () {
  'use strict';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WA = '923707730559';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var waLink = function (t) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t); };
  function toast(msg) {
    var t = $('#bz-toast'); if (!t) { t = document.createElement('div'); t.id = 'bz-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  window.bzToast = toast;

  /* 1. Preloader (logo intro on every page open) */
  var pre = $('#bz-pre'), t0 = performance.now();
  function hidePre() {
    if (!pre || pre.dataset.done) return; pre.dataset.done = 1;
    var wait = Math.max(0, (RM ? 0 : 1350) - (performance.now() - t0));
    setTimeout(function () {
      pre.classList.add('bz-pre-out'); document.documentElement.classList.add('bz-ready');
      setTimeout(function () { pre.remove(); }, 1000);
    }, wait);
  }
  if (document.readyState === 'complete') hidePre(); else addEventListener('load', hidePre);
  setTimeout(hidePre, 3500);

  function init() {

    /* 0. Your logo: drop assets/images/logo.png (or .svg/.webp/.jpg) and it replaces the gear icon everywhere */
    (function () {
      var exts = ['png', 'svg', 'webp', 'jpg'], i = 0;
      (function next() {
        if (i >= exts.length) return; var src = 'assets/images/logo.' + exts[i++], im = new Image();
        im.onerror = next;
        im.onload = function () {
          var tag = function () { return '<img src="' + src + '" alt="Bagzinic Industries logo" class="w-full h-full object-contain" decoding="async">'; };
          var hl = $('header a[data-path="home"] > div:first-child');
          if (hl) { hl.innerHTML = tag(); hl.classList.remove('rounded-full'); hl.style.cssText += ';background:transparent;box-shadow:none;width:48px;height:48px'; hl.classList.add('bz-has-logo'); }
          var fl = $('footer .w-8.h-8.rounded-full'); if (fl) { fl.innerHTML = tag(); fl.classList.remove('rounded-full'); fl.style.cssText += ';background:transparent;width:40px;height:40px'; }
          var pl = $('#bz-pre .bz-logo'); if (pl) { var pi = document.createElement('img'); pi.src = src; pi.alt = ''; pi.className = 'bz-logo-img'; pl.replaceWith(pi); }
          var ic = $('link[rel="icon"]'); if (ic) { ic.href = src; ic.removeAttribute('type'); }
        };
        im.src = src;
      })();
    })();
    /* 2. Scroll progress bar */
    var old = $('#scroll-progress'); if (old) old.remove();
    var bar = document.createElement('div'); bar.id = 'bz-progress'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>';
    document.body.appendChild(bar); var fill = bar.firstChild;

    /* 3. Auto-tag glossy buttons / cards (only if position is static, so nothing breaks) */
    $$('a,button').forEach(function (el) {
      var c = el.className || ''; if (typeof c !== 'string') return;
      if (c.indexOf('rounded-full') > -1 && /bg-primary|bg-surface|bg-white/.test(c) && el.offsetWidth > 70 && !el.closest('#bz-drawer,#bz-search,#bz-rail')) {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
        el.classList.add('bz-gloss'); if (/bg-primary(\s|$)/.test(c)) el.classList.add('bz-pulse');
      }
    });
    $$('main [class*="rounded-DEFAULT"],main [class*="rounded-lg"],main [class*="rounded-xl"]').forEach(function (el) {
      var c = el.className; if (typeof c !== 'string' || !/bg-surface-container|bg-surface-bright|bg-surface\//.test(c)) return;
      if (el.offsetWidth < 160 || el.offsetHeight < 90 || el.closest('form,#bz-drawer')) return;
      if (/\b(fixed|absolute|sticky)\b/.test(c)) return;
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.classList.add('bz-card');
      el.addEventListener('pointermove', function (e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
    $$('main h2').forEach(function (h) { if (/text-primary/.test(h.className) && !h.querySelector('*')) h.classList.add('bz-shine'); });

    /* 4. Headline word-by-word reveal */
    $$('main h1').forEach(function (h) {
      var n = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
          if (ch.nodeType === 3 && ch.textContent.trim()) {
            var f = document.createDocumentFragment();
            ch.textContent.split(/(\s+)/).forEach(function (w) {
              if (!w) return; if (/^\s+$/.test(w)) { f.appendChild(document.createTextNode(' ')); return; }
              var o = document.createElement('span'); o.className = 'bz-w'; o.style.setProperty('--i', n++);
              var i = document.createElement('span'); i.textContent = w; o.appendChild(i); f.appendChild(o);
            });
            ch.parentNode.replaceChild(f, ch);
          } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
        });
      })(h);
      if (document.documentElement.classList.contains('bz-ready')) $$('.bz-w', h).forEach(function (w) { w.classList.add('bz-now'); });
    });

    /* 5. Storytelling scroll reveals (alternating directions) */
    var cand = $$('main h2,main h3,main section p,main .grid > *,main section form,main section figure,main [class*="flex-col"] > *').filter(function (el) {
      return !el.closest('h1,#bz-rail,.bz-rv') && !el.matches('.hidden,script,style') && !el.querySelector('.bz-rv');
    });
    var seen = [];
    cand = cand.filter(function (el) { for (var i = 0; i < seen.length; i++) if (seen[i].contains(el) || el.contains(seen[i])) return false; seen.push(el); return true; });
    var io = ('IntersectionObserver' in window && !RM) ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; var el = e.target; io.unobserve(el); el.classList.add('bz-in');
        setTimeout(function () { el.classList.remove('bz-rv', 'bz-in'); el.removeAttribute('data-bz'); el.style.removeProperty('--d'); }, 1600);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' }) : null;
    if (io) cand.forEach(function (el) {
      var sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      var kind = /^H[23]$/.test(el.tagName) ? 'up' : (el.parentElement && /grid/.test(el.parentElement.className) ? (['left', 'zoom', 'right'][sib % 3]) : 'up');
      el.setAttribute('data-bz', kind); el.style.setProperty('--d', Math.min(sib, 5) * 80 + 'ms'); el.classList.add('bz-rv'); io.observe(el);
    });

    /* 6. Images: scroll-driven parallax + rotation, floating product shots */
    var imgs = $$('main img').filter(function (i) { return !i.closest('header,footer'); });
    var vis = new Set();
    var vio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? vis.add(e.target) : vis.delete(e.target); }); tick(); }, { rootMargin: '15% 0px' }) : null;
    imgs.forEach(function (img) {
      var contain = /object-contain/.test(img.className);
      if (!RM) { img.classList.add(contain ? 'bz-float' : 'bz-par'); if (vio) vio.observe(img); }
      if (img.hasAttribute('data-alt') && !img.alt) img.alt = img.getAttribute('data-alt');
      if (!img.complete) img.addEventListener('error', function () { img.style.opacity = .25; img.alt = img.alt || 'Bagzinic Industries'; }, { once: true });
    });
    var ticking = false;
    function paint() {
      ticking = false; var vh = innerHeight;
      var m = document.documentElement.scrollHeight - vh; fill.style.transform = 'scaleX(' + (m > 0 ? Math.min(1, scrollY / m) : 0) + ')';
      vis.forEach(function (img) {
        var r = img.getBoundingClientRect(), c = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); c = Math.max(-1.2, Math.min(1.2, c));
        var contain = img.classList.contains('bz-float');
        img.style.setProperty('--bz-ty', (c * (contain ? -16 : -34)).toFixed(1) + 'px');
        img.style.setProperty('--bz-rot', (c * (contain ? 4 : 2.4)).toFixed(2) + 'deg');
      });
    }
    function tick() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    addEventListener('scroll', tick, { passive: true }); addEventListener('resize', tick); tick();

    /* 7. Story rail (section dots) */
    var secs = $$('main > section, main > div > section').filter(function (s) { return s.offsetHeight > 200; });
    if (secs.length > 2 && 'IntersectionObserver' in window) {
      var rail = document.createElement('div'); rail.id = 'bz-rail'; rail.setAttribute('aria-hidden', 'true');
      var dots = secs.map(function (s, i) { var b = document.createElement('button'); b.tabIndex = -1; b.addEventListener('click', function () { s.scrollIntoView({ behavior: 'smooth' }); }); rail.appendChild(b); return b; });
      document.body.appendChild(rail);
      var sio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { dots.forEach(function (d) { d.classList.remove('on'); }); dots[secs.indexOf(e.target)].classList.add('on'); } }); }, { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(function (s) { sio.observe(s); });
    }

    /* 7b. Light / dark mode */
    var hdrR = $('header .shrink-0:last-child');
    if (hdrR) {
      var tb = document.createElement('button'); tb.type = 'button'; tb.className = 'bz-theme'; tb.id = 'bz-theme'; hdrR.insertBefore(tb, hdrR.firstChild);
      var setTheme = function (t, save) { document.documentElement.setAttribute('data-theme', t); tb.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode'); tb.title = tb.getAttribute('aria-label'); tb.innerHTML = '<span class="material-symbols-outlined text-[18px]">' + (t === 'light' ? 'dark_mode' : 'light_mode') + '</span>'; if (save) { try { localStorage.setItem('bz-theme', t); } catch (e) { } } };
      setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
      tb.addEventListener('click', function () { setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true); });
    }
    /* 8. Mobile menu */
    var hdr = $('header'), navEl = $('header nav');
    if (hdr && navEl) {
      var ctr = $('header .shrink-0:last-child') || hdr.firstElementChild;
      var burger = document.createElement('button'); burger.className = 'bz-burger'; burger.type = 'button'; burger.setAttribute('aria-label', 'Open menu'); burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML = '<span class="material-symbols-outlined">menu</span>'; ctr.appendChild(burger);
      var dr = document.createElement('div'); dr.id = 'bz-drawer'; dr.innerHTML = '<div class="bg"></div><nav aria-label="Mobile"></nav>'; document.body.appendChild(dr);
      var dn = $('nav', dr);
      $$('a[href]', navEl).forEach(function (a) { var l = document.createElement('a'); l.href = a.getAttribute('href'); l.textContent = a.textContent.replace('expand_more', '').trim(); if (a.closest('.absolute')) l.className = 'sub'; if (a.getAttribute('aria-current')) l.setAttribute('aria-current', 'page'); dn.appendChild(l); });
      var cta = document.createElement('a'); cta.href = waLink('Hello Bagzinic Industries, I am interested in OEM manufacturing.'); cta.target = '_blank'; cta.rel = 'noopener'; cta.textContent = 'WhatsApp us'; dn.appendChild(cta);
      var setOpen = function (o) { dr.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); document.body.style.overflow = o ? 'hidden' : ''; burger.firstChild.textContent = o ? 'close' : 'menu'; burger.style.position = o ? 'relative' : ''; burger.style.zIndex = o ? 9100 : ''; };
      burger.addEventListener('click', function () { setOpen(!dr.classList.contains('open')); });
      $('.bg', dr).addEventListener('click', function () { setOpen(false); }); dn.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });
      addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    }

    /* 9. Search palette (Ctrl/Cmd+K or the search button) */
    var base = (document.documentElement.getAttribute('data-root') || '');
    var idx = [['Home', 'index.html', 'Crafted in Pakistan, engineered for the world'], ['Products', 'products.html', 'Browse all categories and products'], ['Instant OEM quote estimator', 'index.html#quote-estimator', 'Pick bag, fabric and quantity'], ['3D bag customizer', 'customize.html', 'Design colours, shape and logo in 3D'], ['Request a quote (inquiry form)', 'inquiry.html', 'Choose product, upload design, colours, specs, quantity'], ['OEM & custom orders', 'oem-custom-orders.html', 'Private label, tech pack, inquiry form'], ['About – factory virtual tour', 'about.html', 'Sialkot plant and inspection booking'], ['Our journey', 'our-journey.html', 'Timeline and milestones'], ['Quality control', 'quality.html', 'Our inspection and testing process'], ['Gallery', 'gallery.html', 'Factory and product photos'], ['Blog', 'blog.html', 'Guides on fabrics, MOQ and production'], ['Careers – send your CV', 'careers.html', 'Join the Bagzinic team'], ['Contact', 'contact.html', 'Phone, WhatsApp, email and map'], ['FAQ', 'index.html#faq-container', 'MOQ, lead time, shipping'], ['Privacy & terms', 'legal.html', 'Legal']];
    var sw = document.createElement('div'); sw.id = 'bz-search'; sw.setAttribute('role', 'dialog'); sw.setAttribute('aria-label', 'Search the site');
    sw.innerHTML = '<div class="box"><input type="search" placeholder="Search pages…" aria-label="Search"><ul></ul></div>'; document.body.appendChild(sw);
    var si = $('input', sw), ul = $('ul', sw);
    function render(q) { q = (q || '').toLowerCase(); ul.innerHTML = ''; idx.filter(function (r) { return !q || (r[0] + ' ' + r[2]).toLowerCase().indexOf(q) > -1; }).forEach(function (r, i) { var li = document.createElement('li'); li.innerHTML = '<a href="' + base + r[1] + '"' + (i === 0 ? ' class="act"' : '') + '>' + r[0] + '<small>' + r[2] + '</small></a>'; ul.appendChild(li); }); if (!ul.children.length) ul.innerHTML = '<li><a href="#" onclick="return false">No match – try “quote”, “factory” or “OEM”</a></li>'; }
    function openS(o) { sw.classList.toggle('open', o); if (o) { render(''); si.value = ''; setTimeout(function () { si.focus(); }, 30); } }
    si.addEventListener('input', function () { render(si.value); });
    si.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var a = $('a.act', ul) || $('a', ul); if (a && a.getAttribute('href') !== '#') location.href = a.href; } });
    sw.addEventListener('click', function (e) { if (e.target === sw) openS(false); });
    addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openS(true); } if (e.key === 'Escape') openS(false); });
    $$('header button').forEach(function (b) { if (/search/.test(b.textContent) || /search/i.test(b.title || '')) b.addEventListener('click', function () { openS(true); }); });

    /* 10. Forms -> backend API */
    function send(f, url, multi, ok) {
      var st = $('.bz-status', f), btn = $('[type=submit]', f), fd = new FormData(f);
      if (btn) btn.disabled = true; if (st) { st.textContent = 'Sending…'; st.className = 'bz-status text-on-surface-variant'; }
      var opt = multi ? { method: 'POST', body: fd } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd.entries())) };
      return fetch(url, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; }); })
        .then(function (j) { f.reset(); if (st) { st.textContent = ok || 'Sent! We will reply soon.'; st.className = 'bz-status text-primary'; } toast(ok || 'Sent! We will reply soon.'); return j; })
        .catch(function (e) { if (st) { st.textContent = e.message; st.className = 'bz-status text-error'; } else toast(e.message); })
        .then(function (j) { if (btn) btn.disabled = false; return j; });
    }
    function wireForms() { $$('form[data-api]').forEach(function (f) { if (f._bz) return; f._bz = 1; f.addEventListener('submit', function (e) { e.preventDefault(); send(f, f.dataset.api, f.hasAttribute('data-multipart')); }); }); }
    wireForms(); document.addEventListener('bz:forms', wireForms);
    $$('footer form').forEach(function (f) {
      var i = $('input', f); if (i) i.name = 'email';
      f.addEventListener('submit', function (e) { e.preventDefault(); if (!i || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value)) { toast('Please enter a valid email address'); if (i) i.focus(); return; } send(f, '/api/newsletter', false, 'Thanks! You are subscribed.'); });
    });
    var of = $('#oem-master-form');
    if (of) document.addEventListener('submit', function (ev) {
      if (ev.target !== of || !of.checkValidity()) return;
      var f = {}, fd = new FormData();
      $$('input,select,textarea', of).forEach(function (el) { var k = el.name || el.id; if (!k || el.type === 'file') return; if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return; f[k] = f[k] ? f[k] + ', ' + el.value : el.value; });
      $$('input[type=file]', of).forEach(function (i) { [].forEach.call(i.files || [], function (file) { fd.append('files', file); }); });
      var v = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
      fd.append('fields', JSON.stringify(f)); fd.append('name', v('contact-fullname') || v('contact-company')); fd.append('company', v('contact-company')); fd.append('email', v('contact-email')); fd.append('phone', v('contact-phone'));
      var prod = $('#modal-summary-prod'); fd.append('product', (prod && prod.textContent) || v('custom-archetype-name') || 'OEM inquiry'); fd.append('quantity', f.order_volume || v('order_volume')); fd.append('message', [v('engineering-notes'), v('color-placement-notes')].filter(Boolean).join('\n'));
      fetch('/api/inquiries', { method: 'POST', body: fd }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.ref) { var rc = $('#modal-ref-code'), wl = $('#modal-whatsapp-link'); if (rc) { var old = rc.textContent; rc.textContent = j.ref; if (wl) wl.href = wl.href.split(encodeURIComponent(old)).join(encodeURIComponent(j.ref)); } }
        else if (j.error) toast(j.error);
      }).catch(function () { toast('Could not save online – please also send via WhatsApp.'); });
    }, true);
    if (document.documentElement.hasAttribute('data-root')) $$('main button').forEach(function (b) {
      if (b.hasAttribute('onclick') || b.closest('form') || b.getAttribute('type') === 'submit') return;
      b.addEventListener('click', function () { toast('Demo console: connect your backend API to enable this action'); });
    });
    $$('a[href="#"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });

    /* 11. Assistant (answers from the site FAQ, hands off to WhatsApp) */
    var KB = [
      [/moq|minimum|quantity|how many|units/, 'What is the MOQ?', 'Pilot MOQ starts at 200–250 units per colorway for tactical backpacks and luggage, and 500 units for lighter accessories and drawstring packs. Custom branded components can be included from the first run.'],
      [/tech ?pack|cad|illustrator|design file|artwork|logo|bom/, 'Can I send my own tech pack?', 'Yes. We accept Illustrator (.ai), PDF tech packs and 3D CAD files. Our engineers turn your bill of materials into laser-cutting plots within 72 hours.'],
      [/ship|freight|fob|cif|courier|dhl|fedex|deliver|export/, 'How does shipping work?', 'We ship FOB Karachi or CIF to your destination port. Samples and prototypes leave daily by DHL or FedEx from Sialkot International Airport.'],
      [/lead|time|days|how long|production|sample|prototype|fast/, 'Lead time and samples?', 'Production takes about 20–25 days below 500 units, 25–30 days up to 2,000 units and 35–45 days above that. Prototype delivery SLA is 30 days.'],
      [/solar|green|sustain|recycl|grs|rpet|eco|carbon/, 'Sustainability?', 'The 3-storey Sialkot campus runs on rooftop solar with net-zero day-shift emissions, and we source 100% GRS-certified recycled polyester and rPET fabric.'],
      [/price|cost|quote|rate|cheap|budget/, 'How do I get a price?', 'Price depends on fabric, hardware and quantity. Try the quote estimator on the home page, or send your spec and we reply with a formal quotation.']
    ];
    var ab = $$('button[title*="Assistant"]')[0];
    if (ab) {
      var ch = document.createElement('div'); ch.id = 'bz-chat'; ch.setAttribute('role', 'dialog'); ch.setAttribute('aria-label', 'Bagzinic assistant');
      ch.innerHTML = '<header><span class="material-symbols-outlined">smart_toy</span>Bagzinic assistant<button type="button" aria-label="Close chat"><span class="material-symbols-outlined">close</span></button></header><div class="msgs"></div><div class="chips"></div><form><input aria-label="Your question" placeholder="Ask about MOQ, shipping, lead time…" autocomplete="off"><button type="submit">Send</button></form>';
      document.body.appendChild(ch);
      var ms = $('.msgs', ch), cp = $('.chips', ch), ci = $('input', ch), started = false;
      var say = function (t, who, extra) { var d = document.createElement('div'); d.className = 'm ' + who; d.textContent = t; if (extra) d.appendChild(extra); ms.appendChild(d); ms.scrollTop = ms.scrollHeight; };
      var human = function (q) { var a = document.createElement('a'); a.className = 'h'; a.target = '_blank'; a.rel = 'noopener'; a.href = waLink('Hello Bagzinic Industries, ' + (q || 'I have a question about OEM manufacturing.')); a.textContent = 'Continue on WhatsApp'; return a; };
      var ask = function (q) {
        say(q, 'u'); var hit = null; KB.forEach(function (k) { if (!hit && (k[1] === q || k[0].test(q.toLowerCase()))) hit = k; });
        setTimeout(function () { hit ? say(hit[2], 'b') : say('I could not find that in our FAQ, so a person on the sales team should answer it.', 'b', human(q)); }, 450);
      };
      KB.forEach(function (k) { var b = document.createElement('button'); b.type = 'button'; b.textContent = k[1]; b.addEventListener('click', function () { ask(k[1]); }); cp.appendChild(b); });
      var open = function (o) { ch.classList.toggle('open', o); if (o && !started) { started = true; say('Hi! I answer common OEM questions from our FAQ. Pick a topic or type your question.', 'b'); } if (o) setTimeout(function () { ci.focus(); }, 300); };
      ab.addEventListener('click', function () { open(!ch.classList.contains('open')); });
      $('header button', ch).addEventListener('click', function () { open(false); });
      $('form', ch).addEventListener('submit', function (e) { e.preventDefault(); if (ci.value.trim()) { ask(ci.value.trim()); ci.value = ''; } });
      addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
    }
    if (!RM) document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target) return;
      var u; try { u = new URL(a.href); } catch (x) { return; }
      if (u.origin !== location.origin || u.pathname === location.pathname || !/\.html$|\/$/.test(u.pathname)) return;
      e.preventDefault(); document.body.classList.add('bz-leave'); setTimeout(function () { location.href = a.href; }, 320);
    });
    addEventListener('pageshow', function (e) { if (e.persisted) document.body.classList.remove('bz-leave'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
