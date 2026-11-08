const fs = require('fs'), path = require('path');
let pool;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
} else {
  if (process.env.NODE_ENV === 'production') { console.error('DATABASE_URL is not set. Add your Neon connection string in the Render environment variables.'); process.exit(1); }
  const { newDb } = require('pg-mem');
  pool = new (newDb().adapters.createPg().Pool)();
  console.log('DEV MODE: no DATABASE_URL, using a temporary in-memory database (data resets on restart).');
}
const SCHEMA = [
  `create table if not exists categories(id serial primary key, name text not null, slug text not null, description text default '', sort int default 0, active boolean default true, created_at timestamptz default now())`,
  `create table if not exists products(id serial primary key, category_id int, name text not null, slug text not null, summary text default '', details text default '', moq text default '', price_note text default '', specs text default '', images text default '[]', customizable boolean default false, custom_type text default 'photo', active boolean default true, sort int default 0, created_at timestamptz default now())`,
  `create table if not exists inquiries(id serial primary key, ref text, name text, company text, email text, phone text, product text, quantity text, message text, fields text default '{}', config text, image_id int, status text default 'new', created_at timestamptz default now())`,
  `create table if not exists contacts(id serial primary key, name text, email text, phone text, message text, status text default 'new', created_at timestamptz default now())`,
  `create table if not exists applications(id serial primary key, name text, email text, phone text, position text, message text, cv_name text, cv_mime text, cv_data text, status text default 'new', created_at timestamptz default now())`,
  `create table if not exists subscribers(id serial primary key, email text not null, created_at timestamptz default now())`,
  `create table if not exists posts(id serial primary key, title text not null, slug text not null, excerpt text default '', content text default '', cover text default '', published boolean default true, created_at timestamptz default now())`,
  `create table if not exists gallery(id serial primary key, url text not null, caption text default '', sort int default 0, created_at timestamptz default now())`,
  `create table if not exists media(id serial primary key, mime text, data text, created_at timestamptz default now())`
];
async function init() {
  for (const s of SCHEMA) await pool.query(s);
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
  const n = async t => Number((await pool.query(`select count(*) c from ${t}`)).rows[0].c);
  if (!(await n('categories'))) {
    for (const [i, c] of seed.categories.entries()) {
      const r = await pool.query('insert into categories(name,slug,description,sort) values($1,$2,$3,$4) returning id', [c.name, c.slug, c.description, i]);
      for (const [j, p] of (c.products || []).entries())
        await pool.query('insert into products(category_id,name,slug,summary,details,moq,specs,images,customizable,custom_type,sort) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [r.rows[0].id, p.name, p.slug, p.summary, p.details, p.moq, p.specs, JSON.stringify(p.images || []), true, p.custom_type, j]);
    }
  }
  if (!(await n('posts'))) for (const p of seed.posts) await pool.query('insert into posts(title,slug,excerpt,content,cover) values($1,$2,$3,$4,$5)', [p.title, p.slug, p.excerpt, p.content, p.cover || '']);
  if (!(await n('gallery'))) for (const [i, g] of seed.gallery.entries()) await pool.query('insert into gallery(url,caption,sort) values($1,$2,$3)', [g.url, g.caption, i]);
}
module.exports = { pool, init };
