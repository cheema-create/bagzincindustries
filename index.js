require('dotenv').config();
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const express = require('express'), compression = require('compression'), cookieParser = require('cookie-parser');
const multer = require('multer'), jwt = require('jsonwebtoken'), rateLimit = require('express-rate-limit');
const { pool, init } = require('./db'); const { notify } = require('./mailer');

const PUB = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 3000;
const SITE = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT).replace(/\/$/, '');
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const PROD = process.env.NODE_ENV === 'production';
const q = (s, p) => pool.query(s, p).then(r => r.rows);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item';
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });

const app = express();
app.set('trust proxy', 1); app.disable('x-powered-by');
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' }); next(); });
app.use(compression()); app.use(express.json({ limit: '8mb' })); app.use(cookieParser());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 4 } });
const formLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please try again later.' } });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many login attempts.' } });
const isEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || '');
const clip = (s, n = 4000) => String(s == null ? '' : s).slice(0, n);

app.get('/healthz', (req, res) => res.send('ok'));

/* ---------- public API ---------- */
app.get('/api/categories', wrap(async (req, res) => res.json(await q('select id,name,slug,description from categories where active order by sort,id'))));
app.get('/api/products', wrap(async (req, res) => {
  const rows = req.query.category
    ? await q('select p.* from products p join categories c on c.id=p.category_id where p.active and c.active and c.slug=$1 order by p.sort,p.id', [req.query.category])
    : await q('select p.* from products p join categories c on c.id=p.category_id where p.active and c.active order by c.sort,p.sort,p.id');
  res.json(rows.map(pubProduct));
}));
app.get('/api/products/:slug', wrap(async (req, res) => {
  const r = await q('select p.*, c.name as category_name, c.slug as category_slug from products p join categories c on c.id=p.category_id where p.slug=$1 and p.active', [req.params.slug]);
  r[0] ? res.json(pubProduct(r[0])) : res.status(404).json({ error: 'Not found' });
}));
function pubProduct(p) { let images = []; try { images = JSON.parse(p.images || '[]'); } catch (e) { } return { ...p, images, specs: (p.specs || '').split('\n').filter(Boolean) }; }
app.get('/api/posts', wrap(async (req, res) => res.json(await q('select id,title,slug,excerpt,cover,created_at from posts where published order by id desc'))));
app.get('/api/posts/:slug', wrap(async (req, res) => { const r = await q('select * from posts where slug=$1 and published', [req.params.slug]); r[0] ? res.json(r[0]) : res.status(404).json({ error: 'Not found' }); }));
app.get('/api/gallery', wrap(async (req, res) => res.json(await q('select id,url,caption from gallery order by sort,id'))));

app.get('/media/:id', wrap(async (req, res) => {
  const r = await q('select mime,data from media where id=$1', [Number(req.params.id) || 0]);
  if (!r[0]) return res.status(404).end();
  res.set({ 'Content-Type': r[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable' }).send(Buffer.from(r[0].data, 'base64'));
}));
async function saveDataUrl(d) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(d || '');
  if (!m || m[2].length > 7e6) return null;
  return (await q('insert into media(mime,data) values($1,$2) returning id', [m[1], m[2]]))[0].id;
}

/* ---------- forms ---------- */
const parseJSON = s => { try { return typeof s === 'string' ? JSON.parse(s) : (s || {}); } catch (e) { return {}; } };
app.post('/api/inquiries', formLimit, upload.array('files', 3), wrap(async (req, res) => {
  const b = req.body || {}, fields = parseJSON(b.fields);
  const name = clip(b.name || fields.name || fields['contact-name'] || fields['contact-company'], 150), email = clip(b.email || fields.email || fields['contact-email'], 150), phone = clip(b.phone || fields.phone || fields['contact-phone'], 60);
  if (!name && !email && !phone) return res.status(400).json({ error: 'Please add your name and an email or phone number.' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Email address looks invalid.' });
  const ref = `BZG-INQ-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;
  const imageId = await saveDataUrl(b.image);
  const config = b.config ? clip(typeof b.config === 'string' ? b.config : JSON.stringify(b.config), 20000) : null;
  await q('insert into inquiries(ref,name,company,email,phone,product,quantity,message,fields,config,image_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [ref, name, clip(b.company || fields['contact-company'], 150), email, phone, clip(b.product, 200), clip(b.quantity, 60), clip(b.message, 4000), clip(JSON.stringify(fields), 20000), config, imageId]);
  const lines = [`Reference: ${ref}`, `Name: ${name}`, `Company: ${b.company || fields['contact-company'] || '-'}`, `Email: ${email || '-'}`, `Phone: ${phone || '-'}`, `Product: ${b.product || '-'}`, `Quantity: ${b.quantity || '-'}`, '', clip(b.message, 4000)];
  Object.entries(fields).forEach(([k, v]) => v && lines.push(`${k}: ${v}`));
  if (config) lines.push('', 'Customizer config: ' + config);
  if (imageId) lines.push('', `Preview image: ${SITE}/media/${imageId}`);
  notify({ subject: `New OEM inquiry ${ref} – ${name || email}`, text: lines.join('\n'), replyTo: email || undefined, attachments: (req.files || []).map(f => ({ filename: f.originalname, content: f.buffer })) });
  res.json({ ok: true, ref });
}));
app.post('/api/contact', formLimit, wrap(async (req, res) => {
  const { name, email, phone, message } = req.body || {};
  if (!name || !message || (!email && !phone)) return res.status(400).json({ error: 'Name, message and an email or phone are required.' });
  if (email && !isEmail(email)) return res.status(400).json({ error: 'Email address looks invalid.' });
  await q('insert into contacts(name,email,phone,message) values($1,$2,$3,$4)', [clip(name, 150), clip(email, 150), clip(phone, 60), clip(message)]);
  notify({ subject: `Website message from ${name}`, text: `Name: ${name}\nEmail: ${email || '-'}\nPhone: ${phone || '-'}\n\n${message}`, replyTo: email || undefined });
  res.json({ ok: true });
}));
app.post('/api/newsletter', formLimit, wrap(async (req, res) => {
  const email = clip(req.body && req.body.email, 150).trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!(await q('select 1 from subscribers where email=$1', [email])).length) { await q('insert into subscribers(email) values($1)', [email]); notify({ subject: 'New newsletter subscriber', text: email }); }
  res.json({ ok: true });
}));
app.post('/api/careers', formLimit, upload.single('cv'), wrap(async (req, res) => {
  const b = req.body || {}, f = req.file;
  if (!b.name || !isEmail(b.email)) return res.status(400).json({ error: 'Name and a valid email are required.' });
  if (!f) return res.status(400).json({ error: 'Please attach your CV (PDF or Word, max 5 MB).' });
  if (!/\.(pdf|docx?|rtf)$/i.test(f.originalname)) return res.status(400).json({ error: 'CV must be a PDF or Word file.' });
  await q('insert into applications(name,email,phone,position,message,cv_name,cv_mime,cv_data) values($1,$2,$3,$4,$5,$6,$7,$8)', [clip(b.name, 150), clip(b.email, 150), clip(b.phone, 60), clip(b.position, 150), clip(b.message), f.originalname, f.mimetype, f.buffer.toString('base64')]);
  notify({ subject: `New CV: ${b.name} – ${b.position || 'General'}`, text: `Name: ${b.name}\nEmail: ${b.email}\nPhone: ${b.phone || '-'}\nPosition: ${b.position || '-'}\n\n${b.message || ''}`, replyTo: b.email, attachments: [{ filename: f.originalname, content: f.buffer }] });
  res.json({ ok: true });
}));

/* ---------- admin ---------- */
const safeEq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const auth = (req, res, next) => { try { jwt.verify(req.cookies.bz_admin, SECRET); next(); } catch (e) { res.status(401).json({ error: 'Please log in.' }); } };
app.post('/api/admin/login', loginLimit, (req, res) => {
  const U = process.env.ADMIN_USER || 'admin', P = process.env.ADMIN_PASS;
  if (!P) return res.status(503).json({ error: 'ADMIN_PASS is not set on the server.' });
  const { user, pass } = req.body || {};
  if (!safeEq(user, U) || !safeEq(pass, P)) return res.status(401).json({ error: 'Wrong username or password.' });
  res.cookie('bz_admin', jwt.sign({ u: U }, SECRET, { expiresIn: '7d' }), { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 7 * 864e5 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('bz_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', auth, (req, res) => res.json({ ok: true }));
app.get('/api/admin/stats', auth, wrap(async (req, res) => {
  const c = async (t, w = '') => Number((await q(`select count(*) c from ${t} ${w}`))[0].c);
  res.json({ categories: await c('categories'), products: await c('products'), inquiries: await c('inquiries'), newInquiries: await c('inquiries', "where status='new'"), contacts: await c('contacts'), applications: await c('applications'), subscribers: await c('subscribers'), posts: await c('posts') });
}));
app.post('/api/admin/media', auth, wrap(async (req, res) => { const id = await saveDataUrl(req.body && req.body.dataUrl); id ? res.json({ id, url: '/media/' + id }) : res.status(400).json({ error: 'Invalid or too large image.' }); }));

const RES = {
  categories: { cols: ['name', 'slug', 'description', 'sort', 'active'], order: 'sort,id', from: 'name' },
  products: { cols: ['category_id', 'name', 'slug', 'summary', 'details', 'moq', 'price_note', 'specs', 'images', 'customizable', 'custom_type', 'active', 'sort'], order: 'sort,id', from: 'name' },
  posts: { cols: ['title', 'slug', 'excerpt', 'content', 'cover', 'published'], order: 'id desc', from: 'title' },
  gallery: { cols: ['url', 'caption', 'sort'], order: 'sort,id' }
};
const BOOL = ['active', 'customizable', 'published'], INT = ['sort', 'category_id'];
const norm = (c, v) => BOOL.includes(c) ? (v === true || v === 'true' || v === 1 || v === '1') : INT.includes(c) ? (parseInt(v, 10) || 0) : c === 'images' ? JSON.stringify(Array.isArray(v) ? v : parseJSON(v) || []) : clip(v, c === 'content' || c === 'details' ? 60000 : 2000);
async function uniqueSlug(t, base, exceptId) { let s = slugify(base), n = 1; while ((await q(`select id from ${t} where slug=$1 and id<>$2`, [s, exceptId || 0])).length) s = slugify(base) + '-' + (++n); return s; }
Object.entries(RES).forEach(([t, r]) => {
  app.get(`/api/admin/${t}`, auth, wrap(async (req, res) => res.json(await q(`select * from ${t} order by ${r.order}`))));
  app.post(`/api/admin/${t}`, auth, wrap(async (req, res) => {
    const b = { ...req.body }; if (r.from) b.slug = await uniqueSlug(t, b.slug || b[r.from]);
    const cols = r.cols.filter(c => b[c] !== undefined); if (!cols.length) return res.status(400).json({ error: 'Nothing to save' });
    const out = await q(`insert into ${t}(${cols.join(',')}) values(${cols.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, cols.map(c => norm(c, b[c])));
    res.json(out[0]);
  }));
  app.put(`/api/admin/${t}/:id`, auth, wrap(async (req, res) => {
    const id = Number(req.params.id), b = { ...req.body }; if (r.from && b.slug) b.slug = await uniqueSlug(t, b.slug, id);
    const cols = r.cols.filter(c => b[c] !== undefined); if (!cols.length) return res.status(400).json({ error: 'Nothing to save' });
    const out = await q(`update ${t} set ${cols.map((c, i) => c + '=$' + (i + 1)).join(',')} where id=$${cols.length + 1} returning *`, [...cols.map(c => norm(c, b[c])), id]);
    out[0] ? res.json(out[0]) : res.status(404).json({ error: 'Not found' });
  }));
  app.delete(`/api/admin/${t}/:id`, auth, wrap(async (req, res) => {
    const id = Number(req.params.id); if (t === 'categories') await q('delete from products where category_id=$1', [id]);
    await q(`delete from ${t} where id=$1`, [id]); res.json({ ok: true });
  }));
});
const LISTS = { inquiries: 'select id,ref,name,company,email,phone,product,quantity,message,fields,config,image_id,status,created_at from inquiries order by id desc', contacts: 'select * from contacts order by id desc', applications: 'select id,name,email,phone,position,message,cv_name,status,created_at from applications order by id desc', subscribers: 'select * from subscribers order by id desc' };
Object.entries(LISTS).forEach(([t, sql]) => {
  app.get(`/api/admin/${t}`, auth, wrap(async (req, res) => res.json(await q(sql))));
  if (t !== 'subscribers') app.patch(`/api/admin/${t}/:id`, auth, wrap(async (req, res) => { await q(`update ${t} set status=$1 where id=$2`, [clip(req.body.status, 20), Number(req.params.id)]); res.json({ ok: true }); }));
  app.delete(`/api/admin/${t}/:id`, auth, wrap(async (req, res) => { await q(`delete from ${t} where id=$1`, [Number(req.params.id)]); res.json({ ok: true }); }));
});
app.get('/api/admin/applications/:id/cv', auth, wrap(async (req, res) => {
  const r = await q('select cv_name,cv_mime,cv_data from applications where id=$1', [Number(req.params.id)]);
  if (!r[0]) return res.status(404).end();
  res.set({ 'Content-Type': r[0].cv_mime || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(r[0].cv_name)}"` }).send(Buffer.from(r[0].cv_data, 'base64'));
}));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------- pages (SEO-friendly meta injection) ---------- */
const cache = {};
const setMeta = (h, m) => {
  const t = esc(m.title), d = esc(m.desc);
  h = h.replace(/<title>.*?<\/title>/s, `<title>${t}</title>`).replace(/(<meta name="description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${t}`).replace(/(<meta property="og:description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${t}`).replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${d}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}${m.path}`).replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}${m.path}`);
  if (m.image) h = h.replace('</head>', `<meta property="og:image" content="${esc(m.image.startsWith('http') ? m.image : SITE + m.image)}"/></head>`);
  if (m.ld) h = h.replace('</head>', `<script type="application/ld+json">${JSON.stringify(m.ld).replace(/</g, '\\u003c')}</script></head>`);
  return h;
};
app.get(['/', '/*.html'], wrap(async (req, res, next) => {
  const f = req.path === '/' ? '/index.html' : req.path, fp = path.join(PUB, path.normalize(f));
  if (!fp.startsWith(PUB) || !fs.existsSync(fp)) return next();
  let h = cache[fp] || (cache[fp] = fs.readFileSync(fp, 'utf8').split('__SITE_URL__').join(SITE));
  if (f === '/product.html' && req.query.p) {
    const r = await q('select p.*,c.name cn from products p join categories c on c.id=p.category_id where p.slug=$1 and p.active', [String(req.query.p)]);
    if (r[0]) { const p = pubProduct(r[0]); h = setMeta(h, { title: `${p.name} | OEM ${p.cn} | Bagzinic Industries`, desc: clip(p.summary || p.details, 155), path: `/product.html?p=${p.slug}`, image: p.images[0], ld: { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: clip(p.summary || p.details, 300), image: p.images.map(i => i.startsWith('http') ? i : SITE + i), brand: { '@type': 'Brand', name: 'Bagzinic Industries' }, category: p.cn } }); }
  }
  if (f === '/post.html' && req.query.s) {
    const r = await q('select * from posts where slug=$1 and published', [String(req.query.s)]);
    if (r[0]) h = setMeta(h, { title: `${r[0].title} | Bagzinic Blog`, desc: clip(r[0].excerpt, 155), path: `/post.html?s=${r[0].slug}`, image: r[0].cover || undefined, ld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: r[0].title, description: r[0].excerpt, datePublished: new Date(r[0].created_at).toISOString(), author: { '@type': 'Organization', name: 'Bagzinic Industries' } } });
  }
  if (!h.includes('property="og:image"') && ['png','jpg','webp'].some(x => fs.existsSync(path.join(PUB, 'assets/images/logo.' + x)))) { const x = ['png','jpg','webp'].find(x => fs.existsSync(path.join(PUB, 'assets/images/logo.' + x))); h = h.replace('</head>', `<meta property="og:image" content="${SITE}/assets/images/logo.${x}"/></head>`); }
  res.set('Content-Type', 'text/html; charset=utf-8').send(h);
}));
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`));
app.get('/sitemap.xml', wrap(async (req, res) => {
  const pages = ['', 'about.html', 'our-journey.html', 'products.html', 'oem-custom-orders.html', 'customize.html', 'inquiry.html', 'quality.html', 'gallery.html', 'blog.html', 'careers.html', 'contact.html', 'legal.html'];
  const urls = pages.map(p => [`${SITE}/${p}`, p ? .8 : 1]);
  (await q('select slug from products where active')).forEach(r => urls.push([`${SITE}/product.html?p=${r.slug}`, .7]));
  (await q('select slug from posts where published')).forEach(r => urls.push([`${SITE}/post.html?s=${r.slug}`, .6]));
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, p]) => `<url><loc>${esc(u)}</loc><priority>${p}</priority></url>`).join('\n')}\n</urlset>`);
}));
app.use(express.static(PUB, { index: false, maxAge: PROD ? '7d' : 0 }));
app.use((req, res) => { const f = path.join(PUB, '404.html'); res.status(404); fs.existsSync(f) ? res.type('html').send(fs.readFileSync(f, 'utf8').split('__SITE_URL__').join(SITE)) : res.send('Not found'); });

app.use((err, req, res, next) => { console.error(err.message); res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB each).' : 'Upload failed. Please try again.' }); });

init().then(() => app.listen(PORT, () => console.log(`Bagzinic running on ${SITE} (port ${PORT})`))).catch(e => { console.error('Startup failed:', e); process.exit(1); });
module.exports = app;
