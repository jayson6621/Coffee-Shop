# API Examples

Base URL: `https://coffee-shop-api-6pak.onrender.com`

Staff-only endpoints need the header `Authorization: Bearer <token>`.

## Health
`GET /api/health` → `200 {"status":"ok","database":"redis","time":"..."}`

## Staff login
`POST /api/auth/login`
```json
{ "username": "staff", "password": "YOUR_PASSWORD" }
```
→ `200 { "token": "..." }` or `401 { "error": "Incorrect username or password" }`

## Menu
- `GET /api/menu` → `200` array of items
- `GET /api/menu/:id` → `200` item, or `404 { "error": "Menu item not found" }`
- `POST /api/menu` (staff) → `201` created item
  ```json
  { "name": "Mocha", "description": "Espresso with chocolate", "price": 32, "category": "Coffee", "available": true }
  ```
- `PUT /api/menu/:id` (staff) → `200` updated item, e.g. `{ "price": 35 }`
- `DELETE /api/menu/:id` (staff) → `204` no content

## Orders
- `POST /api/orders` → `201` order with `orderNumber` such as `CS-0001`
  ```json
  { "customerName": "Thabo", "notes": "Extra hot", "items": [{ "menuId": "<menu id>", "quantity": 2 }] }
  ```
- `GET /api/orders` (staff) → `200` array, optional `?status=Pending`
- `GET /api/orders/summary` (staff) → `200` daily totals, optional `?date=YYYY-MM-DD`
- `GET /api/orders/:id` → `200` order, or `404`
- `PATCH /api/orders/:id/status` (staff)
  ```json
  { "status": "Preparing" }
  ```
  Allowed: Pending, Preparing, Ready, Collected

## Error format
```json
{ "error": "Validation failed", "details": ["price must be a number of 0 or more"] }
```
Status codes: 400 validation, 401 not signed in, 404 not found, 409 item unavailable, 500 server error.