const { useState, useEffect, useCallback } = React;
const html = htm.bind(React.createElement);
let token = localStorage.getItem('t') || '';
async function api(p, o = {}) {
  const h = { Authorization: 'Bearer ' + token }; let body = o.body;
  if (body && !(body instanceof FormData)) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const r = await fetch('/api' + p, { method: o.method || 'GET', headers: h, body });
  if (r.status === 401 && p !== '/login') { localStorage.removeItem('t'); location.reload(); }
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Request failed'); return d;
}
const dl = p => window.open('/api' + p + (p.includes('?') ? '&' : '?') + 'token=' + token);
const Pill = ({ s }) => html`<span class=${'pill ' + s}>${s}</span>`;
const fmt = d => d ? new Date(d.includes('Z') || d.includes('T') ? d : d.replace(' ', 'T') + 'Z').toLocaleString() : '-';
const render = (body, vals) => String(body || '').replace(/\{\{(\d+)\}\}/g, (m, i) => vals[i - 1] || m);
const useLoad = (fn, deps = [], poll = 0) => {
  const [d, setD] = useState(null); const load = useCallback(() => fn().then(setD).catch(() => {}), deps);
  useEffect(() => { load(); if (poll) { const i = setInterval(load, poll); return () => clearInterval(i); } }, [load]); return [d, load];
};

function Login({ onLogin }) {
  const [email, setEmail] = useState(''), [password, setPw] = useState(''), [err, setErr] = useState('');
  const go = async e => { e.preventDefault(); try { const d = await api('/login', { method: 'POST', body: { email, password } }); token = d.token; localStorage.setItem('t', token); onLogin(d.user); } catch (x) { setErr(x.message); } };
  return html`<form class="login" onSubmit=${go}><h2>🏥 WhatsApp Bulk Messaging</h2><label>Email</label><input value=${email} onInput=${e => setEmail(e.target.value)} placeholder="admin@hospital.com"/>
  <label>Password</label><input type="password" value=${password} onInput=${e => setPw(e.target.value)}/><div class="err">${err}</div><button style=${{ width: '100%' }}>Login</button></form>`;
}

function CampaignTable({ rows, onCancel, onOpen }) {
  return html`<table><thead><tr><th>#</th><th>Campaign Name</th><th>Template</th><th>Total</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Failed</th><th>Status</th><th></th></tr></thead><tbody>
  ${(rows || []).map((c, i) => html`<tr key=${c.id}><td>${c.id}</td><td>${c.name}</td><td>${c.template_name}</td><td>${c.total_count}</td><td>${c.sent}</td><td>${c.delivered}</td><td>${c.read}</td><td>${c.failed}</td><td><${Pill} s=${c.status}/></td>
  <td>${onOpen && html`<button class="sec" onClick=${() => onOpen(c)}>View</button> `}${onCancel && ['scheduled', 'sending'].includes(c.status) && html`<button class="red" onClick=${() => onCancel(c)}>Cancel</button>`}</td></tr>`)}
  ${rows && !rows.length && html`<tr><td colspan="10">No campaigns yet</td></tr>`}</tbody></table>`;
}

function Dashboard({ go }) {
  const [s] = useLoad(() => api('/stats'), [], 4000); if (!s) return 'Loading…';
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
  return html`<div><h2>Dashboard</h2>${s.mock && html`<div class="note">Test mode is ON – messages are simulated. Add your Meta credentials in Settings and turn off test mode to send real WhatsApp messages.</div>`}
  <div class="cards"><div class="card"><small>Total Contacts</small><b>${s.contacts}</b></div><div class="card c-blue"><small>Total Messages</small><b>${s.messages}</b></div>
  <div class="card c-green"><small>Delivered</small><b>${s.delivered}</b>${pct(s.delivered, s.messages)}%</div><div class="card c-blue"><small>Read</small><b>${s.read}</b>${pct(s.read, s.messages)}%</div>
  <div class="card c-red"><small>Failed</small><b>${s.failed}</b></div></div>
  <div class="box"><div class="row" style=${{ justifyContent: 'space-between' }}><b>Recent Campaigns</b><button onClick=${() => go('Campaigns')}>+ New Campaign</button></div><${CampaignTable} rows=${s.campaigns}/></div></div>`;
}

function ContactForm({ c, onDone }) {
  const [f, setF] = useState(c || { name: '', mobile: '', grp: '', custom_fields: {} }), [err, setErr] = useState('');
  const [cf, setCf] = useState(Object.entries(f.custom_fields || {}).map(([k, v]) => k + '=' + v).join('\n'));
  const save = async () => {
    const custom_fields = {}; cf.split('\n').forEach(l => { const i = l.indexOf('='); if (i > 0) custom_fields[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
    try { await api('/contacts' + (c ? '/' + c.id : ''), { method: c ? 'PUT' : 'POST', body: { ...f, custom_fields } }); onDone(); } catch (e) { setErr(e.message); }
  };
  return html`<div class="box"><b>${c ? 'Edit' : 'Add'} Contact</b><div class="grid2"><div><label>Name</label><input value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })}/>
  <label>Mobile (with country code or 10 digits)</label><input value=${f.mobile} onInput=${e => setF({ ...f, mobile: e.target.value })}/><label>Group / Tag (optional)</label><input value=${f.grp} onInput=${e => setF({ ...f, grp: e.target.value })}/></div>
  <div><label>Extra columns (one per line: Column=Value)</label><textarea rows="7" value=${cf} onInput=${e => setCf(e.target.value)} placeholder=${'Doctor=Dr. Sharma\nAppointment Date=25-09-2026\nTime=10:00 AM'}></textarea></div></div>
  <div class="err">${err}</div><button onClick=${save}>Save</button> <button class="sec" onClick=${() => onDone()}>Cancel</button></div>`;
}

function Contacts() {
  const [q, setQ] = useState(''), [grp, setGrp] = useState(''), [edit, setEdit] = useState(null), [msg, setMsg] = useState(''), [sel, setSel] = useState({}), [impGrp, setImpGrp] = useState('');
  const [rows, load] = useLoad(() => api(`/contacts?q=${encodeURIComponent(q)}&grp=${encodeURIComponent(grp)}`), [q, grp]);
  const [groups, loadG] = useLoad(() => api('/contacts/groups'), []);
  const imp = async e => { const fd = new FormData(); fd.append('file', e.target.files[0]); fd.append('grp', impGrp); e.target.value = ''; try { const r = await api('/contacts/import', { method: 'POST', body: fd }); setMsg(`Imported: ${r.added} added, ${r.updated} updated, ${r.skipped} skipped`); load(); loadG(); } catch (x) { setMsg('Error: ' + x.message); } };
  const ids = Object.keys(sel).filter(k => sel[k]);
  const del = async () => { if (confirm(`Delete ${ids.length} contact(s)?`)) { await api('/contacts/bulk-delete', { method: 'POST', body: { ids } }); setSel({}); load(); } };
  if (edit) return html`<${ContactForm} c=${edit.id ? edit : null} onDone=${() => { setEdit(null); load(); loadG(); }}/>`;
  return html`<div><h2>Contacts</h2><div class="box"><div class="row"><input placeholder="Search name / mobile" value=${q} onInput=${e => setQ(e.target.value)}/>
  <select value=${grp} onChange=${e => setGrp(e.target.value)}><option value="">All groups</option>${(groups || []).map(g => html`<option>${g}</option>`)}</select>
  <button onClick=${() => setEdit({})}>+ Add Contact</button><button class="sec" onClick=${() => dl('/contacts/export')}>Export Excel</button><button class="sec" onClick=${() => dl('/contacts/sample')}>Sample file</button>
  ${ids.length > 0 && html`<button class="red" onClick=${del}>Delete (${ids.length})</button>`}</div>
  <div class="row"><label>Import Excel/CSV into group (optional):</label><input placeholder="e.g. Diabetes patients" value=${impGrp} onInput=${e => setImpGrp(e.target.value)}/><input type="file" accept=".xlsx,.xls,.csv" onChange=${imp}/></div>
  <div class="${msg.startsWith('Error') ? 'err' : 'ok'}">${msg}</div>
  <table><thead><tr><th></th><th>Name</th><th>Mobile</th><th>Group</th><th>Other columns</th><th></th></tr></thead><tbody>
  ${(rows || []).map(c => html`<tr key=${c.id}><td><input type="checkbox" checked=${!!sel[c.id]} onChange=${e => setSel({ ...sel, [c.id]: e.target.checked })}/></td><td>${c.name}</td><td>${c.mobile}</td><td>${c.grp}</td>
  <td>${Object.entries(c.custom_fields).map(([k, v]) => k + ': ' + v).join(' | ')}</td><td><button class="sec" onClick=${() => setEdit(c)}>Edit</button></td></tr>`)}</tbody></table></div></div>`;
}

function Templates() {
  const [rows, load] = useLoad(() => api('/templates'), []); const [f, setF] = useState(null), [err, setErr] = useState('');
  const save = async () => { try { const body = { ...f, variables: typeof f.variables === 'string' ? f.variables.split(',').map(s => s.trim()) : f.variables }; await api('/templates' + (f.id ? '/' + f.id : ''), { method: f.id ? 'PUT' : 'POST', body }); setF(null); setErr(''); load(); } catch (e) { setErr(e.message); } };
  const del = async t => { if (confirm('Delete template?')) try { await api('/templates/' + t.id, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); } };
  return html`<div><h2>Templates</h2>${f ? html`<div class="box"><div class="grid2"><div><label>Template name (must match the approved name in Meta)</label><input value=${f.template_name} onInput=${e => setF({ ...f, template_name: e.target.value })}/>
  <label>Language code</label><input value=${f.language} onInput=${e => setF({ ...f, language: e.target.value })}/><label>Status</label><select value=${f.status} onChange=${e => setF({ ...f, status: e.target.value })}><option>approved</option><option>pending</option><option>rejected</option></select>
  <label>Body – use {{1}}, {{2}}… for variables</label><textarea rows="6" value=${f.body} onInput=${e => setF({ ...f, body: e.target.value })}></textarea>
  <label>Variable labels (comma separated, in order)</label><input value=${Array.isArray(f.variables) ? f.variables.join(', ') : f.variables} onInput=${e => setF({ ...f, variables: e.target.value })} placeholder="Name, Doctor Name, Appointment Date, Time, Hospital Name"/></div>
  <div><label>Preview</label><div class="wa">${f.body}</div></div></div><div class="err">${err}</div><button onClick=${save}>Save Template</button> <button class="sec" onClick=${() => setF(null)}>Cancel</button></div>`
    : html`<div class="box"><button onClick=${() => setF({ template_name: '', language: 'en', status: 'approved', body: '', variables: [] })}>+ New Template</button><br/><br/>
  <table><thead><tr><th>Name</th><th>Lang</th><th>Status</th><th>Variables</th><th>Body</th><th></th></tr></thead><tbody>${(rows || []).map(t => html`<tr key=${t.id}><td>${t.template_name}</td><td>${t.language}</td><td><${Pill} s=${t.status}/></td>
  <td>${t.variables.map((v, i) => `{{${i + 1}}} ${v}`).join(', ')}</td><td style=${{ whiteSpace: 'normal', maxWidth: '380px' }}>${t.body}</td><td><button class="sec" onClick=${() => setF(t)}>Edit</button> <button class="red" onClick=${() => del(t)}>Del</button></td></tr>`)}</tbody></table></div>`}</div>`;
}

function Campaigns({ go }) {
  const [list, load] = useLoad(() => api('/campaigns'), [], 4000); const [tpls] = useLoad(() => api('/templates'), []); const [cols] = useLoad(() => api('/contacts/columns'), []); const [groups] = useLoad(() => api('/contacts/groups'), []);
  const [f, setF] = useState(null), [err, setErr] = useState(''), [detail, setDetail] = useState(null), [logs, setLogs] = useState([]);
  const tpl = f && (tpls || []).find(t => t.id == f.template_id);
  const pick = id => { const t = (tpls || []).find(x => x.id == id); const map = (t ? t.variables : []).map(v => { const l = v.toLowerCase(); return l.includes('hospital') ? '@hospital' : l === 'name' ? 'name' : (cols || []).find(c => c.toLowerCase() === l || l.includes(c.toLowerCase())) || ''; }); setF({ ...f, template_id: id, variable_map: map }); };
  const create = async () => { try { const when = f.mode === 'later' && f.when ? new Date(f.when).toISOString() : undefined; const r = await api('/campaigns', { method: 'POST', body: { name: f.name, template_id: +f.template_id, variable_map: f.variable_map, grp: f.grp, scheduled_at: when } }); setF(null); setErr(''); alert(`Campaign ${when ? 'scheduled' : 'started'} for ${r.total} contacts`); load(); } catch (e) { setErr(e.message); } };
  const cancel = async c => { if (confirm('Cancel this campaign?')) { await api(`/campaigns/${c.id}/cancel`, { method: 'POST' }); load(); } };
  const open = async c => { setDetail(c); setLogs(await api(`/campaigns/${c.id}/logs`)); };
  if (detail) return html`<div><h2>Campaign: ${detail.name}</h2><div class="box"><button class="sec" onClick=${() => setDetail(null)}>← Back</button> <button onClick=${() => dl(`/campaigns/${detail.id}/export`)}>Export Report (Excel)</button><br/><br/>
  <table><thead><tr><th>Name</th><th>Mobile</th><th>Status</th><th>Error</th><th>Updated</th></tr></thead><tbody>${logs.map(l => html`<tr key=${l.id}><td>${l.name}</td><td>${l.mobile}</td><td><${Pill} s=${l.status}/></td><td>${l.error || ''}</td><td>${fmt(l.updated_at)}</td></tr>`)}</tbody></table></div></div>`;
  return html`<div><h2>Campaigns</h2>${f ? html`<div class="box"><b>New Campaign</b><div class="grid2"><div><label>Campaign name</label><input value=${f.name} onInput=${e => setF({ ...f, name: e.target.value })}/>
  <label>Template</label><select value=${f.template_id} onChange=${e => pick(e.target.value)}><option value="">-- select approved template --</option>${(tpls || []).filter(t => t.status === 'approved').map(t => html`<option value=${t.id}>${t.template_name}</option>`)}</select>
  <label>Send to</label><select value=${f.grp} onChange=${e => setF({ ...f, grp: e.target.value })}><option value="">All contacts</option>${(groups || []).map(g => html`<option>${g}</option>`)}</select>
  <label>When</label><select value=${f.mode} onChange=${e => setF({ ...f, mode: e.target.value })}><option value="now">Send now</option><option value="later">Schedule (date & time)</option></select>
  ${f.mode === 'later' && html`<input type="datetime-local" value=${f.when} onInput=${e => setF({ ...f, when: e.target.value })}/>`}</div>
  <div>${tpl && html`<label>Fill variables (from Excel columns)</label>${tpl.variables.map((v, i) => html`<div class="row"><span style=${{ width: '150px' }}>{{${i + 1}}} ${v}</span><select value=${f.variable_map[i] || ''} onChange=${e => { const m = [...f.variable_map]; m[i] = e.target.value.startsWith('=') && e.target.value === '=' ? '=' + (prompt('Fixed text') || '') : e.target.value; setF({ ...f, variable_map: m }); }}>
  <option value="">-- choose --</option><option value="name">Contact Name</option><option value="mobile">Mobile</option><option value="@hospital">Hospital Name (Settings)</option>${(cols || []).map(c => html`<option value=${c}>${c}</option>`)}<option value="=">Fixed text…</option>${(f.variable_map[i] || '').startsWith('=') && f.variable_map[i].length > 1 ? html`<option value=${f.variable_map[i]}>${f.variable_map[i]}</option>` : ''}</select></div>`)}
  <label>Preview</label><div class="wa">${render(tpl.body, f.variable_map.map(m => m === 'name' ? '[Name]' : m === '@hospital' ? '[Hospital]' : (m || '').startsWith('=') ? m.slice(1) : m ? '[' + m + ']' : ''))}</div>`}</div></div>
  <div class="err">${err}</div><button onClick=${create}>${f.mode === 'later' ? 'Schedule Campaign' : 'Send Now'}</button> <button class="sec" onClick=${() => setF(null)}>Cancel</button></div>`
    : html`<div class="box"><button onClick=${() => setF({ name: '', template_id: '', grp: '', mode: 'now', when: '', variable_map: [] })}>+ New Campaign</button><br/><br/><${CampaignTable} rows=${list} onCancel=${cancel} onOpen=${open}/></div>`}</div>`;
}

function Scheduled() {
  const [list, load] = useLoad(() => api('/campaigns?status=scheduled'), [], 5000);
  const cancel = async c => { if (confirm('Cancel scheduled campaign?')) { await api(`/campaigns/${c.id}/cancel`, { method: 'POST' }); load(); } };
  return html`<div><h2>Scheduled Messages</h2><div class="box"><table><thead><tr><th>#</th><th>Campaign</th><th>Template</th><th>Contacts</th><th>Scheduled for</th><th></th></tr></thead><tbody>
  ${(list || []).map(c => html`<tr key=${c.id}><td>${c.id}</td><td>${c.name}</td><td>${c.template_name}</td><td>${c.total_count}</td><td>${fmt(c.scheduled_at)}</td><td><button class="red" onClick=${() => cancel(c)}>Cancel</button></td></tr>`)}
  ${list && !list.length && html`<tr><td colspan="6">Nothing scheduled</td></tr>`}</tbody></table></div></div>`;
}

function Reports() {
  const [list] = useLoad(() => api('/campaigns'), [], 5000); const [sel, setSel] = useState(null), [logs, setLogs] = useState([]);
  const open = async c => { setSel(c); setLogs(await api(`/campaigns/${c.id}/logs`)); };
  return html`<div><h2>Reports</h2><div class="box"><b>Campaign reports</b><br/><br/><table><thead><tr><th>Campaign</th><th>Total</th><th>Delivered</th><th>Read</th><th>Failed</th><th>Status</th><th></th></tr></thead><tbody>
  ${(list || []).map(c => html`<tr key=${c.id}><td>${c.name}</td><td>${c.total_count}</td><td>${c.delivered} (${c.total_count ? Math.round(c.delivered * 100 / c.total_count) : 0}%)</td><td>${c.read}</td><td>${c.failed}</td><td><${Pill} s=${c.status}/></td>
  <td><button class="sec" onClick=${() => open(c)}>Details</button> <button onClick=${() => dl(`/campaigns/${c.id}/export`)}>Excel</button></td></tr>`)}</tbody></table></div>
  ${sel && html`<div class="box"><b>${sel.name} – message log</b><br/><br/><table><thead><tr><th>Name</th><th>Mobile</th><th>Status</th><th>Error</th></tr></thead><tbody>${logs.map(l => html`<tr key=${l.id}><td>${l.name}</td><td>${l.mobile}</td><td><${Pill} s=${l.status}/></td><td>${l.error || ''}</td></tr>`)}</tbody></table></div>`}</div>`;
}

function Settings({ me }) {
  const [s, setS] = useState(null), [msg, setMsg] = useState(''); const [users, loadU] = useLoad(() => api('/users'), []); const [u, setU] = useState({ name: '', email: '', password: '', role: 'staff' });
  useEffect(() => { api('/settings').then(setS); }, []);
  const save = async () => { try { await api('/settings', { method: 'PUT', body: s }); setMsg('Saved ✔'); } catch (e) { setMsg('Error: ' + e.message); } };
  const addU = async () => { try { await api('/users', { method: 'POST', body: u }); setU({ name: '', email: '', password: '', role: 'staff' }); loadU(); } catch (e) { alert(e.message); } };
  const delU = async x => { if (confirm('Delete user?')) try { await api('/users/' + x.id, { method: 'DELETE' }); loadU(); } catch (e) { alert(e.message); } };
  if (!s) return 'Loading…'; const set = k => e => setS({ ...s, [k]: e.target.value });
  return html`<div><h2>Settings</h2><div class="grid2"><div class="box"><b>Hospital & WhatsApp API</b><br/><br/><label>Hospital name</label><input value=${s.hospital_name} onInput=${set('hospital_name')}/>
  <label>Default country code (for 10-digit numbers)</label><input value=${s.country_code} onInput=${set('country_code')}/><label>Test mode (simulate sending, no real messages)</label><select value=${s.mock_mode} onChange=${set('mock_mode')}><option value="true">ON – simulate</option><option value="false">OFF – send via Meta WhatsApp Cloud API</option></select>
  <label>Meta access token</label><input type="password" value=${s.wa_token} onInput=${set('wa_token')}/><label>Phone number ID</label><input value=${s.wa_phone_number_id} onInput=${set('wa_phone_number_id')}/>
  <label>API version</label><input value=${s.wa_api_version} onInput=${set('wa_api_version')}/><label>Webhook verify token (URL: /webhook)</label><input value=${s.verify_token} onInput=${set('verify_token')}/>
  <label>Messages per second</label><input value=${s.rate_per_second} onInput=${set('rate_per_second')}/><button onClick=${save}>Save Settings</button> <span class="ok">${msg}</span></div>
  <div class="box"><b>Hospital staff login (roles)</b><br/><br/><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${(users || []).map(x => html`<tr key=${x.id}><td>${x.name}</td><td>${x.email}</td><td>${x.role}</td><td>${x.id !== me.id && html`<button class="red" onClick=${() => delU(x)}>Del</button>`}</td></tr>`)}</tbody></table><br/>
  <label>Name</label><input value=${u.name} onInput=${e => setU({ ...u, name: e.target.value })}/><label>Email</label><input value=${u.email} onInput=${e => setU({ ...u, email: e.target.value })}/><label>Password</label><input type="password" value=${u.password} onInput=${e => setU({ ...u, password: e.target.value })}/>
  <label>Role</label><select value=${u.role} onChange=${e => setU({ ...u, role: e.target.value })}><option value="staff">Staff (no Settings access)</option><option value="admin">Admin</option></select><button onClick=${addU}>Add User</button></div></div></div>`;
}

const MENU = [['Dashboard', '🏠'], ['Contacts', '👥'], ['Templates', '📄'], ['Campaigns', '📨'], ['Scheduled Messages', '🗓️'], ['Reports', '📊'], ['Settings', '⚙️']];
function App() {
  const [me, setMe] = useState(null), [ready, setReady] = useState(!token), [page, setPage] = useState('Dashboard');
  useEffect(() => { if (token) api('/me').then(setMe).catch(() => {}).finally(() => setReady(true)); }, []);
  if (!ready) return 'Loading…'; if (!me) return html`<${Login} onLogin=${setMe}/>`;
  const P = { Dashboard, Contacts, Templates, Campaigns, 'Scheduled Messages': Scheduled, Reports, Settings }[page];
  const menu = MENU.filter(m => m[0] !== 'Settings' || me.role === 'admin');
  return html`<div class="layout"><div class="side"><h3>Main Modules</h3>${menu.map(([n, i]) => html`<a class=${page === n ? 'on' : ''} onClick=${() => setPage(n)}>${i} <span>${n}</span></a>`)}</div>
  <div class="main"><div class="top"><b>🏥 WhatsApp Bulk Messaging System</b><span>${me.name || me.email} (${me.role}) <button class="sec" onClick=${() => { localStorage.removeItem('t'); location.reload(); }}>Logout</button></span></div>
  <div class="content"><${P} go=${setPage} me=${me}/></div></div></div>`;
}
ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
