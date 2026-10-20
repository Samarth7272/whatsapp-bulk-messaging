require('dotenv').config();
const express = require('express'), cors = require('cors'), path = require('path'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), multer = require('multer'), XLSX = require('xlsx');
const { db, getSetting, setSetting } = require('./db');
const queue = require('./queue');
const wa = require('./whatsapp');
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const app = express();
app.use(cors()); app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../public')));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => res.status(400).json({ error: e.message }));
const auth = roles => (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  try { req.user = jwt.verify(t, SECRET); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (roles && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Admin access required' });
  next();
};
const A = auth(), ADMIN = auth(['admin']);
const sendXlsx = (res, rows, name) => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Data');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};
const normMobile = m => { let d = String(m || '').replace(/\D/g, ''); const cc = getSetting('country_code', '91'); if (d.length === 10) d = cc + d; return d.length >= 10 && d.length <= 15 ? d : null; };
const contactOut = c => ({ ...c, custom_fields: JSON.parse(c.custom_fields || '{}') });

// ---------- auth ----------
app.post('/api/login', wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  res.json({ token: jwt.sign(user, SECRET, { expiresIn: '12h' }), user });
}));
app.get('/api/me', A, (req, res) => res.json(req.user));

// ---------- stats ----------
app.get('/api/stats', A, (req, res) => {
  const c = db.prepare("SELECT COUNT(*) total, SUM(status IN ('sent','delivered','read')) sent, SUM(status IN ('delivered','read')) delivered, SUM(status='read') read, SUM(status='failed') failed FROM message_logs").get();
  const camps = db.prepare(`SELECT c.*, t.template_name, (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status IN ('sent','delivered','read')) sent,
    (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status IN ('delivered','read')) delivered, (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status='read') read,
    (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status='failed') failed FROM campaigns c LEFT JOIN templates t ON t.id=c.template_id ORDER BY c.id DESC LIMIT 10`).all();
  res.json({ contacts: db.prepare('SELECT COUNT(*) n FROM contacts').get().n, messages: c.sent || 0, delivered: c.delivered || 0, read: c.read || 0, failed: c.failed || 0, hospital: getSetting('hospital_name'), mock: wa.isMock(), campaigns: camps });
});

// ---------- contacts ----------
app.get('/api/contacts', A, (req, res) => {
  const q = `%${req.query.q || ''}%`, g = req.query.grp || '';
  const rows = db.prepare(`SELECT * FROM contacts WHERE (name LIKE ? OR mobile LIKE ?) ${g ? 'AND grp=?' : ''} ORDER BY id DESC LIMIT 2000`).all(...(g ? [q, q, g] : [q, q]));
  res.json(rows.map(contactOut));
});
app.get('/api/contacts/groups', A, (req, res) => res.json(db.prepare("SELECT DISTINCT grp FROM contacts WHERE grp!=''").all().map(r => r.grp)));
app.get('/api/contacts/columns', A, (req, res) => {
  const s = new Set(); db.prepare('SELECT custom_fields FROM contacts').all().forEach(r => Object.keys(JSON.parse(r.custom_fields)).forEach(k => s.add(k))); res.json([...s]);
});
app.post('/api/contacts', A, wrap((req, res) => {
  const m = normMobile(req.body.mobile); if (!m) throw new Error('Valid mobile number required');
  if (db.prepare('SELECT 1 FROM contacts WHERE mobile=?').get(m)) throw new Error('Mobile already exists');
  const r = db.prepare('INSERT INTO contacts(name,mobile,custom_fields,grp) VALUES(?,?,?,?)').run(req.body.name || '', m, JSON.stringify(req.body.custom_fields || {}), req.body.grp || '');
  res.json({ id: r.lastInsertRowid });
}));
app.put('/api/contacts/:id', A, wrap((req, res) => {
  const m = normMobile(req.body.mobile); if (!m) throw new Error('Valid mobile number required');
  db.prepare('UPDATE contacts SET name=?,mobile=?,custom_fields=?,grp=? WHERE id=?').run(req.body.name || '', m, JSON.stringify(req.body.custom_fields || {}), req.body.grp || '', req.params.id); res.json({ ok: true });
}));
app.delete('/api/contacts/:id', A, (req, res) => { db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id); res.json({ ok: true }); });
app.post('/api/contacts/bulk-delete', A, (req, res) => { const d = db.prepare('DELETE FROM contacts WHERE id=?'); db.transaction(ids => ids.forEach(i => d.run(i)))(req.body.ids || []); res.json({ ok: true }); });
app.post('/api/contacts/import', A, upload.single('file'), wrap((req, res) => {
  if (!req.file) throw new Error('Choose an Excel/CSV file');
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
  if (!rows.length) throw new Error('File is empty');
  const keys = Object.keys(rows[0]), find = re => keys.find(k => re.test(k.trim()));
  const mk = find(/^(mobile|phone|number|mobile ?no.*|contact)/i), nk = find(/^name$/i), gk = find(/^(group|tag)s?$/i);
  if (!mk) throw new Error('A "Mobile" column is required');
  const group = req.body.grp || '';
  let added = 0, updated = 0, skipped = 0;
  const find1 = db.prepare('SELECT id FROM contacts WHERE mobile=?'), ins = db.prepare('INSERT INTO contacts(name,mobile,custom_fields,grp) VALUES(?,?,?,?)'), upd = db.prepare('UPDATE contacts SET name=?,custom_fields=?,grp=COALESCE(NULLIF(?,\'\'),grp) WHERE id=?');
  db.transaction(() => rows.forEach(r => {
    const m = normMobile(r[mk]); if (!m) return skipped++;
    const cf = {}; keys.forEach(k => { if (k !== mk && k !== nk && k !== gk) cf[k.trim()] = String(r[k]).trim(); });
    const g = (gk ? String(r[gk]).trim() : '') || group, ex = find1.get(m), name = nk ? String(r[nk]).trim() : '';
    if (ex) { upd.run(name, JSON.stringify(cf), g, ex.id); updated++; } else { ins.run(name, m, JSON.stringify(cf), g); added++; }
  }))();
  res.json({ added, updated, skipped });
}));
app.get('/api/contacts/export', A, (req, res) => sendXlsx(res, db.prepare('SELECT * FROM contacts').all().map(c => ({ Name: c.name, Mobile: c.mobile, Group: c.grp, ...JSON.parse(c.custom_fields) })), 'contacts'));
app.get('/api/contacts/sample', A, (req, res) => sendXlsx(res, [
  { Name: 'Rahul', Mobile: '9876543210', 'Appointment Date': '25-09-2026', Doctor: 'Dr. Sharma', Time: '10:00 AM' }, { Name: 'Amit', Mobile: '9876543211', 'Appointment Date': '26-09-2026', Doctor: 'Dr. Verma', Time: '11:00 AM' },
  { Name: 'Neha', Mobile: '9876543212', 'Appointment Date': '27-09-2026', Doctor: 'Dr. Singh', Time: '12:00 PM' }, { Name: 'Priya', Mobile: '9876543213', 'Appointment Date': '28-09-2026', Doctor: 'Dr. Gupta', Time: '10:00 AM' }], 'sample_contacts'));

// ---------- templates ----------
const tplOut = t => ({ ...t, variables: JSON.parse(t.variables || '[]') });
const varCount = b => Math.max(0, ...[...String(b).matchAll(/\{\{(\d+)\}\}/g)].map(m => +m[1]));
app.get('/api/templates', A, (req, res) => res.json(db.prepare('SELECT * FROM templates ORDER BY id DESC').all().map(tplOut)));
const saveTpl = (req, id) => {
  const b = req.body; if (!b.template_name || !b.body) throw new Error('Name and body are required');
  const n = varCount(b.body), labels = Array.from({ length: n }, (_, i) => (b.variables || [])[i] || 'Variable ' + (i + 1));
  const name = b.template_name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (id) db.prepare('UPDATE templates SET template_name=?,language=?,body=?,status=?,variables=? WHERE id=?').run(name, b.language || 'en', b.body, b.status || 'approved', JSON.stringify(labels), id);
  else db.prepare('INSERT INTO templates(template_name,language,body,status,variables) VALUES(?,?,?,?,?)').run(name, b.language || 'en', b.body, b.status || 'approved', JSON.stringify(labels));
};
app.post('/api/templates', A, wrap((req, res) => { saveTpl(req); res.json({ ok: true }); }));
app.put('/api/templates/:id', A, wrap((req, res) => { saveTpl(req, req.params.id); res.json({ ok: true }); }));
app.delete('/api/templates/:id', A, wrap((req, res) => {
  if (db.prepare('SELECT 1 FROM campaigns WHERE template_id=?').get(req.params.id)) throw new Error('Template is used by a campaign');
  db.prepare('DELETE FROM templates WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

// ---------- campaigns ----------
const resolveVar = (src, c, cf, hospital) => {
  if (src === '@hospital') return hospital; if (String(src).startsWith('=')) return src.slice(1);
  if (src === 'name') return c.name || ''; if (src === 'mobile') return c.mobile; return cf[src] || '';
};
app.post('/api/campaigns', A, wrap((req, res) => {
  const { name, template_id, variable_map = [], grp = '', scheduled_at } = req.body;
  const t = db.prepare('SELECT * FROM templates WHERE id=?').get(template_id);
  if (!name) throw new Error('Campaign name required'); if (!t) throw new Error('Select a template');
  if (t.status !== 'approved') throw new Error('Only approved templates can be used');
  const n = JSON.parse(t.variables).length; if (variable_map.length < n || variable_map.slice(0, n).some(v => !v)) throw new Error('Map every template variable');
  const contacts = db.prepare(`SELECT * FROM contacts ${grp ? 'WHERE grp=?' : ''}`).all(...(grp ? [grp] : []));
  if (!contacts.length) throw new Error('No contacts to send to');
  let when = null; if (scheduled_at) { when = new Date(scheduled_at); if (isNaN(when) || when < new Date(Date.now() - 60000)) throw new Error('Schedule time must be in the future'); when = when.toISOString(); }
  const hospital = getSetting('hospital_name'); let id;
  db.transaction(() => {
    id = db.prepare('INSERT INTO campaigns(name,template_id,total_count,status,scheduled_at,grp,variable_map,created_by) VALUES(?,?,?,?,?,?,?,?)').run(name, t.id, contacts.length, when ? 'scheduled' : 'sending', when, grp, JSON.stringify(variable_map), req.user.email).lastInsertRowid;
    const ins = db.prepare('INSERT INTO message_logs(campaign_id,mobile,name,payload) VALUES(?,?,?,?)');
    contacts.forEach(c => { const cf = JSON.parse(c.custom_fields); ins.run(id, c.mobile, c.name, JSON.stringify(variable_map.slice(0, n).map(s => resolveVar(s, c, cf, hospital)))); });
  })();
  if (!when) queue.runCampaign(id);
  res.json({ id, total: contacts.length });
}));
app.get('/api/campaigns', A, (req, res) => {
  const where = req.query.status ? 'WHERE c.status=?' : '';
  res.json(db.prepare(`SELECT c.*, t.template_name, (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status IN ('sent','delivered','read')) sent,
   (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status IN ('delivered','read')) delivered, (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status='read') read,
   (SELECT COUNT(*) FROM message_logs WHERE campaign_id=c.id AND status='failed') failed FROM campaigns c LEFT JOIN templates t ON t.id=c.template_id ${where} ORDER BY c.id DESC`).all(...(req.query.status ? [req.query.status] : [])));
});
app.post('/api/campaigns/:id/cancel', A, wrap((req, res) => {
  db.prepare("UPDATE campaigns SET status='cancelled' WHERE id=? AND status IN ('scheduled','sending')").run(req.params.id); res.json({ ok: true });
}));
app.get('/api/campaigns/:id/logs', A, (req, res) => res.json(db.prepare('SELECT * FROM message_logs WHERE campaign_id=? ORDER BY id LIMIT 5000').all(req.params.id)));
app.get('/api/campaigns/:id/export', A, (req, res) => {
  const c = db.prepare('SELECT name FROM campaigns WHERE id=?').get(req.params.id) || { name: 'campaign' };
  sendXlsx(res, db.prepare('SELECT name Name, mobile Mobile, status Status, error Error, whatsapp_message_id MessageID, updated_at Updated FROM message_logs WHERE campaign_id=?').all(req.params.id), 'report_' + c.name.replace(/\W+/g, '_'));
});

// ---------- settings & users (admin) ----------
const SKEYS = ['hospital_name', 'country_code', 'wa_token', 'wa_phone_number_id', 'wa_api_version', 'verify_token', 'mock_mode', 'rate_per_second'];
app.get('/api/settings', ADMIN, (req, res) => { const o = {}; SKEYS.forEach(k => o[k] = getSetting(k)); if (o.wa_token) o.wa_token = '••••••••'; res.json(o); });
app.put('/api/settings', ADMIN, wrap((req, res) => { SKEYS.forEach(k => { const v = req.body[k]; if (v === undefined || (k === 'wa_token' && String(v).startsWith('•'))) return; setSetting(k, v); }); res.json({ ok: true }); }));
app.get('/api/users', ADMIN, (req, res) => res.json(db.prepare('SELECT id,name,email,role FROM users').all()));
app.post('/api/users', ADMIN, wrap((req, res) => {
  const { name, email, password, role } = req.body; if (!email || !password || password.length < 6) throw new Error('Email and password (min 6 chars) required');
  db.prepare('INSERT INTO users(name,email,role,password_hash) VALUES(?,?,?,?)').run(name || '', email.trim().toLowerCase(), role === 'admin' ? 'admin' : 'staff', bcrypt.hashSync(password, 10)); res.json({ ok: true });
}));
app.delete('/api/users/:id', ADMIN, wrap((req, res) => { if (+req.params.id === req.user.id) throw new Error('You cannot delete yourself'); db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ ok: true }); }));

// ---------- Meta webhook (delivery/read receipts) ----------
app.get('/webhook', (req, res) => req.query['hub.verify_token'] === getSetting('verify_token') ? res.send(req.query['hub.challenge']) : res.sendStatus(403));
app.post('/webhook', (req, res) => {
  try { for (const e of req.body.entry || []) for (const ch of e.changes || []) for (const s of ch.value?.statuses || []) queue.updateStatus(s.id, s.status, s.errors?.[0]?.title); } catch (e) { console.error(e); }
  res.sendStatus(200);
});

app.use((req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`WhatsApp Bulk Messaging running on http://localhost:${PORT}`); queue.start(); });
