/* Step-by-step inquiry form: product tiles, design upload, colours, specs (with custom option), size, quantity */
(function () {
  'use strict';
  var f = document.getElementById('inq-form'); if (!f) return;
  var $ = function (s, c) { return (c || f).querySelector(s); }, $$ = function (s, c) { return [].slice.call((c || f).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var product = '', colors = [], size = '', qty = '';
  var ON = ['bg-primary', 'text-surface-container-lowest', 'font-bold'], OFF = ['bg-surface-container', 'text-on-surface-variant'];
  function mark(b, s) { ON.forEach(function (c) { b.classList.toggle(c, s); }); OFF.forEach(function (c) { b.classList.toggle(c, !s); }); b.setAttribute('aria-pressed', String(s)); }
  function pick(btns, btn, multi) { var s = multi ? btn.getAttribute('aria-pressed') !== 'true' : true; if (!multi) btns.forEach(function (x) { mark(x, false); }); mark(btn, s); return s; }

  /* 1. product tiles from the live catalog */
  var tiles = $('#inq-tiles');
  fetch('/api/products').then(function (r) { return r.json(); }).then(function (ps) {
    var url = new URLSearchParams(location.search).get('product');
    tiles.innerHTML = ps.map(function (p) { return '<button type="button" data-p="' + esc(p.name) + '" data-s="' + esc(p.slug) + '" aria-pressed="false" class="text-left rounded-DEFAULT bg-surface-container-low overflow-hidden ring-2 ring-transparent aria-pressed:ring-primary"><div class="aspect-[4/3] bg-surface-container">' + (p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="" loading="lazy" referrerpolicy="no-referrer" class="w-full h-full object-cover">' : '') + '</div><div class="p-3 font-label-md text-label-md uppercase text-primary">' + esc(p.name) + '</div></button>'; }).join('') + '<button type="button" data-p="Other / custom product" aria-pressed="false" class="rounded-DEFAULT border-2 border-dashed border-outline-variant text-on-surface-variant p-4 grid place-items-center font-label-md text-label-md uppercase aria-pressed:ring-2 aria-pressed:ring-primary">Other / custom product</button>';
    $$('button[data-p]', tiles).forEach(function (b) { if (url && b.getAttribute('data-s') === url) select(b); b.onclick = function () { select(b); }; });
  }).catch(function () { tiles.innerHTML = '<p class="text-on-surface-variant">Could not load products. Type your product below.</p>'; });
  function select(b) { $$('button[data-p]', tiles).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); product = b.getAttribute('data-p'); $('#inq-custom-product').value = product === 'Other / custom product' ? $('#inq-custom-product').value : ''; }
  $('#inq-custom-product').addEventListener('input', function () { $$('button[data-p]', tiles).forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-p') === 'Other / custom product' ? 'true' : 'false'); }); product = 'Other / custom product'; });

  /* 2. design files */
  var fi = $('#inq-files'), fl = $('#inq-filelist');
  fi.addEventListener('change', function () {
    var bad = [].filter.call(fi.files, function (x) { return x.size > 5 * 1024 * 1024; });
    if (fi.files.length > 3 || bad.length) { fl.textContent = fi.files.length > 3 ? 'Please choose up to 3 files.' : 'Each file must be under 5 MB.'; fl.className = 'text-error text-body-sm mt-2'; fi.value = ''; return; }
    fl.className = 'text-on-surface-variant text-body-sm mt-2'; fl.textContent = [].map.call(fi.files, function (x) { return x.name; }).join(', ');
  });

  /* 3. colours */
  $$('#inq-colors button').forEach(function (b) { b.onclick = function () { var c = b.getAttribute('data-c'), s = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(s)); colors = colors.filter(function (x) { return x !== c; }); if (s) colors.push(c); b.style.boxShadow = s ? '0 0 0 3px rgb(var(--c-primary))' : ''; }; });

  /* 4. specs: "Custom…" reveals a text box */
  $$('select[data-spec]').forEach(function (s) { s.addEventListener('change', function () { var t = $('input[data-custom="' + s.name + '"]'); t.classList.toggle('hidden', s.value !== 'Custom'); if (s.value === 'Custom') t.focus(); }); });

  /* 5/6. size + quantity chips */
  function chips(sel, set) { var bs = $$(sel); bs.forEach(function (b) { b.onclick = function () { if (b.getAttribute('aria-pressed') === 'true') { mark(b, false); set(''); } else { pick(bs, b); set(b.getAttribute('data-v')); } }; }); }
  chips('#inq-sizes button', function (v) { size = v; }); chips('#inq-qty button', function (v) { qty = v; });

  /* submit */
  f.addEventListener('submit', function (e) {
    e.preventDefault(); var st = $('#inq-status'), btn = $('button[type=submit]');
    var prod = product === 'Other / custom product' ? ($('#inq-custom-product').value.trim() || product) : product;
    if (!prod) { st.textContent = 'Please choose a product type in step 2 (or describe your own).'; st.className = 'text-error text-body-sm'; $('#inq-tiles').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    var fields = { 'Colours': colors.join(', ') + ($('#inq-color-note').value ? ' | ' + $('#inq-color-note').value : ''), 'Size / capacity': size + ($('#inq-size-note').value ? ' | ' + $('#inq-size-note').value : ''), 'Country': $('[name=country]').value };
    $$('select[data-spec]').forEach(function (s) { var v = s.value === 'Custom' ? $('input[data-custom="' + s.name + '"]').value : s.value; if (v && !/^Select/.test(v)) fields[s.getAttribute('data-label')] = v; });
    var q = qty === 'custom' || !qty ? $('#inq-qty-custom').value : qty; if ($('#inq-qty-custom').value) q = $('#inq-qty-custom').value;
    var fd = new FormData(); fd.append('name', $('[name=name]').value); fd.append('company', $('[name=company]').value); fd.append('email', $('[name=email]').value); fd.append('phone', $('[name=phone]').value);
    fd.append('product', prod); fd.append('quantity', q); fd.append('message', $('#inq-notes').value); fd.append('fields', JSON.stringify(fields)); [].forEach.call(fi.files, function (x) { fd.append('files', x); });
    btn.disabled = true; st.className = 'text-on-surface-variant text-body-sm'; st.textContent = 'Submitting…';
    fetch('/api/inquiries', { method: 'POST', body: fd }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); }).then(function (j) {
      f.classList.add('hidden'); var ok = document.getElementById('inq-done'); ok.classList.remove('hidden'); document.getElementById('inq-ref').textContent = j.ref; document.getElementById('inq-wa').href = 'https://wa.me/923707730559?text=' + encodeURIComponent('Hello Bagzinic, I just submitted inquiry ' + j.ref + ' for ' + prod + '.'); ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function (er) { st.className = 'text-error text-body-sm'; st.textContent = er.message || 'Could not submit. Please try again or use WhatsApp.'; btn.disabled = false; });
  });
})();
