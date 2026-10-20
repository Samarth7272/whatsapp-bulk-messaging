// In-process queue: rate limiting, retries, resume-on-restart, scheduler.
// (Swap for Redis + BullMQ when scaling to multiple servers.)
const { db, getSetting } = require('./db');
const wa = require('./whatsapp');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const running = new Set();
const RANK = { pending: 0, sent: 1, delivered: 2, read: 3 };

function updateStatus(waId, status, error) {
  const m = db.prepare('SELECT id,status FROM message_logs WHERE whatsapp_message_id=?').get(waId);
  if (!m) return;
  if (status !== 'failed' && (RANK[status] ?? -1) <= (RANK[m.status] ?? 9)) return;
  db.prepare('UPDATE message_logs SET status=?, error=COALESCE(?,error), updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, error || null, m.id);
}
function simulate(id) {
  setTimeout(() => updateStatus(id, 'delivered'), 1000 + Math.random() * 2000);
  if (Math.random() < 0.85) setTimeout(() => updateStatus(id, 'read'), 4000 + Math.random() * 6000);
}
async function runCampaign(id) {
  if (running.has(id)) return;
  running.add(id);
  try {
    const c = db.prepare('SELECT * FROM campaigns WHERE id=?').get(id);
    const t = db.prepare('SELECT * FROM templates WHERE id=?').get(c.template_id);
    db.prepare("UPDATE campaigns SET status='sending' WHERE id=?").run(id);
    while (true) {
      if (db.prepare('SELECT status FROM campaigns WHERE id=?').get(id).status === 'cancelled') return;
      const m = db.prepare("SELECT * FROM message_logs WHERE campaign_id=? AND status='pending' LIMIT 1").get(id);
      if (!m) break;
      let ok = false, err = '';
      for (let a = 0; a < 3 && !ok; a++) {
        try {
          const r = await wa.sendTemplate(m.mobile, t, JSON.parse(m.payload));
          db.prepare("UPDATE message_logs SET status='sent', whatsapp_message_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(r.id, m.id);
          ok = true; if (wa.isMock()) simulate(r.id);
        } catch (e) { err = e.message; await sleep(800 * (a + 1)); }
      }
      if (!ok) db.prepare("UPDATE message_logs SET status='failed', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(err, m.id);
      await sleep(1000 / (parseInt(getSetting('rate_per_second', 20)) || 20));
    }
    db.prepare("UPDATE campaigns SET status='completed' WHERE id=?").run(id);
  } catch (e) { console.error('Campaign error', e); db.prepare("UPDATE campaigns SET status='failed' WHERE id=?").run(id); }
  finally { running.delete(id); }
}
function start() {
  db.prepare("SELECT id FROM campaigns WHERE status='sending'").all().forEach(c => runCampaign(c.id));
  setInterval(() => {
    db.prepare("SELECT id FROM campaigns WHERE status='scheduled' AND scheduled_at<=?").all(new Date().toISOString()).forEach(c => runCampaign(c.id));
  }, 10000);
}
module.exports = { runCampaign, updateStatus, start };
