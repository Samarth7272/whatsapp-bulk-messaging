const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
const db = new Database(path.join(__dirname, '../data/app.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS contacts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT DEFAULT '', mobile TEXT UNIQUE NOT NULL, custom_fields TEXT DEFAULT '{}', grp TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS templates(id INTEGER PRIMARY KEY AUTOINCREMENT, template_name TEXT UNIQUE NOT NULL, language TEXT DEFAULT 'en', body TEXT NOT NULL, status TEXT DEFAULT 'approved', variables TEXT DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS campaigns(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, template_id INTEGER, total_count INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', scheduled_at TEXT, grp TEXT DEFAULT '', variable_map TEXT DEFAULT '[]', created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS message_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER, mobile TEXT, name TEXT, status TEXT DEFAULT 'pending', whatsapp_message_id TEXT, error TEXT, payload TEXT DEFAULT '[]', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_logs_c ON message_logs(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_logs_w ON message_logs(whatsapp_message_id);
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE NOT NULL, role TEXT DEFAULT 'staff', password_hash TEXT NOT NULL);
`);
const getSetting = (k, d = '') => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); return r && r.value !== null ? r.value : d; };
const setSetting = (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
const defaults = { hospital_name: 'City Care Hospital', country_code: '91', wa_token: '', wa_phone_number_id: '', wa_api_version: 'v20.0', verify_token: 'hospital_verify_token', mock_mode: 'true', rate_per_second: '20' };
for (const [k, v] of Object.entries(defaults)) if (!db.prepare('SELECT 1 FROM settings WHERE key=?').get(k)) setSetting(k, v);
if (!db.prepare('SELECT 1 FROM users').get())
  db.prepare('INSERT INTO users(name,email,role,password_hash) VALUES(?,?,?,?)').run('Admin', process.env.ADMIN_EMAIL || 'admin@hospital.com', 'admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@123', 10));
if (!db.prepare('SELECT 1 FROM templates').get()) {
  const ins = db.prepare('INSERT INTO templates(template_name,language,body,status,variables) VALUES(?,?,?,?,?)');
  ins.run('appt_reminder', 'en', 'Hello {{1}},\nYour appointment with {{2}} is scheduled on {{3}} at {{4}}.\n\nFor any changes, please contact our hospital.\n\nThank you!\n{{5}}', 'approved', JSON.stringify(['Name', 'Doctor Name', 'Appointment Date', 'Time', 'Hospital Name']));
  ins.run('camp_invite', 'en', 'Dear {{1}}, you are invited to our Health Checkup Camp on {{2}}. Regards, {{3}}', 'approved', JSON.stringify(['Name', 'Date', 'Hospital Name']));
  ins.run('vaccine_reminder', 'en', 'Hi {{1}}, this is a reminder for your vaccination on {{2}}. - {{3}}', 'approved', JSON.stringify(['Name', 'Date', 'Hospital Name']));
}
if (!db.prepare('SELECT 1 FROM contacts').get()) {
  const ins = db.prepare('INSERT INTO contacts(name,mobile,custom_fields) VALUES(?,?,?)');
  [['Rahul', '919876543210', '25-09-2026', 'Dr. Sharma', '10:00 AM'], ['Amit', '919876543211', '26-09-2026', 'Dr. Verma', '11:00 AM'], ['Neha', '919876543212', '27-09-2026', 'Dr. Singh', '12:00 PM'], ['Priya', '919876543213', '28-09-2026', 'Dr. Gupta', '10:00 AM']]
    .forEach(([n, m, d, doc, t]) => ins.run(n, m, JSON.stringify({ 'Appointment Date': d, Doctor: doc, Time: t })));
}
module.exports = { db, getSetting, setSetting };
