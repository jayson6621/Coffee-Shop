# Bean There – Coffee Shop Management System

Full-stack web app: customers browse the menu, build a cart and place orders; staff manage the menu and move orders through Pending → Preparing → Ready → Collected.

**Live links (fill in after deploying)**
- Frontend: https://coffee-shop-nu-sepia.vercel.app
- API: https://coffee-shop-api-6pak.onrender.com/api/health

## Technologies
| Layer | Tech | Hosting |
|---|---|---|
| Frontend | React 18 + Vite, Fetch API | Vercel or Netlify |
| Backend | Node.js, Express.js, JWT auth | Render |
| Database | Redis (key-value, persistence on) | Render Key Value / Upstash / Redis Cloud |

## Data model (key → JSON value)
- `menu:<uuid>` → `{ id, name, description, price, category, available, createdAt }`
- `order:<uuid>` → `{ id, orderNumber, customerName, notes, items[], total, status, createdAt }`
- `counter:order` → integer used to make order numbers (`CS-0001`, `CS-0002`…)

## Run locally
```bash
# Terminal 1 – API
cd server
cp .env.example .env        # edit STAFF_PASSWORD and JWT_SECRET
npm install
npm run dev                 # http://localhost:4000  (uses data.json if REDIS_URL is empty)

# Terminal 2 – frontend
cd client
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:5173
```
Staff login uses `STAFF_USERNAME` / `STAFF_PASSWORD` from `server/.env`.

## API endpoints
🔒 = staff only (header `Authorization: Bearer <token>`)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Backend + database availability |
| POST | /api/auth/login | Staff login, returns JWT |
| GET | /api/menu | All menu items |
| GET | /api/menu/:id | One menu item |
| POST | /api/menu 🔒 | Add item |
| PUT | /api/menu/:id 🔒 | Update item (partial updates allowed) |
| DELETE | /api/menu/:id 🔒 | Delete item |
| POST | /api/orders | Place order (prices are taken from the database) |
| GET | /api/orders 🔒 | List orders (`?status=Pending`) |
| GET | /api/orders/summary 🔒 | Daily summary (`?date=YYYY-MM-DD`) |
| GET | /api/orders/:id | One order (unguessable UUID) |
| PATCH | /api/orders/:id/status 🔒 | Set status |

Errors always return `{ "error": "message", "details": [...] }` with 400 (validation), 401 (auth), 404, 409 (item unavailable) or 500.

## Deployment
1. **Database** – create a Redis instance with persistence (Render Key Value on a paid plan, or Upstash/Redis Cloud free tier). Copy its connection URL.
2. **Backend on Render** – New Web Service from this repo, Root Directory `server`, Build `npm install`, Start `npm start`. Environment variables: `REDIS_URL`, `JWT_SECRET`, `STAFF_USERNAME`, `STAFF_PASSWORD`, `CLIENT_ORIGIN` (your frontend URL). Check `/api/health`.
3. **Frontend on Vercel/Netlify** – Root Directory `client`, build `npm run build`, output `dist`. Environment variable `VITE_API_URL` = Render API URL. Redeploy after setting it.
4. Set `CLIENT_ORIGIN` on Render to the final frontend URL.

## Testing checklist (for the demo)
1. Open `/api/health` → `status: ok`.
2. Staff → sign in → add a menu item.
3. Order tab → add items → place order → note the order number.
4. Staff → Orders → change status to Preparing → Ready → Collected.
5. Redeploy/restart the API and confirm the data is still there (persistence).

## Team contributions
See `CONTRIBUTIONS.md`.
