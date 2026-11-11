import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createStore } from './db.js';

const db = createStore();
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STAFF_USERNAME = process.env.STAFF_USERNAME || 'staff';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'staff123';

const CATEGORIES = ['Coffee', 'Tea', 'Pastries', 'Other'];
const STATUSES = ['Pending', 'Preparing', 'Ready', 'Collected'];

const origins = (process.env.CLIENT_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? '*' : origins }));
app.use(express.json({ limit: '50kb' }));

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const money = (n) => Math.round(n * 100) / 100;
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---------- Auth (staff only) ----------
function requireStaff(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'staff') throw new Error('bad role');
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || !safeEqual(username, STAFF_USERNAME) || !safeEqual(password, STAFF_PASSWORD)) {
    throw new HttpError(401, 'Incorrect username or password');
  }
  res.json({ token: jwt.sign({ role: 'staff' }, JWT_SECRET, { expiresIn: '8h' }) });
});

// ---------- Validation ----------
function validateMenu(body, partial = false) {
  const errors = [];
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('name')) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80) errors.push('name must be 1-80 characters');
    else out.name = body.name.trim();
  }
  if (!partial || has('description')) {
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 300)) errors.push('description must be text up to 300 characters');
    else out.description = (body.description || '').trim();
  }
  if (!partial || has('price')) {
    const p = Number(body.price);
    if (body.price === '' || body.price === null || !Number.isFinite(p) || p < 0 || p > 100000) errors.push('price must be a number of 0 or more');
    else out.price = money(p);
  }
  if (!partial || has('category')) {
    if (!CATEGORIES.includes(body.category)) errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
    else out.category = body.category;
  }
  if (!partial || has('available')) {
    if (body.available !== undefined && typeof body.available !== 'boolean') errors.push('available must be true or false');
    else out.available = body.available ?? true;
  }
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
  return out;
}

// ---------- Health ----------
app.get('/api/health', wrap(async (_req, res) => {
  await db.ping();
  res.json({ status: 'ok', database: db.kind, time: new Date().toISOString() });
}));

// ---------- Menu ----------
app.get('/api/menu', wrap(async (_req, res) => {
  const items = await db.list('menu:');
  items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  res.json(items);
}));

app.get('/api/menu/:id', wrap(async (req, res) => {
  const item = await db.get(`menu:${req.params.id}`);
  if (!item) throw new HttpError(404, 'Menu item not found');
  res.json(item);
}));

app.post('/api/menu', requireStaff, wrap(async (req, res) => {
  const data = validateMenu(req.body || {});
  const item = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
  await db.set(`menu:${item.id}`, item);
  res.status(201).json(item);
}));

app.put('/api/menu/:id', requireStaff, wrap(async (req, res) => {
  const existing = await db.get(`menu:${req.params.id}`);
  if (!existing) throw new HttpError(404, 'Menu item not found');
  const data = validateMenu(req.body || {}, true);
  const updated = { ...existing, ...data, id: existing.id, updatedAt: new Date().toISOString() };
  await db.set(`menu:${existing.id}`, updated);
  res.json(updated);
}));

app.delete('/api/menu/:id', requireStaff, wrap(async (req, res) => {
  const ok = await db.del(`menu:${req.params.id}`);
  if (!ok) throw new HttpError(404, 'Menu item not found');
  res.status(204).end();
}));

// ---------- Orders ----------
app.post('/api/orders', wrap(async (req, res) => {
  const { customerName, items, notes = '' } = req.body || {};
  const errors = [];
  if (typeof customerName !== 'string' || !customerName.trim() || customerName.length > 60) errors.push('customerName must be 1-60 characters');
  if (typeof notes !== 'string' || notes.length > 300) errors.push('notes must be text up to 300 characters');
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) errors.push('items must be a non-empty list');
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);

  const lines = [];
  for (const it of items) {
    const qty = Number(it?.quantity);
    if (typeof it?.menuId !== 'string' || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new HttpError(400, 'Each item needs a menuId and a whole-number quantity from 1 to 50');
    }
    const m = await db.get(`menu:${it.menuId}`);
    if (!m) throw new HttpError(400, `Menu item ${it.menuId} no longer exists`);
    if (!m.available) throw new HttpError(409, `${m.name} is currently unavailable`);
    // Price comes from the database, never from the client.
    lines.push({ menuId: m.id, name: m.name, price: m.price, quantity: qty, subtotal: money(m.price * qty) });
  }
  const seq = await db.incr('counter:order');
  const order = {
    id: crypto.randomUUID(),
    orderNumber: `CS-${String(seq).padStart(4, '0')}`,
    customerName: customerName.trim(),
    notes: notes.trim(),
    items: lines,
    total: money(lines.reduce((s, l) => s + l.subtotal, 0)),
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  await db.set(`order:${order.id}`, order);
  res.status(201).json(order);
}));

app.get('/api/orders/summary', requireStaff, wrap(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'date must be YYYY-MM-DD');
  const orders = (await db.list('order:')).filter((o) => o.createdAt.startsWith(date));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const itemCounts = {};
  let revenue = 0;
  for (const o of orders) {
    byStatus[o.status]++;
    revenue += o.total;
    for (const l of o.items) itemCounts[l.name] = (itemCounts[l.name] || 0) + l.quantity;
  }
  const topItems = Object.entries(itemCounts).map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  res.json({ date, orderCount: orders.length, revenue: money(revenue), averageOrder: orders.length ? money(revenue / orders.length) : 0, byStatus, topItems });
}));

app.get('/api/orders', requireStaff, wrap(async (req, res) => {
  let orders = await db.list('order:');
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}`);
    orders = orders.filter((o) => o.status === req.query.status);
  }
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(orders);
}));

// Order IDs are unguessable UUIDs, so customers can re-open their confirmation.
app.get('/api/orders/:id', wrap(async (req, res) => {
  const order = await db.get(`order:${req.params.id}`);
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(order);
}));

app.patch('/api/orders/:id/status', requireStaff, wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  const order = await db.get(`order:${req.params.id}`);
  if (!order) throw new HttpError(404, 'Order not found');
  const updated = { ...order, status, updatedAt: new Date().toISOString() };
  await db.set(`order:${order.id}`, updated);
  res.json(updated);
}));

// ---------- Errors ----------
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Request body is not valid JSON');
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message, details: err.details });
});

// ---------- Seed sample menu on first run ----------
async function seed() {
  if ((await db.list('menu:')).length) return;
  const sample = [
    ['Espresso', 'Double shot, rich crema', 18, 'Coffee'],
    ['Flat White', 'Espresso with silky steamed milk', 28, 'Coffee'],
    ['Cappuccino', 'Equal parts espresso, milk and foam', 30, 'Coffee'],
    ['Rooibos Tea', 'Caffeine-free red bush, served hot', 20, 'Tea'],
    ['Butter Croissant', 'Baked fresh every morning', 25, 'Pastries'],
    ['Blueberry Muffin', 'Fruit-packed and lightly sweet', 22, 'Pastries'],
    ['Sparkling Water', '330ml bottle', 15, 'Other'],
  ];
  for (const [name, description, price, category] of sample) {
    const id = crypto.randomUUID();
    await db.set(`menu:${id}`, { id, name, description, price, category, available: true, createdAt: new Date().toISOString() });
  }
  console.log('Seeded sample menu');
}

seed().then(() => app.listen(PORT, () => console.log(`API running on port ${PORT} (database: ${db.kind})`)));
