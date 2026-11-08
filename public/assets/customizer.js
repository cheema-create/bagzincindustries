/* Bagzinic 3D customizer – parametric bags, per-part colours, fabric, size, pockets, logo */
(function () {
  'use strict';
  var T = window.THREE, host = document.getElementById('cz-stage'), panel = document.getElementById('cz-panel');
  if (!T || !host || !panel) return;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TYPES = { backpack: 'Backpack', duffel: 'Duffel', tote: 'Tote', pouch: 'Pouch', drawstring: 'Drawstring', photo: 'Product photo' };
  var PARTS = [['body', 'Main fabric'], ['panel', 'Panels & base'], ['strap', 'Straps & handles'], ['hardware', 'Zippers & buckles'], ['trim', 'Pockets & accents']];
  var SW = ['#1a1a1a', '#4a4a4a', '#9a9a9a', '#eeeeee', '#4b5320', '#1f4d36', '#1f2a44', '#1d4ed8', '#b3202a', '#e8710a', '#b08d57', '#5b2a86', '#d94f8b'];
  var FAB = { cordura: ['1000D Cordura', .85], canvas: ['Waxed canvas', .9], ripstop: ['Ripstop nylon', .6], leather: ['Leather look', .45], smooth: ['Smooth nylon', .25] };
  var PRESETS = { 'Tactical black': { body: '#1a1a1a', panel: '#4a4a4a', strap: '#1a1a1a', hardware: '#4a4a4a', trim: '#1a1a1a' }, 'Desert ops': { body: '#b08d57', panel: '#4b5320', strap: '#4b5320', hardware: '#1a1a1a', trim: '#b08d57' }, 'Navy sport': { body: '#1f2a44', panel: '#eeeeee', strap: '#1f2a44', hardware: '#eeeeee', trim: '#b3202a' }, 'Urban orange': { body: '#e8710a', panel: '#1a1a1a', strap: '#1a1a1a', hardware: '#eeeeee', trim: '#1a1a1a' } };
  var DEF = function () { return { type: 'backpack', sw: 1, sh: 1, sd: 1, colors: { body: '#1a1a1a', panel: '#4a4a4a', strap: '#1a1a1a', hardware: '#9a9a9a', trim: '#1a1a1a' }, fabric: 'cordura', pockets: 1, logoText: 'BRAND', logoColor: '#ffffff', logoImg: null, logoSize: 1, logoPos: 0 }; };
  var S = DEF(), product = null, photoURL = null;

  /* ---------- three setup ---------- */
  var renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
  var scene = new T.Scene(), cam = new T.PerspectiveCamera(38, 1, .1, 50); cam.position.set(0, .25, 5.2);
  scene.add(new T.AmbientLight(0xffffff, .6)); scene.add(new T.HemisphereLight(0xffffff, 0x555555, .55));
  var key = new T.DirectionalLight(0xffffff, .95); key.position.set(3, 5, 4); scene.add(key);
  var rim = new T.DirectionalLight(0xffffff, .45); rim.position.set(-4, 2, -3); scene.add(rim);
  var pivot = new T.Group(); scene.add(pivot); var model = new T.Group(); pivot.add(model);
  var shadow = new T.Mesh(new T.PlaneGeometry(3.4, 3.4), new T.MeshBasicMaterial({ map: radial(), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  function radial() { var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); }
  function size() { var w = host.clientWidth || 600, h = host.clientHeight || 500; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size); if (window.ResizeObserver) new ResizeObserver(size).observe(host);

  /* ---------- materials & textures ---------- */
  function fabricTex(kind) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d'), i;
    x.fillStyle = kind === 'smooth' ? '#fafafa' : '#ececec'; x.fillRect(0, 0, 128, 128);
    if (kind === 'cordura') for (i = 0; i < 900; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * .12 + ')'; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
    if (kind === 'canvas') for (i = 0; i < 128; i += 3) { x.fillStyle = 'rgba(0,0,0,.09)'; x.fillRect(i, 0, 1, 128); x.fillRect(0, i, 128, 1); }
    if (kind === 'ripstop') { for (i = 0; i < 128; i += 2) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(i, 0, 1, 128); x.fillRect(0, i, 128, 1); } for (i = 0; i < 128; i += 16) { x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(i, 0, 1, 128); x.fillRect(0, i, 128, 1); } }
    if (kind === 'leather') for (i = 0; i < 700; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * .1 + ')'; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 0, 6.3); x.fill(); }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(5, 5); t.anisotropy = 4; return t;
  }
  var texCache = {}; Object.keys(FAB).forEach(function (k) { texCache[k] = fabricTex(k); });
  var M = {
    body: new T.MeshStandardMaterial({ roughness: .85 }), panel: new T.MeshStandardMaterial({ roughness: .85 }), strap: new T.MeshStandardMaterial({ roughness: .8 }),
    hardware: new T.MeshStandardMaterial({ roughness: .35, metalness: .6 }), trim: new T.MeshStandardMaterial({ roughness: .8 })
  };
  function applyMats() {
    PARTS.forEach(function (p) { M[p[0]].color.set(S.colors[p[0]]); });
    ['body', 'panel', 'trim'].forEach(function (k) { M[k].map = texCache[S.fabric]; M[k].roughness = FAB[S.fabric][1]; M[k].needsUpdate = true; });
    M.strap.map = texCache.canvas; M.strap.needsUpdate = true;
  }

  /* ---------- geometry helpers ---------- */
  function rbox(w, h, d, r) {
    r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001); var g = new T.BoxGeometry(w, h, d, 10, 10, 10), p = g.attributes.position, v = new T.Vector3(), c = new T.Vector3();
    var hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd)); v.sub(c); if (v.lengthSq() > 0) v.normalize().multiplyScalar(r); v.add(c); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  }
  function mesh(g, m, x, y, z) { var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); model.add(o); return o; }
  function arch(r, tube, x, y, z, ry, m) { var o = mesh(new T.TorusGeometry(r, tube, 10, 36, Math.PI), m, x, y, z); o.rotation.y = ry || 0; return o; }
  function logoTex(portrait) {
    var c = document.createElement('canvas'); c.width = portrait ? 512 : 1024; c.height = portrait ? 1024 : 512; var x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    if (portrait) { x.translate(256, 512); x.rotate(Math.PI / 2); } else x.translate(512, 256);
    if (S.logoImg && S.logoImg.complete && S.logoImg.naturalWidth) { var r = Math.min(1000 / S.logoImg.naturalWidth, 480 / S.logoImg.naturalHeight); x.drawImage(S.logoImg, -S.logoImg.naturalWidth * r / 2, -S.logoImg.naturalHeight * r / 2, S.logoImg.naturalWidth * r, S.logoImg.naturalHeight * r); }
    else if (S.logoText) { x.fillStyle = S.logoColor; x.textAlign = 'center'; x.textBaseline = 'middle'; var fs = 200; x.font = '800 ' + fs + 'px "Space Grotesk",Arial,sans-serif'; while (x.measureText(S.logoText).width > 960 && fs > 40) { fs -= 8; x.font = '800 ' + fs + 'px "Space Grotesk",Arial,sans-serif'; } x.fillText(S.logoText, 0, 14); }
    var t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function logoMat(portrait) { return new T.MeshBasicMaterial({ map: logoTex(portrait), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
  function flatLogo(x, y, z, w) { var s = S.logoSize; return mesh(new T.PlaneGeometry(w * s, w * s / 2), logoMat(), x, y, z); }
  function cylLogo(r, len, rotZ, sd, off, th0) {
    var g = new T.CylinderGeometry(r + .006, r + .006, len * S.logoSize, 40, 1, true, -.6 * S.logoSize + (th0 || 0), 1.2 * S.logoSize), o = mesh(g, logoMat(!!rotZ));
    o.scale.set(1, 1, sd); if (rotZ) { o.rotation.z = Math.PI / 2; o.position.x = off; } else o.position.y = off; return o;
  }

  /* ---------- bag builders ---------- */
  var BUILD = {
    backpack: function () {
      var W = S.sw, H = 1.5 * S.sh, D = .5 * S.sd, i;
      mesh(rbox(W, H, D, .17), M.body); mesh(rbox(W * .98, .24, D * .99, .1), M.panel, 0, -H / 2 + .11, 0);
      for (i = 0; i < S.pockets; i++) { var py = -H / 2 + .5 + i * .4; mesh(rbox(W * .82, .34, .13, .07), M.trim, 0, py, D / 2 + .04); mesh(rbox(W * .8, .026, .02, .01), M.hardware, 0, py + .15, D / 2 + .11); mesh(rbox(.05, .07, .03, .01), M.hardware, W * .3, py + .12, D / 2 + .12); }
      [-1, 1].forEach(function (s) { mesh(rbox(.14, H * .82, .05, .02), M.strap, s * W * .26, -H * .02, -D / 2 - .03); mesh(rbox(.2, .5, .2, .06), M.trim, s * (W / 2 + .05), -H * .22, 0); });
      mesh(rbox(W * .94, .06, .03, .015), M.strap, 0, H * .18, D / 2 + .01); mesh(rbox(.1, .08, .04, .02), M.hardware, 0, H * .18, D / 2 + .03);
      arch(.13, .02, 0, H / 2 - .01, 0, Math.PI / 2, M.strap); mesh(rbox(W * .6, .03, .02, .01), M.hardware, 0, H / 2 - .2, D / 2 + .005);
      flatLogo(0, H * .3 + S.logoPos * H * .18, D / 2 + .012, W * .55);
    },
    duffel: function () {
      var L = 1.8 * S.sw, R = .42 * S.sh, sd = S.sd * .95;
      var b = mesh(new T.CylinderGeometry(R, R, L, 44), M.body); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, sd);
      [-1, 1].forEach(function (s) { var c = mesh(new T.CylinderGeometry(R * 1.012, R * 1.012, .34, 44), M.panel, s * (L / 2 - .17)); c.rotation.z = Math.PI / 2; c.scale.set(1, 1, sd); arch(.26 * sd, .028, s * L * .17, R * .96, 0, Math.PI / 2, M.strap); });
      mesh(rbox(L * .88, .03, .06, .012), M.hardware, 0, R + .002, 0);
      if (S.pockets) { mesh(rbox(L * .46, R * .6, .06, .05), M.trim, 0, -R * .42, R * sd * .92 + .02); mesh(rbox(L * .4, .024, .02, .01), M.hardware, 0, -R * .11, R * sd * .93 + .05); }
      cylLogo(R * 1.012, 1.0, true, sd, S.logoPos * L * .3, S.pockets ? .5 : 0);
    },
    tote: function () {
      var W = 1.2 * S.sw, H = S.sh, D = .38 * S.sd;
      mesh(rbox(W, H, D, .05), M.body); mesh(rbox(W * 1.01, .14, D * 1.02, .05), M.panel, 0, -H / 2 + .07, 0);
      [-1, 1].forEach(function (s) { arch(.3 * S.sw, .03, 0, H / 2 - .02, s * D * .46, 0, M.strap); });
      if (S.pockets) { mesh(rbox(W * .46, .32, .05, .04), M.trim, 0, -H * .18, D / 2 + .02); mesh(rbox(W * .44, .022, .02, .01), M.hardware, 0, -H * .18 + .14, D / 2 + .05); }
      mesh(rbox(W * .98, .035, .02, .01), M.hardware, 0, H / 2 - .07, D / 2 + .005);
      flatLogo(0, H * .18 + S.logoPos * H * .2, D / 2 + .012, W * .5);
    },
    pouch: function () {
      var W = 1.1 * S.sw, H = .7 * S.sh, D = .34 * S.sd;
      mesh(rbox(W, H, D, .13), M.body); [-1, 1].forEach(function (s) { mesh(rbox(.08, H * .99, D * 1.01, .03), M.panel, s * (W / 2 - .02), 0, 0); });
      mesh(rbox(W * .88, .03, .03, .012), M.hardware, 0, H / 2 - .05, D / 2 - .01); mesh(rbox(.07, .09, .03, .015), M.hardware, W * .38, H / 2 - .09, D / 2 + .02);
      var w = arch(.13, .016, W / 2 + .02, H / 2 - .02, 0, 0, M.strap); w.rotation.z = -.4;
      flatLogo(0, -H * .06 + S.logoPos * H * .2, D / 2 + .012, W * .5);
    },
    drawstring: function () {
      var R = .46 * S.sw, H = 1.3 * S.sh, sd = S.sd, b = mesh(new T.CylinderGeometry(R, R, H, 44), M.body); b.scale.set(1, 1, sd);
      var bt = mesh(new T.CylinderGeometry(R * 1.012, R * 1.012, .18, 44), M.panel, 0, -H / 2 + .09); bt.scale.set(1, 1, sd);
      var c = mesh(new T.TorusGeometry(R * 1.01, .022, 10, 44), M.hardware, 0, H / 2 - .12); c.rotation.x = Math.PI / 2; c.scale.set(1, sd, 1);
      [-1, 1].forEach(function (s) { var st = mesh(new T.CylinderGeometry(.03, .03, H * .95, 10), M.strap, s * R * .98, 0, -R * sd * .35); st.scale.z = 1; mesh(new T.SphereGeometry(.05, 12, 10), M.hardware, s * R * .98, H / 2 - .1, R * sd * .15); });
      cylLogo(R, .27, false, sd, -H * .05 + S.logoPos * H * .25);
    },
    photo: function () {
      var h = 1.6 * S.sh, w = h * 1.0 * S.sw, mat = new T.MeshBasicMaterial({ color: new T.Color(S.colors.body).lerp(new T.Color(0xffffff), .55), transparent: true });
      if (photoURL) new T.TextureLoader().setCrossOrigin('anonymous').load(photoURL, function (t) { mat.map = t; mat.needsUpdate = true; var a = t.image.width / t.image.height; model.children[0].scale.x = a; flatLogo2(); }, undefined, function () { });
      mesh(new T.PlaneGeometry(w, h), mat); function flatLogo2() { }
      flatLogo(0, -h * .3 + S.logoPos * h * .2, .02, w * .4);
    }
  };

  var cachedDims = null;
  function rebuild() {
    applyMats();
    while (model.children.length) { var o = model.children.pop(); model.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.transparent) { o.material.map.dispose(); o.material.dispose(); } }
    model.position.set(0, 0, 0); model.scale.set(1, 1, 1); (BUILD[S.type] || BUILD.backpack)();
    var box = new T.Box3().setFromObject(model), sz = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3()), k = 2.3 / Math.max(sz.x, sz.y, sz.z * 1.3);
    model.scale.setScalar(k); model.position.set(-ctr.x * k, -ctr.y * k, -ctr.z * k); shadow.position.y = -sz.y * k / 2 - .03;
    dims = [Math.round(sz.x * 40), Math.round(sz.y * 40), Math.round(sz.z * 40)]; var dEl = document.getElementById('cz-dims'); if (dEl && S.type !== 'photo') dEl.textContent = 'Approx. size ' + dims[0] + ' × ' + dims[1] + ' × ' + dims[2] + ' cm (indicative)';
  }
  var dims = [0, 0, 0];

  /* ---------- interaction ---------- */
  var drag = null, vel = 0, auto = true, idle = 0;
  var cv = renderer.domElement;
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; auto = false; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; pivot.rotation.y += dx * .01; vel = dx * .01; pivot.rotation.x = clamp(pivot.rotation.x + dy * .006, -.5, .5); });
  var up = function () { drag = null; cv.style.cursor = 'grab'; idle = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.shiftKey) return; e.preventDefault(); cam.position.z = clamp(cam.position.z + e.deltaY * .004, 3, 8); }, { passive: false });
  var onScreen = true; if (window.IntersectionObserver) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; }).observe(host);
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function loop() { requestAnimationFrame(loop); if (!onScreen || document.hidden) return; if (!drag) { pivot.rotation.y += vel; vel *= .94; idle++; if (idle > 120 && !reduce) auto = true; if (auto && !reduce) pivot.rotation.y += .004; } renderer.render(scene, cam); })();

  /* ---------- control panel ---------- */
  var cls = { lab: 'font-label-md text-label-md uppercase tracking-wider text-on-surface-variant mb-2 block', chip: 'px-3 py-2 rounded-full font-label-sm text-label-sm uppercase transition-all ', box: 'rounded-DEFAULT bg-surface-container-low p-space-md', inp: 'w-full bg-surface-container rounded-DEFAULT px-3 py-2.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary' };
  var on = ' bg-primary text-surface-container-lowest font-bold', off = ' bg-surface-container text-on-surface-variant hover:bg-surface-container-high';
  function chips(items, cur, attr) { return '<div class="flex flex-wrap gap-2">' + items.map(function (i) { return '<button type="button" ' + attr + '="' + i[0] + '" class="' + cls.chip + (cur === i[0] ? on : off) + '">' + esc(i[1]) + '</button>'; }).join('') + '</div>'; }
  function slider(id, label, min, max, v, step) { return '<label class="block"><span class="flex justify-between font-body-sm text-on-surface-variant"><span>' + label + '</span><output id="o-' + id + '">' + v + '</output></span><input data-s="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + (step || .01) + '" value="' + v + '" class="w-full accent-primary"></label>'; }
  function draw() {
    var photo = S.type === 'photo', h = '';
    h += '<div class="' + cls.box + '"><span class="' + cls.lab + '">1. Bag type</span>' + chips(Object.keys(TYPES).filter(function (k) { return k !== 'photo' || photoURL; }).map(function (k) { return [k, TYPES[k]]; }), S.type, 'data-type') + '</div>';
    h += '<div class="' + cls.box + ' space-y-3"><span class="' + cls.lab + '">2. Shape & size</span>' + slider('sw', 'Width', .7, 1.4, S.sw) + slider('sh', 'Height', .7, 1.4, S.sh) + (photo ? '' : slider('sd', 'Depth', .7, 1.5, S.sd)) + '<p id="cz-dims" class="font-body-sm text-on-surface-variant"></p></div>';
    h += '<div class="' + cls.box + '"><span class="' + cls.lab + '">3. Colours (each part)</span>' + PARTS.filter(function (p) { return !photo || p[0] === 'body'; }).map(function (p) {
      return '<div class="mb-3"><div class="flex items-center justify-between mb-1"><span class="font-body-sm text-on-surface">' + p[1] + '</span><input type="color" data-pick="' + p[0] + '" value="' + S.colors[p[0]] + '" class="w-8 h-8 rounded-full bg-transparent border-0 cursor-pointer" aria-label="Custom colour for ' + p[1] + '"></div><div class="flex flex-wrap gap-1.5">' + SW.map(function (c) { return '<button type="button" data-part="' + p[0] + '" data-c="' + c + '" aria-label="' + c + '" class="w-6 h-6 rounded-full" style="background:' + c + ';box-shadow:inset 0 1px 1px rgba(255,255,255,.4),0 0 0 ' + (S.colors[p[0]].toLowerCase() === c ? '2px var(--bz-ring,#fff)' : '1px rgba(128,128,128,.5)') + '"></button>'; }).join('') + '</div></div>';
    }).join('') + '<div class="flex flex-wrap gap-2 mt-2"><span class="font-body-sm text-on-surface-variant w-full">Quick looks</span>' + Object.keys(PRESETS).map(function (k) { return '<button type="button" data-preset="' + k + '" class="' + cls.chip + off + '">' + k + '</button>'; }).join('') + '</div></div>';
    if (!photo) h += '<div class="' + cls.box + ' space-y-3"><div><span class="' + cls.lab + '">4. Fabric</span>' + chips(Object.keys(FAB).map(function (k) { return [k, FAB[k][0]]; }), S.fabric, 'data-fab') + '</div>' + (S.type === 'backpack' ? '<div><span class="' + cls.lab + '">Front pockets</span>' + chips([[0, 'None'], [1, '1'], [2, '2'], [3, '3']].map(function (a) { return [String(a[0]), a[1]]; }), String(S.pockets), 'data-pk') + '</div>' : (S.type === 'tote' || S.type === 'duffel') ? '<div><span class="' + cls.lab + '">Outside pocket</span>' + chips([['0', 'No'], ['1', 'Yes']], String(S.pockets ? 1 : 0), 'data-pk') + '</div>' : '') + '</div>';
    h += '<div class="' + cls.box + ' space-y-3"><span class="' + cls.lab + '">' + (photo ? '4' : '5') + '. Your logo</span><input id="cz-logotxt" class="' + cls.inp + '" maxlength="24" placeholder="Brand text" value="' + esc(S.logoText) + '"><div class="flex items-center gap-3"><label class="font-body-sm text-on-surface-variant">Text colour <input type="color" id="cz-logoclr" value="' + S.logoColor + '" class="align-middle w-8 h-8 bg-transparent border-0"></label><label class="' + cls.chip + off + ' cursor-pointer">Upload logo<input id="cz-logofile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden"></label>' + (S.logoImg ? '<button type="button" id="cz-logoclear" class="' + cls.chip + off + '">Remove</button>' : '') + '</div>' + slider('logoSize', 'Logo size', .5, 1.5, S.logoSize) + slider('logoPos', 'Logo position', -1, 1, S.logoPos) + '</div>';
    panel.innerHTML = h; rebuild();
  }
  function setVal(id, v) { S[id] = +v; var o = document.getElementById('o-' + id); if (o) o.textContent = (+v).toFixed(2); rebuild(); }
  panel.addEventListener('input', function (e) {
    var t = e.target; if (t.dataset.s) setVal(t.dataset.s, t.value);
    else if (t.dataset.pick) { S.colors[t.dataset.pick] = t.value; applyMats(); }
    else if (t.id === 'cz-logotxt') { S.logoText = t.value; S.logoImg = null; rebuild(); }
    else if (t.id === 'cz-logoclr') { S.logoColor = t.value; rebuild(); }
  });
  panel.addEventListener('change', function (e) { var t = e.target; if (t.dataset.pick) draw(); if (t.id === 'cz-logofile' && t.files[0]) { var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { S.logoImg = im; draw(); }; im.src = r.result; }; r.readAsDataURL(t.files[0]); } });
  panel.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return; var d = t.dataset;
    if (d.type) { S.type = d.type; if (d.type !== 'backpack' && S.pockets > 1) S.pockets = 1; draw(); }
    else if (d.part) { S.colors[d.part] = d.c; draw(); }
    else if (d.preset) { Object.assign(S.colors, PRESETS[d.preset]); draw(); }
    else if (d.fab) { S.fabric = d.fab; draw(); }
    else if (d.pk !== undefined) { S.pockets = +d.pk; draw(); }
    else if (t.id === 'cz-logoclear') { S.logoImg = null; draw(); }
  });

  /* ---------- actions ---------- */
  function snapshot(type) { auto = false; renderer.render(scene, cam); return cv.toDataURL(type || 'image/webp', .85); }
  function summary() { return TYPES[S.type] + (product ? ' (' + product.name + ')' : '') + ' | ' + (S.type === 'photo' ? '' : FAB[S.fabric][0] + ' | ') + PARTS.map(function (p) { return p[1] + ' ' + S.colors[p[0]]; }).join(', ') + (S.logoText && !S.logoImg ? ' | Logo: ' + S.logoText : S.logoImg ? ' | Custom logo image' : '') + ' | ~' + dims.join('x') + ' cm'; }
  var $ = function (id) { return document.getElementById(id); };
  $('cz-reset').onclick = function () { var t = S.type; S = DEF(); S.type = t; draw(); };
  $('cz-random').onclick = function () { var r = function () { return SW[Math.floor(Math.random() * SW.length)]; }; PARTS.forEach(function (p) { S.colors[p[0]] = r(); }); draw(); };
  $('cz-dl').onclick = function () { var a = document.createElement('a'); a.download = 'bagzinic-custom-design.png'; a.href = snapshot('image/png'); a.click(); };
  $('cz-wa').onclick = function () { window.open('https://wa.me/923707730559?text=' + encodeURIComponent('Hello Bagzinic Industries! I designed a custom bag in your 3D studio: ' + summary() + '. Please send a quotation.'), '_blank', 'noopener'); };
  var f = $('cz-form'), st = $('cz-status');
  f.addEventListener('submit', function (e) {
    e.preventDefault(); var b = f.querySelector('button[type=submit]'); b.disabled = true; st.textContent = 'Sending your design…';
    var fd = new FormData(f), body = { name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), company: fd.get('company'), quantity: fd.get('quantity'), message: fd.get('message'), product: 'Custom 3D design: ' + summary(), config: { state: Object.assign({}, S, { logoImg: !!S.logoImg }), product: product && product.slug, dims: dims }, image: snapshot() };
    fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
      .then(function (j) { st.textContent = 'Sent! Your reference is ' + j.ref + '. We will reply within one business day.'; st.className = 'text-primary font-body-sm'; f.reset(); })
      .catch(function (er) { st.textContent = (er.message || 'Could not send.') + ' You can also use the WhatsApp button.'; st.className = 'text-error font-body-sm'; }).then(function () { b.disabled = false; });
  });

  /* ---------- start (optionally from a product) ---------- */
  var slug = new URLSearchParams(location.search).get('product');
  function start() { draw(); document.documentElement.classList.add('cz-ready'); }
  if (slug) fetch('/api/products/' + encodeURIComponent(slug)).then(function (r) { return r.json(); }).then(function (p) {
    if (!p || p.error) return; product = p; var t = p.custom_type || 'photo'; if (t === 'photo' && p.images[0]) photoURL = p.images[0]; S.type = TYPES[t] ? t : 'backpack'; var n = $('cz-prod'); if (n) n.textContent = 'Customizing: ' + p.name;
  }).catch(function () { }).then(start); else start();
})();
