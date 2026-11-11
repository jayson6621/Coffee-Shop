import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, money } from './api.js';

const STATUSES = ['Pending', 'Preparing', 'Ready', 'Collected'];
const CATEGORIES = ['Coffee', 'Tea', 'Pastries', 'Other'];

export default function Staff() {
  const [authed, setAuthed] = useState(!!getToken());
  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener('staff-logout', out);
    return () => window.removeEventListener('staff-logout', out);
  }, []);
  return authed ? <Dashboard onLogout={() => { setToken(null); setAuthed(false); }} /> : <Login onDone={() => setAuthed(true)} />;
}

function Login({ onDone }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setError('');
    try { const { token } = await api.login(username, password); setToken(token); onDone(); }
    catch (err) { setError(err.message); }
  }
  return (
    <form className="login" onSubmit={submit}>
      <h2>Staff sign in</h2>
      <label>Username<input required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" /></label>
      <label>Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn">Sign in</button>
    </form>
  );
}

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState('orders');
  return (
    <div>
      <div className="bar">
        <div>
          {['orders', 'menu', 'summary'].map((t) => (
            <button key={t} className={tab === t ? 'tab on' : 'tab'} onClick={() => setTab(t)}>{t === 'orders' ? 'Orders' : t === 'menu' ? 'Menu items' : 'Daily summary'}</button>
          ))}
        </div>
        <button className="btn ghost small" onClick={onLogout}>Sign out</button>
      </div>
      {tab === 'orders' && <Orders />}
      {tab === 'menu' && <MenuManager />}
      {tab === 'summary' && <Summary />}
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('Active');
  const [error, setError] = useState('');
  const load = useCallback(() => api.orders().then((o) => { setOrders(o); setError(''); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const change = (id, status) => api.setStatus(id, status).then(load).catch((e) => setError(e.message));
  const shown = orders.filter((o) => (filter === 'Active' ? o.status !== 'Collected' : filter === 'All' ? true : o.status === filter));

  return (
    <section>
      <label className="inline">Show
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {['Active', 'All', ...STATUSES].map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {!shown.length && <p className="muted">No orders to show.</p>}
      <ul className="plain orders">
        {shown.map((o) => (
          <li key={o.id} className="order">
            <div className="orderhead">
              <h3>{o.orderNumber} · {o.customerName}</h3>
              <span className={`status s-${o.status}`}>{o.status}</span>
            </div>
            <p className="muted">{new Date(o.createdAt).toLocaleString()}</p>
            <ul className="plain">{o.items.map((l) => <li key={l.menuId}>{l.quantity} × {l.name}</li>)}</ul>
            {o.notes && <p className="note">Note: {o.notes}</p>}
            <div className="orderfoot">
              <b>{money(o.total)}</b>
              <label className="inline">Status
                <select value={o.status} onChange={(e) => change(o.id, e.target.value)}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const blank = { name: '', description: '', price: '', category: 'Coffee', available: true };

function MenuManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.menu().then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault(); setError('');
    const payload = { ...form, price: Number(form.price) };
    try {
      if (editing) await api.updateMenu(editing, payload); else await api.addMenu(payload);
      setForm(blank); setEditing(null); load();
    } catch (err) { setError(err.message); }
  }
  const edit = (m) => { setEditing(m.id); setForm({ name: m.name, description: m.description, price: m.price, category: m.category, available: m.available }); window.scrollTo({ top: 0 }); };
  const toggle = (m) => api.updateMenu(m.id, { available: !m.available }).then(load).catch((e) => setError(e.message));
  const remove = (m) => window.confirm(`Delete ${m.name}? This can't be undone.`) && api.deleteMenu(m.id).then(load).catch((e) => setError(e.message));

  return (
    <section>
      <form className="menuform" onSubmit={save}>
        <h2>{editing ? 'Edit menu item' : 'Add menu item'}</h2>
        <label>Name<input required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Description<input maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="row">
          <label>Price (M)<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} /> Available</label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="btn">{editing ? 'Save changes' : 'Add item'}</button>
          {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>
      <ul className="plain">
        {items.map((m) => (
          <li key={m.id} className="dish">
            <div><h3>{m.name} <span className="muted">· {m.category}</span></h3><p className="muted">{m.description}</p></div>
            <div className="buy">
              <span className="price">{money(m.price)}</span>
              <button className="btn ghost small" onClick={() => toggle(m)}>{m.available ? 'Mark sold out' : 'Mark available'}</button>
              <button className="btn ghost small" onClick={() => edit(m)}>Edit</button>
              <button className="btn danger small" onClick={() => remove(m)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Summary() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.summary().then(setS).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="error" role="alert">{error}</p>;
  if (!s) return <p className="muted">Loading…</p>;
  return (
    <section>
      <h2>Today ({s.date}, UTC)</h2>
      <dl className="stats">
        <div><dt>Orders</dt><dd>{s.orderCount}</dd></div>
        <div><dt>Revenue</dt><dd>{money(s.revenue)}</dd></div>
        <div><dt>Average order</dt><dd>{money(s.averageOrder)}</dd></div>
      </dl>
      <h3>By status</h3>
      <ul className="plain">{STATUSES.map((st) => <li key={st} className="cartline"><span>{st}</span><span>{s.byStatus[st]}</span></li>)}</ul>
      <h3>Best sellers</h3>
      {!s.topItems.length ? <p className="muted">No sales yet today.</p> : (
        <ul className="plain">{s.topItems.map((t) => <li key={t.name} className="cartline"><span>{t.name}</span><span>{t.quantity} sold</span></li>)}</ul>
      )}
    </section>
  );
}
