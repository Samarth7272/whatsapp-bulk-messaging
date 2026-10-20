# WhatsApp Bulk Messaging System (Single Hospital)

Import contacts from Excel → pick an approved template → fill variables → send now / schedule → WhatsApp Cloud API → view reports.

## Run (Node.js 18+)
```
npm install
npm start
```
Open http://localhost:3000 — login `admin@hospital.com` / `Admin@123` (change in `.env` before first run, or add users in Settings).

The first run is in **Test mode**: messages are simulated (sent → delivered → read), so you can try everything without Meta credentials.

## Go live with real WhatsApp
1. Meta Business → WhatsApp Cloud API: get a permanent **access token** and **Phone number ID**.
2. Create and get your message templates **approved** in Meta. Add the same name/language/body in the **Templates** page.
3. Settings → paste token + phone number ID → Test mode **OFF** → Save.
4. Webhook (for delivered/read/failed updates): Callback URL `https://YOUR-DOMAIN/webhook`, verify token = value in Settings.

## Excel format
Required: `Mobile`. Optional: `Name`, `Group`. Every other column (Appointment Date, Doctor, Time…) is available for template variables. See `sample/contacts_sample.csv`.

## Modules
Dashboard · Contacts · Templates · Campaigns · Scheduled Messages · Reports · Settings (admin only; staff role has no Settings access).

## Tables
contacts, templates, campaigns, message_logs, settings, users (SQLite file `data/app.db`, created automatically).

## Deploy (VPS / AWS / Hostinger)
`npm install --omit=dev && npm start` behind nginx + HTTPS (use `pm2 start server/index.js`). Set a strong `JWT_SECRET` in `.env`. Webhook needs a public HTTPS URL.

## Notes
- Database is SQLite and the queue is in-process (rate-limited, 3 retries, resumes after restart, scheduler checks every 10 s) so it runs with zero extra setup. For PostgreSQL/MySQL + Redis/BullMQ at larger scale, replace `server/db.js` and `server/queue.js`; routes stay the same.
- React loads from CDN (cdnjs/jsdelivr), so the browser needs internet.
