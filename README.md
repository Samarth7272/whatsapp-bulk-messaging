<div align="center">

# 💬 WhatsApp Bulk Messaging System

### Hospital Notifications via WhatsApp Cloud API · Node.js · SQLite

*A web-based bulk messaging platform for hospital notifications. Import contacts from Excel, pick an approved template, fill in variables, then send now or schedule it. Delivery status is tracked and reported.*



![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)




![WhatsApp](https://img.shields.io/badge/WhatsApp-Cloud%20API-25D366?logo=whatsapp&logoColor=white)




![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)




![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)




![HTML](https://img.shields.io/badge/Frontend-HTML-E34F26?logo=html5&logoColor=white)



[📧 Hire Me](mailto:samarthworldwide@gmail.com) · [💼 LinkedIn](https://www.linkedin.com/in/samarth-shukla-b72003293) · [🐙 GitHub](https://github.com/Samarth7272)

</div>

---

## 📌 TL;DR (for recruiters)

- **What:** An end-to-end bulk messaging system: Excel contacts → approved template → send or schedule → WhatsApp Cloud API → delivery reports.
- **Why it matters:** It shows I can build a real-world backend that integrates a third-party API, handles authentication and roles, stores data, schedules jobs and reports on results.
- **Stack:** Node.js · JavaScript · SQLite · WhatsApp Cloud API · JWT Auth · HTML frontend.
- **Safe to try:** It starts in **Test mode**, where messages are simulated (sent → delivered → read). No Meta credentials are needed to explore everything.

---

## 🎯 The Problem

Hospitals need to reach many patients quickly with appointment reminders, announcements and follow-ups. Doing this by hand is slow, error-prone and hard to track.

This system automates it. Staff upload a contact list, choose a pre-approved WhatsApp template, and send or schedule the campaign. Every message is logged so delivery can be tracked.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 📥 **Excel contact import** | Upload contacts from Excel. Only `Mobile` is required |
| 📝 **Message templates** | Use Meta-approved templates and fill in variables per contact |
| 🚀 **Send now or schedule** | Run a campaign immediately or schedule it for later |
| 🔄 **Delivery tracking** | Webhook updates mark messages as sent, delivered, read or failed |
| 📊 **Reports** | View campaign results and message-level logs |
| 🔐 **Role-based access** | JWT login with admin and staff roles. Settings are admin-only |
| 🧪 **Safe Test mode** | Simulates the full message lifecycle without Meta credentials |
| 🗄️ **Zero-config database** | SQLite file created automatically on first run |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js 18+** | Backend runtime |
| **JavaScript** | Server and client logic |
| **SQLite** | Lightweight embedded database |
| **WhatsApp Cloud API (Meta)** | Message delivery |
| **JWT** | Authentication and sessions |
| **HTML / CSS** | Frontend interface |
| **nginx + pm2** | Production deployment |
| **Git & GitHub** | Version control |

---

## 🏗️ Architecture

```
   Excel / CSV contacts
            │
            ▼
   Frontend (public/)  ◄── login (JWT, admin / staff)
            │
            ▼
   Node.js server (server/)
     ├─ Contacts · Templates · Campaigns
     ├─ Scheduler (scheduled messages)
     └─ Reports
            │
     ┌──────┴───────────────┐
     ▼                      ▼
  SQLite (data/app.db)   WhatsApp Cloud API
                              │
                              ▼
                  Webhook: delivered / read / failed
                              │
                              ▼
                  Status updates + reports
```

---

## 📁 Project Structure

```
whatsapp-bulk-messaging/
├── public/            # Frontend (HTML, CSS and JS)
├── sample/            # Sample data (contacts_sample.csv)
├── server/            # Backend: API, auth, scheduler, WhatsApp integration
├── .env.example       # Environment variable template
├── .node-version      # Node.js version (22.12.0)
├── package.json
└── README.md
```

---

## 🧩 Modules

**Dashboard** · **Contacts** · **Templates** · **Campaigns** · **Scheduled Messages** · **Reports** · **Settings** (admin only; staff users have no Settings access)

### 🗄️ Database Tables

`contacts` · `templates` · `campaigns` · `message_logs` · `settings` · `users`

(SQLite file at `data/app.db`, created automatically.)

---

## 🚀 Run Locally (Node.js 18+)

```bash
git clone https://github.com/Samarth7272/whatsapp-bulk-messaging.git
cd whatsapp-bulk-messaging

cp .env.example .env     # set a strong JWT_SECRET and your admin credentials
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) and log in with the admin credentials you set in `.env`.

> 🧪 The first run is in **Test mode**: messages are simulated (sent → delivered → read), so you can try everything without Meta credentials.

> 🔒 Change the default admin credentials in `.env` before the first run, or add users in Settings.

---

## 📲 Go Live with Real WhatsApp

1. In **Meta Business → WhatsApp Cloud API**, get a permanent **access token** and **Phone number ID**.
2. Create message templates and get them **approved** in Meta. Add the same name, language and body on the **Templates** page.
3. Go to **Settings**, paste the token and phone number ID, turn **Test mode OFF** and save.
4. **Webhook** (for delivered, read and failed updates): set the callback URL to `https://YOUR-DOMAIN/webhook` and set the verify token to the value in Settings.

---

## 📑 Excel Format

- **Required:** `Mobile`
- **Optional:** `Name`, `Group`
- Every other column (Appointment Date, Doctor, Time…) is available as a **template variable**.

See `sample/contacts_sample.csv` for an example.

---

## ☁️ Deployment (VPS / AWS / Hostinger)

```bash
npm install --omit=dev
pm2 start server/index.js
```

Run it behind **nginx with HTTPS**. Set a strong `JWT_SECRET` in `.env`. The webhook needs a public HTTPS URL.

---

## 🎓 Skills Demonstrated

- Integrating a **production third-party API** (WhatsApp Cloud API)
- **REST backend design** with Node.js
- **JWT authentication** and **role-based access control**
- **Relational data modelling** with SQLite
- **Scheduled jobs** and campaign management
- **Webhook handling** for real-time delivery status
- **Excel and CSV data import** with dynamic template variables
- A safe **Test mode** for development and demos
- **Deployment** with nginx, HTTPS and pm2

---

## 🔮 Roadmap

- [ ] 🐳 Docker image
- [ ] 🧪 Automated tests and GitHub Actions CI
- [ ] 🔁 Retry with backoff for failed messages
- [ ] 📈 Richer analytics (delivery rate and read rate charts)
- [ ] 🌐 Multi-language templates
- [ ] 🗃️ PostgreSQL option for larger deployments

---

## ⚠️ Disclaimer

This project is built for **educational and demonstration purposes** (a college project). Use real patient data only with proper consent, security review and compliance with applicable regulations. Never commit `.env` or API tokens.

---

## 👨‍💻 About the Author

**Samarth Shukla** is a B.Tech Computer Science student and Software Engineer Intern at LV8, building backend and full-stack applications.

**Skills:** Python · JavaScript/TypeScript · Node.js · React/Next.js · FastAPI · Flask · Django · SQL · Docker · AWS · Git

### 💼 Open to Opportunities

I'm actively looking for **Software Engineer, Backend and Full-Stack** roles (full-time and internships). If this project caught your eye, I'd love to talk.

[

![Email](https://img.shields.io/badge/Email-samarthworldwide%40gmail.com-D14836?logo=gmail&logoColor=white)

](mailto:samarthworldwide@gmail.com)
[

![LinkedIn](https://img.shields.io/badge/LinkedIn-Samarth%20Shukla-0A66C2?logo=linkedin&logoColor=white)

](https://www.linkedin.com/in/samarth-shukla-b72003293)
[

![GitHub](https://img.shields.io/badge/GitHub-Samarth7272-181717?logo=github&logoColor=white)

](https://github.com/Samarth7272)

---

⭐ If you found this project useful, please give it a star!
