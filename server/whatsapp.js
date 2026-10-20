const { getSetting } = require('./db');
const isMock = () => getSetting('mock_mode') === 'true' || !getSetting('wa_token') || !getSetting('wa_phone_number_id');
async function sendTemplate(mobile, template, params) {
  if (isMock()) return { id: 'mock.' + Date.now() + Math.random().toString(36).slice(2, 8) };
  const url = `https://graph.facebook.com/${getSetting('wa_api_version', 'v20.0')}/${getSetting('wa_phone_number_id')}/messages`;
  const body = { messaging_product: 'whatsapp', to: mobile, type: 'template', template: { name: template.template_name, language: { code: template.language || 'en' } } };
  if (params.length) body.template.components = [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p || '-') })) }];
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + getSetting('wa_token'), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || 'WhatsApp API error ' + r.status);
  return { id: d.messages?.[0]?.id };
}
module.exports = { sendTemplate, isMock };
