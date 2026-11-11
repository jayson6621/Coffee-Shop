import { useState } from 'react';
import Customer from './Customer.jsx';
import Staff from './Staff.jsx';

export default function App() {
  const [view, setView] = useState('shop');
  return (
    <>
      <header className="top">
        <h1>Bean There</h1>
        <nav aria-label="Main">
          <button className={view === 'shop' ? 'tab on' : 'tab'} onClick={() => setView('shop')}>Order</button>
          <button className={view === 'staff' ? 'tab on' : 'tab'} onClick={() => setView('staff')}>Staff</button>
        </nav>
      </header>
      <main>{view === 'shop' ? <Customer /> : <Staff />}</main>
    </>
  );
}
