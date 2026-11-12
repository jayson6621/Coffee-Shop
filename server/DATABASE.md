# Database

The app stores its data in **Redis**, a key-value NoSQL database hosted on Upstash. Every record is saved under a unique key, and its value is a JSON object. Data persists after the server restarts because it lives in Redis, not in the server's memory.

The code that talks to Redis is in `server/db.js`.

## Keys

| Key | Value | Purpose |
|---|---|---|
| `menu:<uuid>` | `{ id, name, description, price, category, available, createdAt }` | One menu item |
| `order:<uuid>` | `{ id, orderNumber, customerName, notes, items[], total, status, createdAt }` | One customer order |
| `counter:order` | A whole number | Counts orders, used to make order numbers like `CS-0001` |

## How it works
- **Unique IDs:** each menu item and order gets a random UUID when it is created, and that UUID is part of its key.
- **Reading all records:** the server scans for keys that start with `menu:` or `order:` and loads their values.
- **Order numbers:** each new order increases `counter:order` by one, which gives `CS-0001`, `CS-0002` and so on.
- **Order items:** each order stores the item name, price and quantity at the time of the order, so later price changes don't alter old orders.

## Configuration
The connection URL is kept in the `REDIS_URL` environment variable on the server (Render) and in a local `.env` file. It is never committed to GitHub.