/* Bagzinic admin – POS-style catalog, inquiries, CVs, blog, gallery */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); }, $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var app = $('#adm'), view = 'dashboard', cats = [], curCat = null;
  var B = 'px-4 py-2 rounded-full font-label-md text-label-md uppercase tracking-wider transition-all ', BP = B + 'bg-primary text-surface-container-lowest font-bold', BS = B + 'bg-surface-container-high text-on-surface hover:bg-surface-bright', BD = B + 'bg-error-container text-on-error-container';
  var INP = 'w-full bg-surface-container rounded-DEFAULT px-3 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary';
  function toast(m) { if (window.bzToast) window.bzToast(m); else alert(m); }
  function api(url, method, body) {
    return fetch(url, { method: method || 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401 && url.indexOf('login') < 0) { showLogin(); throw new Error('Please log in'); }
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Error'); return j; });
    });
  }
  function fmt(d) { try { return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } }

  /* ----- login ----- */
  function showLogin() {
    $('#shell').classList.add('hidden'); $('#login').classList.remove('hidden');
  }
  $('#login form').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, st = $('.bz-status', f);
    api('/api/admin/login', 'POST', { user: f.user.value, pass: f.pass.value }).then(boot).catch(function (er) { st.textContent = er.message; });
  });
  $('#logout').onclick = function () { api('/api/admin/logout', 'POST', {}).then(showLogin); };
  function boot() { $('#login').classList.add('hidden'); $('#shell').classList.remove('hidden'); go(view); }
  api('/api/admin/me').then(boot).catch(showLogin);

  /* ----- nav ----- */
  $$('[data-v]').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-v')); }; });
  function go(v) {
    view = v; $$('[data-v]').forEach(function (b) { var a = b.getAttribute('data-v') === v; b.className = 'text-left px-4 py-2.5 rounded-DEFAULT font-label-md text-label-md uppercase tracking-wider whitespace-nowrap ' + (a ? 'bg-primary text-surface-container-lowest font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'); });
    app.innerHTML = '<p class="text-on-surface-variant">Loading…</p>'; (VIEWS[v] || VIEWS.dashboard)().catch(function (e) { app.innerHTML = '<p class="text-error">' + esc(e.message) + '</p>'; });
  }

  /* ----- modal ----- */
  function modal(title, body, onSave, wide) {
    var m = document.createElement('div'); m.className = 'fixed inset-0 z-[9700] bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-auto p-4';
    m.innerHTML = '<form class="bg-surface-container rounded-lg p-space-lg w-full ' + (wide ? 'max-w-3xl' : 'max-w-lg') + ' my-8 space-y-3"><h2 class="font-headline-md text-headline-md text-primary">' + esc(title) + '</h2>' + body + '<p class="bz-status text-error text-body-sm"></p><div class="flex gap-2 justify-end pt-2"><button type="button" data-x class="' + BS + '">Cancel</button><button type="submit" class="' + BP + '">Save</button></div></form>';
    document.body.appendChild(m); $('[data-x]', m).onclick = function () { m.remove(); };
    $('form', m).addEventListener('submit', function (e) { e.preventDefault(); var st = $('.bz-status', m); st.textContent = ''; Promise.resolve(onSave($('form', m))).then(function () { m.remove(); }).catch(function (er) { st.textContent = er.message; }); });
    return m;
  }
  function field(label, html) { return '<label class="block"><span class="font-label-sm text-label-sm uppercase text-on-surface-variant">' + label + '</span>' + html + '</label>'; }
  function confirmDel(what) { return confirm('Delete ' + what + '? This cannot be undone.'); }

  /* ----- image upload (resized in the browser, stored in the database) ----- */
  function resize(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onerror = rej; r.onload = function () { var im = new Image(); im.onerror = rej; im.onload = function () { var k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/webp', .82)); }; im.src = r.result; }; r.readAsDataURL(file);
    });
  }
  function upload(file) { return resize(file).then(function (d) { return api('/api/admin/media', 'POST', { dataUrl: d }); }).then(function (r) { return r.url; }); }
  function picker(box, urls, multi) {
    function draw() { box.innerHTML = urls.map(function (u, i) { return '<div class="relative w-20 h-20 rounded-lg overflow-hidden bg-surface-container-low"><img src="' + esc(u) + '" class="w-full h-full object-cover" alt=""><button type="button" data-rm="' + i + '" class="absolute top-0 right-0 bg-black/70 text-white w-6 h-6" aria-label="Remove">&times;</button></div>'; }).join('') + '<label class="w-20 h-20 rounded-lg border-2 border-dashed border-outline-variant grid place-items-center cursor-pointer text-on-surface-variant text-2xl">+<input type="file" accept="image/*" ' + (multi ? 'multiple' : '') + ' class="hidden"></label>'; }
    draw(); box.onclick = function (e) { var b = e.target.closest('[data-rm]'); if (b) { urls.splice(+b.getAttribute('data-rm'), 1); draw(); } };
    box.onchange = function (e) { if (e.target.type !== 'file') return; var fs = [].slice.call(e.target.files); toast('Uploading…'); fs.reduce(function (p, f) { return p.then(function () { return upload(f).then(function (u) { urls.push(u); draw(); }); }); }, Promise.resolve()).catch(function (er) { toast(er.message); }); };
  }

  var VIEWS = {
    dashboard: function () {
      return api('/api/admin/stats').then(function (s) {
        var card = function (n, l, v) { return '<button type="button" data-v="' + v + '" class="text-left p-space-lg rounded-DEFAULT bg-surface-container-low hover:bg-surface-container-high"><div class="font-display-xl text-headline-lg text-primary">' + n + '</div><div class="font-label-md text-label-md uppercase text-on-surface-variant">' + l + '</div></button>'; };
        app.innerHTML = '<h1 class="font-headline-lg text-headline-lg text-primary mb-space-lg">Dashboard</h1><div class="grid grid-cols-2 lg:grid-cols-4 gap-gutter">' + card(s.newInquiries, 'New inquiries', 'inquiries') + card(s.products, 'Products', 'products') + card(s.applications, 'CVs received', 'applications') + card(s.subscribers, 'Subscribers', 'subscribers') + card(s.contacts, 'Messages', 'contacts') + card(s.categories, 'Categories', 'products') + card(s.posts, 'Blog posts', 'posts') + card(s.inquiries, 'All inquiries', 'inquiries') + '</div>';
        $$('[data-v]', app).forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-v')); }; });
      });
    },
    products: function () {
      return Promise.all([api('/api/admin/categories'), api('/api/admin/products')]).then(function (r) {
        cats = r[0]; var prods = r[1]; if (!curCat || !cats.some(function (c) { return c.id === curCat; })) curCat = cats[0] && cats[0].id;
        var list = prods.filter(function (p) { return p.category_id === curCat; });
        app.innerHTML = '<div class="flex flex-col lg:flex-row gap-space-lg"><aside class="lg:w-64 shrink-0"><div class="flex items-center justify-between mb-3"><h2 class="font-label-md text-label-md uppercase text-on-surface-variant">Categories</h2><button id="addcat" class="w-9 h-9 rounded-full bg-primary text-surface-container-lowest text-xl font-bold" title="Add category" aria-label="Add category">+</button></div><div class="flex lg:flex-col gap-2 overflow-auto">' + cats.map(function (c) { return '<div class="flex items-center gap-1"><button type="button" data-cat="' + c.id + '" class="flex-1 text-left px-4 py-3 rounded-DEFAULT ' + (c.id === curCat ? 'bg-primary text-surface-container-lowest font-bold' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high') + '">' + esc(c.name) + (c.active ? '' : ' (hidden)') + '</button><button data-ec="' + c.id + '" class="text-on-surface-variant px-1" title="Edit category" aria-label="Edit category">&#9998;</button></div>'; }).join('') + '</div></aside>' +
          '<section class="flex-1"><h2 class="font-headline-md text-headline-md text-primary mb-space-md">' + esc((cats.filter(function (c) { return c.id === curCat; })[0] || {}).name || 'Add a category to begin') + '</h2><div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-gutter">' +
          (curCat ? '<button id="addprod" class="aspect-square rounded-DEFAULT border-2 border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary grid place-items-center"><span class="text-center"><span class="block text-5xl">+</span><span class="font-label-md text-label-md uppercase">Add product</span></span></button>' : '') +
          list.map(function (p) { var im = JSON.parse(p.images || '[]')[0]; return '<button type="button" data-p="' + p.id + '" class="text-left rounded-DEFAULT overflow-hidden bg-surface-container-low hover:bg-surface-container-high ' + (p.active ? '' : 'opacity-50') + '"><div class="aspect-square bg-surface-container">' + (im ? '<img src="' + esc(im) + '" class="w-full h-full object-cover" alt="">' : '') + '</div><div class="p-3"><div class="text-primary font-headline-sm text-label-lg">' + esc(p.name) + '</div><div class="text-on-surface-variant text-body-sm">' + (p.customizable ? '3D customizable' : 'Standard') + (p.moq ? ' · MOQ ' + esc(p.moq) : '') + '</div></div></button>'; }).join('') + '</div></section></div>';
        $('#addcat').onclick = function () { catForm(); };
        $$('[data-cat]', app).forEach(function (b) { b.onclick = function () { curCat = +b.getAttribute('data-cat'); go('products'); }; });
        $$('[data-ec]', app).forEach(function (b) { b.onclick = function () { catForm(cats.filter(function (c) { return c.id === +b.getAttribute('data-ec'); })[0]); }; });
        if ($('#addprod')) $('#addprod').onclick = function () { prodForm(); };
        $$('[data-p]', app).forEach(function (b) { b.onclick = function () { prodForm(prods.filter(function (p) { return p.id === +b.getAttribute('data-p'); })[0]); }; });
      });
    },
    inquiries: function () { return table('inquiries', 'Inquiries', function (r) { return '<b class="text-primary">' + esc(r.ref) + '</b> · ' + esc(r.name) + (r.company ? ' (' + esc(r.company) + ')' : '') + '<br><span class="text-on-surface-variant">' + esc(r.product || '') + (r.quantity ? ' · ' + esc(r.quantity) : '') + '</span>'; }, true); },
    contacts: function () { return table('contacts', 'Messages', function (r) { return '<b class="text-primary">' + esc(r.name) + '</b><br><span class="text-on-surface-variant">' + esc(r.message) + '</span>'; }, true); },
    applications: function () { return table('applications', 'CVs & applications', function (r) { return '<b class="text-primary">' + esc(r.name) + '</b> · ' + esc(r.position || 'General') + '<br><a class="underline" href="/api/admin/applications/' + r.id + '/cv">Download CV (' + esc(r.cv_name) + ')</a>'; }, true); },
    subscribers: function () {
      return api('/api/admin/subscribers').then(function (rows) {
        app.innerHTML = '<div class="flex justify-between items-center mb-space-md"><h1 class="font-headline-lg text-headline-lg text-primary">Subscribers (' + rows.length + ')</h1><button id="csv" class="' + BS + '">Export CSV</button></div><div class="space-y-1">' + rows.map(function (r) { return '<div class="flex justify-between p-3 rounded-DEFAULT bg-surface-container-low"><span>' + esc(r.email) + '</span><span class="text-on-surface-variant">' + fmt(r.created_at) + ' <button data-d="' + r.id + '" class="ml-3 text-error">Delete</button></span></div>'; }).join('') + '</div>';
        $('#csv').onclick = function () { var a = document.createElement('a'); a.download = 'subscribers.csv'; a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('email,date\n' + rows.map(function (r) { return r.email + ',' + r.created_at; }).join('\n')); a.click(); };
        $$('[data-d]', app).forEach(function (b) { b.onclick = function () { if (confirmDel('this subscriber')) api('/api/admin/subscribers/' + b.getAttribute('data-d'), 'DELETE').then(function () { go('subscribers'); }); }; });
      });
    },
    posts: function () {
      return api('/api/admin/posts').then(function (rows) {
        app.innerHTML = '<div class="flex justify-between items-center mb-space-md"><h1 class="font-headline-lg text-headline-lg text-primary">Blog</h1><button id="np" class="' + BP + '">+ New article</button></div><div class="space-y-2">' + rows.map(function (p) { return '<button type="button" data-e="' + p.id + '" class="w-full text-left p-4 rounded-DEFAULT bg-surface-container-low hover:bg-surface-container-high flex justify-between"><span class="text-primary">' + esc(p.title) + '</span><span class="text-on-surface-variant">' + (p.published ? 'Published' : 'Draft') + ' · ' + fmt(p.created_at) + '</span></button>'; }).join('') + '</div>';
        $('#np').onclick = function () { postForm(); }; $$('[data-e]', app).forEach(function (b) { b.onclick = function () { postForm(rows.filter(function (p) { return p.id === +b.getAttribute('data-e'); })[0]); }; });
      });
    },
    gallery: function () {
      return api('/api/admin/gallery').then(function (rows) {
        app.innerHTML = '<div class="flex justify-between items-center mb-space-md"><h1 class="font-headline-lg text-headline-lg text-primary">Gallery</h1><label class="' + BP + ' cursor-pointer">+ Add photos<input id="gf" type="file" accept="image/*" multiple class="hidden"></label></div><div class="grid grid-cols-2 md:grid-cols-4 gap-gutter">' + rows.map(function (g) { return '<div class="rounded-DEFAULT overflow-hidden bg-surface-container-low"><img src="' + esc(g.url) + '" class="w-full aspect-square object-cover" alt=""><div class="p-2 flex gap-2"><input data-cap="' + g.id + '" value="' + esc(g.caption) + '" placeholder="Caption" class="' + INP + '"><button data-d="' + g.id + '" class="text-error px-2" aria-label="Delete">&times;</button></div></div>'; }).join('') + '</div>';
        $('#gf').onchange = function (e) { var fs = [].slice.call(e.target.files); toast('Uploading…'); fs.reduce(function (p, f) { return p.then(function () { return upload(f).then(function (u) { return api('/api/admin/gallery', 'POST', { url: u, caption: '', sort: 999 }); }); }); }, Promise.resolve()).then(function () { go('gallery'); }).catch(function (er) { toast(er.message); }); };
        $$('[data-cap]', app).forEach(function (i) { i.onchange = function () { api('/api/admin/gallery/' + i.getAttribute('data-cap'), 'PUT', { caption: i.value }).then(function () { toast('Saved'); }); }; });
        $$('[data-d]', app).forEach(function (b) { b.onclick = function () { if (confirmDel('this photo')) api('/api/admin/gallery/' + b.getAttribute('data-d'), 'DELETE').then(function () { go('gallery'); }); }; });
      });
    }
  };

  function table(name, title, cell, status) {
    return api('/api/admin/' + name).then(function (rows) {
      var ST = ['new', 'contacted', 'quoted', 'won', 'closed'];
      app.innerHTML = '<h1 class="font-headline-lg text-headline-lg text-primary mb-space-md">' + title + ' (' + rows.length + ')</h1>' + (rows.length ? '' : '<p class="text-on-surface-variant">Nothing here yet.</p>') + '<div class="space-y-2">' + rows.map(function (r) {
        return '<details class="rounded-DEFAULT bg-surface-container-low p-4"><summary class="cursor-pointer flex flex-wrap justify-between gap-2"><span>' + cell(r) + '</span><span class="text-on-surface-variant text-body-sm">' + fmt(r.created_at) + ' · ' + esc(r.status) + '</span></summary><div class="mt-3 space-y-2 text-body-sm text-on-surface-variant">' +
          '<p>Email: <a class="underline text-primary" href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a> · Phone: ' + (r.phone ? '<a class="underline text-primary" href="https://wa.me/' + esc(String(r.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(r.phone) + '</a>' : '-') + '</p>' + (r.message ? '<p class="whitespace-pre-wrap">' + esc(r.message) + '</p>' : '') +
          (r.fields && r.fields !== '{}' ? '<pre class="whitespace-pre-wrap bg-surface-container p-3 rounded-lg">' + esc(Object.entries(JSON.parse(r.fields)).filter(function (e) { return e[1]; }).map(function (e) { return e[0] + ': ' + e[1]; }).join('\n')) + '</pre>' : '') +
          (r.config ? '<p>3D design: <a class="underline text-primary" target="_blank" href="/media/' + r.image_id + '">open preview image</a></p><pre class="whitespace-pre-wrap bg-surface-container p-3 rounded-lg">' + esc(r.config) + '</pre>' : '') +
          '<div class="flex gap-2 items-center"><select data-st="' + r.id + '" class="' + INP + ' !w-auto">' + ST.map(function (s) { return '<option ' + (s === r.status ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select><button data-d="' + r.id + '" class="' + BD + '">Delete</button></div></div></details>';
      }).join('') + '</div>';
      $$('[data-st]', app).forEach(function (s) { s.onchange = function () { api('/api/admin/' + name + '/' + s.getAttribute('data-st'), 'PATCH', { status: s.value }).then(function () { toast('Status updated'); }); }; });
      $$('[data-d]', app).forEach(function (b) { b.onclick = function () { if (confirmDel('this entry')) api('/api/admin/' + name + '/' + b.getAttribute('data-d'), 'DELETE').then(function () { go(name); }); }; });
    });
  }
  function catForm(c) {
    c = c || {}; modal(c.id ? 'Edit category' : 'New category', field('Name', '<input name="name" required class="' + INP + '" value="' + esc(c.name) + '" placeholder="e.g. Gloves">') + field('Short description (optional)', '<input name="description" class="' + INP + '" value="' + esc(c.description) + '">') + '<label class="flex gap-2 items-center"><input type="checkbox" name="active" ' + (c.active !== false ? 'checked' : '') + '> Visible on website</label>' + (c.id ? '<button type="button" id="delcat" class="' + BD + '">Delete category and its products</button>' : ''), function (f) {
        var b = { name: f.name.value, description: f.description.value, active: f.active.checked }; return (c.id ? api('/api/admin/categories/' + c.id, 'PUT', b) : api('/api/admin/categories', 'POST', Object.assign(b, { sort: cats.length }))).then(function (r) { curCat = c.id || r.id; go('products'); });
      }); var d = $('#delcat'); if (d) d.onclick = function () { if (confirmDel('this category and ALL products inside it')) api('/api/admin/categories/' + c.id, 'DELETE').then(function () { document.querySelector('.fixed.z-\\[9700\\]').remove(); curCat = null; go('products'); }); };
  }
  function prodForm(p) {
    p = p || {}; var imgs = JSON.parse(p.images || '[]');
    var m = modal(p.id ? 'Edit product' : 'New product', field('Product name', '<input name="name" required class="' + INP + '" value="' + esc(p.name) + '">') + field('Category', '<select name="category_id" class="' + INP + '">' + cats.map(function (c) { return '<option value="' + c.id + '"' + ((p.category_id || curCat) === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>') +
      '<div><span class="font-label-sm text-label-sm uppercase text-on-surface-variant">Photos (first one is the cover)</span><div id="pp" class="flex flex-wrap gap-2 mt-1"></div></div>' +
      field('One-line summary', '<input name="summary" class="' + INP + '" value="' + esc(p.summary) + '">') + field('Details (blank line = new paragraph)', '<textarea name="details" rows="4" class="' + INP + '">' + esc(p.details) + '</textarea>') + field('Specifications (one per line, like  Fabric: 1000D Cordura)', '<textarea name="specs" rows="4" class="' + INP + '">' + esc(p.specs) + '</textarea>') +
      '<div class="grid grid-cols-2 gap-3">' + field('MOQ', '<input name="moq" class="' + INP + '" value="' + esc(p.moq) + '" placeholder="250 units">') + field('Price note (optional)', '<input name="price_note" class="' + INP + '" value="' + esc(p.price_note) + '" placeholder="FOB from $12/unit"></div>') + '</div>' +
      '<div class="grid grid-cols-2 gap-3 items-end"><label class="flex gap-2 items-center"><input type="checkbox" name="customizable" ' + (p.customizable ? 'checked' : '') + '> Customers can customize in 3D</label>' + field('3D shape', '<select name="custom_type" class="' + INP + '">' + [['backpack', 'Backpack'], ['duffel', 'Duffel'], ['tote', 'Tote'], ['pouch', 'Pouch / organizer'], ['drawstring', 'Drawstring'], ['photo', 'Other (uses the product photo)']].map(function (t) { return '<option value="' + t[0] + '"' + (p.custom_type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>') + '</div>' +
      '<label class="flex gap-2 items-center"><input type="checkbox" name="active" ' + (p.active !== false ? 'checked' : '') + '> Visible on website</label>' + (p.id ? '<button type="button" id="delp" class="' + BD + '">Delete product</button>' : ''), function (f) {
        var b = { name: f.name.value, category_id: +f.category_id.value, summary: f.summary.value, details: f.details.value, specs: f.specs.value, moq: f.moq.value, price_note: f.price_note.value, images: imgs, customizable: f.customizable.checked, custom_type: f.custom_type.value, active: f.active.checked };
        return (p.id ? api('/api/admin/products/' + p.id, 'PUT', b) : api('/api/admin/products', 'POST', b)).then(function () { curCat = b.category_id; go('products'); toast('Saved'); });
      }, true);
    picker($('#pp', m), imgs, true); var d = $('#delp', m); if (d) d.onclick = function () { if (confirmDel('this product')) api('/api/admin/products/' + p.id, 'DELETE').then(function () { m.remove(); go('products'); }); };
  }
  function postForm(p) {
    p = p || {}; var cover = p.cover ? [p.cover] : [];
    var m = modal(p.id ? 'Edit article' : 'New article', field('Title', '<input name="title" required class="' + INP + '" value="' + esc(p.title) + '">') + field('Short summary (shown in the list & Google)', '<textarea name="excerpt" rows="2" class="' + INP + '">' + esc(p.excerpt) + '</textarea>') + '<div><span class="font-label-sm text-label-sm uppercase text-on-surface-variant">Cover photo</span><div id="pc" class="flex gap-2 mt-1"></div></div>' + field('Article (blank line = new paragraph, start a line with ## for a heading)', '<textarea name="content" rows="12" class="' + INP + '">' + esc(p.content) + '</textarea>') + '<label class="flex gap-2 items-center"><input type="checkbox" name="published" ' + (p.published !== false ? 'checked' : '') + '> Published</label>' + (p.id ? '<button type="button" id="delpost" class="' + BD + '">Delete article</button>' : ''), function (f) {
      var b = { title: f.title.value, excerpt: f.excerpt.value, content: f.content.value, cover: cover[0] || '', published: f.published.checked }; return (p.id ? api('/api/admin/posts/' + p.id, 'PUT', b) : api('/api/admin/posts', 'POST', b)).then(function () { go('posts'); });
    }, true); picker($('#pc', m), cover, false); var d = $('#delpost', m); if (d) d.onclick = function () { if (confirmDel('this article')) api('/api/admin/posts/' + p.id, 'DELETE').then(function () { m.remove(); go('posts'); }); };
  }
})();
