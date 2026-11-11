import { useEffect, useMemo, useState } from 'react';
import { api, money } from './api.js';

const CATEGORIES = ['Coffee', 'Tea', 'Pastries', 'Other'];

export default function Customer() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState({}); // { menuId: quantity }
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState(null);

  const load = () => {
    setLoading(true);
    api.menu().then((m) => { setMenu(m); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const lines = useMemo(
    () => Object.entries(cart).map(([id, quantity]) => ({ item: menu.find((m) => m.id === id), quantity })).filter((l) => l.item),
    [cart, menu]
  );
  const total = lines.reduce((s, l) => s + l.item.price * l.quantity, 0);

  const setQty = (id, q) => setCart((c) => {
    const next = { ...c };
    if (q <= 0) delete next[id]; else next[id] = Math.min(q, 50);
    return next;
  });

  async function submit(e) {
    e.preventDefault();
    setPlacing(true); setError('');
    try {
      const result = await api.placeOrder({
        customerName: name,
        notes,
        items: lines.map((l) => ({ menuId: l.item.id, quantity: l.quantity })),
      });
      setOrder(result); setCart({}); setName(''); setNotes('');
    } catch (err) { setError(err.message); load(); } finally { setPlacing(false); }
  }

  if (order) {
    return (
      <section className="confirm">
        <p className="muted">Order placed. We'll call your name when it's ready.</p>
        <h2 className="ordernum">{order.orderNumber}</h2>
        <p>For {order.customerName}</p>
        <ul className="plain">
          {order.items.map((l) => <li key={l.menuId}><span>{l.quantity} × {l.name}</span><span>{money(l.subtotal)}</span></li>)}
        </ul>
        <p className="total"><span>Total</span><span>{money(order.total)}</span></p>
        <p className="muted">Status: {order.status}</p>
        <button className="btn" onClick={() => setOrder(null)}>Start a new order</button>
      </section>
    );
  }

  return (
    <div className="shop">
      <section aria-label="Menu">
        {loading && <p className="muted">Loading menu…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        {!loading && !menu.length && !error && <p className="muted">The menu is empty right now. Check back soon.</p>}
        {CATEGORIES.map((cat) => {
          const items = menu.filter((m) => m.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat} className="cat">
              <h2>{cat}</h2>
              <ul className="plain">
                {items.map((m) => (
                  <li key={m.id} className={m.available ? 'dish' : 'dish off'}>
                    <div>
                      <h3>{m.name}</h3>
                      <p className="muted">{m.description}</p>
                      {!m.available && <p className="tag">Sold out</p>}
                    </div>
                    <div className="buy">
                      <span className="price">{money(m.price)}</span>
                      <button className="btn small" disabled={!m.available} onClick={() => setQty(m.id, (cart[m.id] || 0) + 1)}>Add</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <aside className="cart" aria-label="Your order">
        <h2>Your order</h2>
        {!lines.length ? <p className="muted">Nothing here yet. Add something from the menu.</p> : (
          <form onSubmit={submit}>
            <ul className="plain">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="cartline">
                  <span>{item.name}</span>
                  <span className="qty">
                    <button type="button" aria-label={`Remove one ${item.name}`} onClick={() => setQty(item.id, quantity - 1)}>−</button>
                    <b>{quantity}</b>
                    <button type="button" aria-label={`Add one ${item.name}`} onClick={() => setQty(item.id, quantity + 1)}>+</button>
                  </span>
                  <span>{money(item.price * quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="total"><span>Total</span><span>{money(total)}</span></p>
            <label>Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Notes for the barista (optional)<textarea maxLength={300} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <button className="btn" disabled={placing}>{placing ? 'Placing order…' : 'Place order'}</button>
          </form>
        )}
      </aside>
    </div>
  );
}
