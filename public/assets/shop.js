/* Bagzinic – dynamic pages: products, product detail, blog, post, gallery */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var page = document.body.getAttribute('data-page');
  if (!page) return;
  var root = $('#app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  var params = new URLSearchParams(location.search);
  var PH = '<div class="w-full h-full grid place-items-center bg-surface-container-low text-outline"><span class="material-symbols-outlined text-[56px]">work</span></div>';
  function img(src, alt, cls) { return src ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="' + (cls || 'w-full h-full object-cover') + '">' : PH; }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function fail(msg) { root.innerHTML = '<div class="py-space-xl text-center text-on-surface-variant">' + esc(msg || 'Could not load this page. Please refresh.') + '</div>'; }
  function done() { document.dispatchEvent(new Event('bz:content')); }

  if (page === 'products') {
    Promise.all([get('/api/categories'), get('/api/products')]).then(function (r) {
      var cats = r[0], prods = r[1], cur = params.get('c') || 'all';
      function draw() {
        var list = prods.filter(function (p) { return cur === 'all' || (cats.filter(function (c) { return c.slug === cur; })[0] || {}).id === p.category_id; });
        var tabs = [{ slug: 'all', name: 'All products' }].concat(cats).map(function (c) { return '<button type="button" data-c="' + esc(c.slug) + '" class="px-4 py-2 rounded-full font-label-md text-label-md uppercase tracking-wider transition-all ' + (c.slug === cur ? 'bg-primary text-surface-container-lowest font-bold' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high') + '">' + esc(c.name) + '</button>'; }).join('');
        var cur_c = cats.filter(function (c) { return c.slug === cur; })[0];
        root.innerHTML = '<div class="flex flex-wrap gap-2 mb-space-lg" role="tablist">' + tabs + '</div>' + (cur_c && cur_c.description ? '<p class="text-on-surface-variant max-w-2xl mb-space-lg">' + esc(cur_c.description) + '</p>' : '') +
          (list.length ? '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">' + list.map(function (p) {
            return '<a href="product.html?p=' + encodeURIComponent(p.slug) + '" class="group flex flex-col bg-surface-container-low rounded-DEFAULT overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]"><div class="aspect-square overflow-hidden">' + img(p.images[0], p.name) + '</div><div class="p-space-md flex flex-col gap-1 flex-1"><h3 class="font-headline-sm text-headline-sm text-primary">' + esc(p.name) + '</h3><p class="font-body-sm text-body-sm text-on-surface-variant">' + esc(p.summary) + '</p><div class="mt-auto pt-space-sm flex justify-between font-label-sm text-label-sm uppercase text-on-surface-variant"><span>' + (p.moq ? 'MOQ: ' + esc(p.moq) : '') + '</span><span class="text-primary">View details</span></div></div></a>';
          }).join('') + '</div>' : '<p class="py-space-xl text-on-surface-variant">No products in this category yet. Check back soon or <a class="underline text-primary" href="contact.html">contact us</a> for a custom OEM quote.</p>');
        root.querySelectorAll('button[data-c]').forEach(function (b) { b.onclick = function () { cur = b.getAttribute('data-c'); history.replaceState(null, '', cur === 'all' ? 'products.html' : 'products.html?c=' + cur); draw(); }; });
        done();
      }
      draw();
    }).catch(function () { fail(); });
  }

  if (page === 'product') {
    var slug = params.get('p');
    get('/api/products/' + encodeURIComponent(slug || '')).then(function (p) {
      document.title = p.name + ' | OEM ' + p.category_name + ' | Bagzinic Industries';
      var cur = 0;
      root.innerHTML = '<nav class="font-label-sm text-label-sm uppercase text-on-surface-variant mb-space-md"><a href="products.html" class="hover:text-primary">Products</a> / <a href="products.html?c=' + esc(p.category_slug) + '" class="hover:text-primary">' + esc(p.category_name) + '</a></nav>' +
        '<div class="grid lg:grid-cols-2 gap-space-xl"><div><div id="pimg" class="aspect-square rounded-DEFAULT overflow-hidden bg-surface-container-low">' + img(p.images[0], p.name) + '</div><div id="pthumbs" class="flex gap-2 mt-3 flex-wrap"></div></div>' +
        '<div class="flex flex-col gap-space-md"><h1 class="font-display-xl text-headline-lg text-primary">' + esc(p.name) + '</h1><p class="text-on-surface-variant">' + esc(p.summary) + '</p>' +
        (p.details ? '<div class="text-on-surface-variant space-y-3">' + p.details.split(/\n{2,}/).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' : '') +
        (p.specs.length ? '<dl class="grid grid-cols-2 gap-x-4 gap-y-2 font-body-sm">' + p.specs.map(function (s) { var i = s.indexOf(':'); return i < 0 ? '<dt class="col-span-2 text-on-surface">' + esc(s) + '</dt>' : '<dt class="text-on-surface-variant">' + esc(s.slice(0, i)) + '</dt><dd class="text-primary">' + esc(s.slice(i + 1).trim()) + '</dd>'; }).join('') + '</dl>' : '') +
        (p.moq ? '<p class="font-label-md text-label-md uppercase text-primary">MOQ: ' + esc(p.moq) + (p.price_note ? ' · ' + esc(p.price_note) : '') + '</p>' : '') +
        '<div class="flex flex-wrap gap-3">' + (p.customizable ? '<a class="px-space-lg py-3 rounded-full bg-primary text-surface-container-lowest font-label-lg text-label-lg uppercase font-bold" href="customize.html?product=' + esc(p.slug) + '">Customize this product</a>' : '') + '<a class="px-space-lg py-3 rounded-full bg-surface-container-high text-primary font-label-lg text-label-lg uppercase" href="#quote">Request a quote</a></div></div></div>' +
        '<section id="quote" class="mt-space-xl max-w-2xl"><h2 class="font-headline-md text-headline-md text-primary mb-space-md">Request a quote for ' + esc(p.name) + '</h2>' + quoteForm(p.name) + '</section>';
      var th = $('#pthumbs'); if (p.images.length > 1) p.images.forEach(function (s, i) { var b = document.createElement('button'); b.type = 'button'; b.className = 'w-16 h-16 rounded-lg overflow-hidden'; b.innerHTML = img(s, p.name + ' ' + (i + 1)); b.onclick = function () { $('#pimg').innerHTML = img(s, p.name); }; th.appendChild(b); });
      done(); document.dispatchEvent(new Event('bz:forms'));
    }).catch(function () { fail('This product was not found. It may have been removed.'); });
  }
  function quoteForm(product) {
    var f = 'w-full bg-surface-container-low rounded-DEFAULT px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary';
    return '<form data-api="/api/inquiries" data-multipart class="grid sm:grid-cols-2 gap-3"><input type="hidden" name="product" value="' + esc(product) + '"><input class="' + f + '" name="name" placeholder="Your name" required><input class="' + f + '" name="company" placeholder="Company"><input class="' + f + '" type="email" name="email" placeholder="Email" required><input class="' + f + '" name="phone" placeholder="Phone / WhatsApp"><input class="' + f + ' sm:col-span-2" name="quantity" placeholder="Quantity (e.g. 500 units)"><textarea class="' + f + ' sm:col-span-2" name="message" rows="4" placeholder="Tell us about colors, logo, fabric, deadlines"></textarea><button class="sm:col-span-2 px-space-lg py-3 rounded-full bg-primary text-surface-container-lowest font-label-lg text-label-lg uppercase font-bold" type="submit">Send inquiry</button><p class="bz-status sm:col-span-2 text-body-sm" role="status"></p></form>';
  }

  if (page === 'blog') {
    get('/api/posts').then(function (ps) {
      root.innerHTML = ps.length ? '<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-gutter">' + ps.map(function (p) {
        return '<a href="post.html?s=' + encodeURIComponent(p.slug) + '" class="group flex flex-col bg-surface-container-low rounded-DEFAULT overflow-hidden"><div class="aspect-[16/10] overflow-hidden">' + img(p.cover, p.title) + '</div><div class="p-space-md flex flex-col gap-2"><span class="font-label-sm text-label-sm uppercase text-on-surface-variant">' + fmtDate(p.created_at) + '</span><h2 class="font-headline-sm text-headline-sm text-primary">' + esc(p.title) + '</h2><p class="font-body-sm text-body-sm text-on-surface-variant">' + esc(p.excerpt) + '</p><span class="font-label-sm text-label-sm uppercase text-primary mt-2">Read article</span></div></a>';
      }).join('') + '</div>' : '<p class="text-on-surface-variant">No articles yet.</p>';
      done();
    }).catch(function () { fail(); });
  }
  if (page === 'post') {
    get('/api/posts/' + encodeURIComponent(params.get('s') || '')).then(function (p) {
      document.title = p.title + ' | Bagzinic Blog';
      var html = esc(p.content).split(/\n{2,}/).map(function (b) { return /^## /.test(b) ? '<h2 class="font-headline-md text-headline-md text-primary mt-space-lg mb-2">' + b.slice(3) + '</h2>' : '<p class="mb-4">' + b.replace(/\n/g, '<br>') + '</p>'; }).join('');
      root.innerHTML = '<a href="blog.html" class="font-label-sm text-label-sm uppercase text-on-surface-variant hover:text-primary">&larr; All articles</a><h1 class="font-display-xl text-headline-lg text-primary mt-space-md">' + esc(p.title) + '</h1><p class="font-label-sm text-label-sm uppercase text-on-surface-variant mt-2 mb-space-lg">' + fmtDate(p.created_at) + ' · Bagzinic Industries</p>' + (p.cover ? '<div class="aspect-[16/8] rounded-DEFAULT overflow-hidden mb-space-lg">' + img(p.cover, p.title) + '</div>' : '') + '<div class="text-on-surface-variant font-body-lg text-body-lg leading-relaxed">' + html + '</div><div class="mt-space-xl p-space-lg rounded-DEFAULT bg-surface-container-low"><p class="text-primary font-headline-sm text-headline-sm">Planning a custom bag order?</p><a href="oem-custom-orders.html" class="inline-block mt-3 px-space-lg py-3 rounded-full bg-primary text-surface-container-lowest font-label-lg text-label-lg uppercase font-bold">Get an OEM quote</a></div>';
      done();
    }).catch(function () { fail('Article not found.'); });
  }
  if (page === 'gallery') {
    get('/api/gallery').then(function (g) {
      root.innerHTML = g.length ? '<div class="columns-1 sm:columns-2 lg:columns-3 gap-gutter [&>*]:mb-gutter">' + g.map(function (x, i) { return '<button type="button" data-i="' + i + '" class="block w-full rounded-DEFAULT overflow-hidden relative group">' + img(x.url, x.caption || 'Bagzinic factory photo', 'w-full h-auto') + (x.caption ? '<span class="absolute inset-x-0 bottom-0 p-3 text-left text-sm text-primary bg-gradient-to-t from-background/90 to-transparent">' + esc(x.caption) + '</span>' : '') + '</button>'; }).join('') + '</div>' : '<p class="text-on-surface-variant">Photos coming soon.</p>';
      var lb = document.createElement('div'); lb.className = 'fixed inset-0 z-[9600] bg-black/90 hidden items-center justify-center p-4'; lb.innerHTML = '<button type="button" aria-label="Close" class="absolute top-4 right-4 text-white text-3xl">&times;</button><button type="button" data-d="-1" aria-label="Previous" class="absolute left-3 text-white text-4xl">&lsaquo;</button><img class="max-h-[88vh] max-w-[92vw] rounded-lg" alt=""><button type="button" data-d="1" aria-label="Next" class="absolute right-3 text-white text-4xl">&rsaquo;</button>'; document.body.appendChild(lb);
      var cur = 0, im = lb.querySelector('img'); function show(i) { cur = (i + g.length) % g.length; im.src = g[cur].url; im.alt = g[cur].caption || ''; lb.classList.remove('hidden'); lb.classList.add('flex'); }
      function hide() { lb.classList.add('hidden'); lb.classList.remove('flex'); }
      root.querySelectorAll('button[data-i]').forEach(function (b) { b.onclick = function () { show(+b.getAttribute('data-i')); }; });
      lb.onclick = function (e) { var d = e.target.getAttribute && e.target.getAttribute('data-d'); if (d) show(cur + +d); else if (e.target !== im) hide(); };
      document.addEventListener('keydown', function (e) { if (lb.classList.contains('hidden')) return; if (e.key === 'Escape') hide(); if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
      done();
    }).catch(function () { fail(); });
  }
})();
