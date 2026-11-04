// Portail SafeLink Auto-Pilot — console d'exploitation locale.
// GET /            dashboard (services + routeur live + stock + workflows/bot + base)
// GET /api/status  JSON equivalent machine
// POST /api/n8n/callback  retour n8n : HMAC-SHA256 du corps brut + idempotence runId.
const http = require('http');
const net = require('net');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROUTEROS_URL = (process.env.ROUTEROS_URL || 'http://127.0.0.1:9185').replace(/\/+$/, '');
const ROUTEROS_USER = process.env.ROUTEROS_USER || 'app-audit';
const ROUTEROS_PASS = process.env.ROUTEROS_PASS || ''; // lecture seule : compte audit uniquement
const MIKHMON_URL = (process.env.MIKHMON_URL || 'http://127.0.0.1:8088/?session=SafeLinkHub').replace(/\/+$/, '');
const WEBFIG_URL = (process.env.WEBFIG_URL || 'http://127.0.0.1:9185');
const N8N_URL = (process.env.N8N_BASE_URL || 'http://localhost:5678').replace(/\/+$/, '');
const N8N_WEBHOOK = (process.env.N8N_PUBLIC_WEBHOOK || 'https://val-undelusive-revulsively.ngrok-free.dev/webhook/1lTlAZ0JsMD2YN6v/demarrer/tg-safelink-8f3k9d');
const CALLBACK_SECRET = process.env.N8N_CALLBACK_SECRET || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PG_HOST = process.env.POSTGRES_HOST || '127.0.0.1';
const PG_PORT = Number(process.env.POSTGRES_PORT || 5433);
const PAID_PROFILES = ['03-JOURS', '01-SEMAINE', '01-MOIS'];
const THRESHOLD = 50;

const seenRunIds = new Set(); // idempotence (memoire du processus)
const internal = u => String(u).replace('127.0.0.1', 'host.docker.internal').replace('localhost', 'host.docker.internal');
const authH = () => ({ Authorization: 'Basic ' + Buffer.from(ROUTEROS_USER + ':' + ROUTEROS_PASS).toString('base64'), Accept: 'application/json' });

async function fetchJson(url, ms, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: headers || {} });
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    return { ok: r.ok, status: r.status, data: data };
  } finally { clearTimeout(t); }
}

async function serviceOk(url, ms) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms || 6000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, redirect: 'manual' });
      return { ok: r.status < 500, detail: 'HTTP ' + r.status };
    } finally { clearTimeout(t); }
  } catch (e) { return { ok: false, detail: String((e && e.message) || e).slice(0, 80) }; }
}

function dbStatus() {
  return new Promise(resolve => {
    const s = net.connect({ host: internal(PG_HOST), port: PG_PORT, timeout: 5000 });
    s.on('connect', () => { s.end(); resolve({ ok: true, detail: PG_HOST + ':' + PG_PORT + ' — agent_ro (SELECT seul)' }); });
    s.on('timeout', () => { s.destroy(); resolve({ ok: false, detail: 'timeout ' + PG_PORT }); });
    s.on('error', e => resolve({ ok: false, detail: String((e && e.message) || e).slice(0, 60) }));
  });
}

async function botStatus() {
  if (!BOT_TOKEN) return { ok: false, detail: 'token absent' };
  try {
    const r = await fetchJson('https://api.telegram.org/bot' + BOT_TOKEN + '/getMe', 8000);
    if (!r.ok || !r.data || r.data.ok !== true) return { ok: false, detail: 'HTTP ' + r.status };
    return { ok: true, detail: '@' + r.data.result.username };
  } catch (e) { return { ok: false, detail: String((e && e.message) || e).slice(0, 60) }; }
}

async function collect() {
  const H = authH();
  const base = internal(ROUTEROS_URL);
  const [sys, users, active, mikhmon, webfig, n8n, db, bot] = await Promise.all([
    fetchJson(base + '/rest/system/resource', 8000, H),
    fetchJson(base + '/rest/ip/hotspot/user', 15000, H),
    fetchJson(base + '/rest/ip/hotspot/active', 8000, H),
    serviceOk(internal(MIKHMON_URL)),
    serviceOk(internal(WEBFIG_URL)),
    serviceOk(internal(N8N_URL) + '/healthz'),
    dbStatus(),
    botStatus()
  ]);
  let router = { ok: false, detail: 'HTTP ' + (sys && sys.status) };
  let live = null;
  if (sys.ok) {
    const d = Array.isArray(sys.data) ? sys.data[0] : sys.data;
    router = { ok: true, detail: (d['board-name'] || 'RouterOS') + ' ' + (d.version || '') };
    live = {
      cpu: d['cpu-load'], memFree: d['free-memory'], memTotal: d['total-memory'],
      uptime: d.uptime,
      users: Array.isArray(users.data) ? users.data.length : null,
      actifs: Array.isArray(active.data) ? active.data.length : null
    };
  }
  let stock = { error: 'HTTP ' + (users && users.status) };
  if (Array.isArray(users.data)) {
    stock = {};
    for (const p of PAID_PROFILES) {
      stock[p] = users.data.filter(u => u.profile === p && u.disabled !== true && u.disabled !== 'true'
        && (u.uptime === '0s' || u.uptime === '00:00:00')).length;
    }
  }
  return { threshold: THRESHOLD, router: router, live: live, mikhmon: mikhmon, webfig: webfig, n8n: n8n, db: db, bot: bot, stock: stock };
}

function pill(ok, label) {
  return '<span class="pill ' + (ok === true ? 'on' : ok === false ? 'off' : 'na') + '">' + label + '</span>';
}

function page(st) {
  const stockRows = PAID_PROFILES.map(p => {
    const n = (st.stock && typeof st.stock[p] === 'number') ? st.stock[p] : null;
    const low = n !== null && n < THRESHOLD;
    return '<tr><td>' + p + '</td><td class="num">' + (n === null ? '?' : n) + '</td><td>'
      + (n === null ? pill(null, 'INCONNU') : low ? pill(false, 'SEUIL < ' + THRESHOLD) : pill(true, 'STOCK OK')) + '</td></tr>';
  }).join('');
  const live = st.live
    ? '<div class="kv"><span>Charge CPU</span><b>' + st.live.cpu + ' %</b></div>'
    + '<div class="kv"><span>Mémoire libre</span><b>' + st.live.memFree + ' / ' + st.live.memTotal + '</b></div>'
    + '<div class="kv"><span>Uptime</span><b>' + st.live.uptime + '</b></div>'
    + '<div class="kv"><span>Comptes hotspot</span><b>' + st.live.users + ' (actifs : ' + st.live.actifs + ')</b></div>'
    : '<div class="det">Routeur injoignable.</div>';
  const svc = (name, url, s) => '<div class="svc"><div><b>' + name + '</b><br><a href="' + url + '">' + url + '</a>'
    + '<div class="det">' + ((s && s.detail) || '') + '</div></div>' + pill(s && s.ok, (s && s.ok) ? 'EN LIGNE' : 'HORS LIGNE') + '</div>';
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>SafeLink Auto-Pilot — Console</title><style>'
    + ':root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--txt:#e6edf3;--dim:#8b949e;--ok:#3fb950;--warn:#d29922;--bad:#f85149;--acc:#58a6ff}'
    + '*{box-sizing:border-box}body{background:var(--bg);color:var(--txt);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin:0;padding:28px 18px}'
    + '.wrap{max-width:980px;margin:0 auto}h1{font-size:21px;margin:0}.sub{color:var(--dim);font-size:12px;margin:6px 0 20px}'
    + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:680px){.grid{grid-template-columns:1fr}}'
    + '.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}'
    + '.card h2{font-size:12px;color:var(--dim);margin:0 0 10px;letter-spacing:.08em}'
    + '.svc{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line)}'
    + 'a{color:var(--acc);text-decoration:none;font-size:12px;word-break:break-all}.det{color:var(--dim);font-size:11px;margin-top:2px}'
    + '.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap}'
    + '.on{background:rgba(63,185,80,.15);color:var(--ok);border:1px solid var(--ok)}'
    + '.off{background:rgba(248,81,73,.12);color:var(--bad);border:1px solid var(--bad)}'
    + '.warn{background:rgba(210,153,34,.12);color:var(--warn);border:1px solid var(--warn)}'
    + '.na{background:transparent;color:var(--dim);border:1px solid var(--dim)}'
    + 'table{width:100%;border-collapse:collapse;font-size:13px}td{padding:7px 4px;border-top:1px solid var(--line)}'
    + '.num{text-align:right;font-variant-numeric:tabular-nums}'
    + '.kv{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid var(--line);font-size:13px}'
    + '.kv span{color:var(--dim)}.code{font-size:11px;color:var(--dim);word-break:break-all;margin-top:8px}'
    + '.foot{color:var(--dim);font-size:11px;margin-top:20px}.foot b{color:var(--txt)}'
    + '</style></head><body><div class="wrap">'
    + '<h1>&#9646; SafeLink Auto-Pilot</h1>'
    + '<div class="sub">Console d\u2019exploitation — tickets hotspot Mikhmon / MikroTik / n8n — seuil ' + THRESHOLD + ' par profil</div>'
    + '<div class="grid">'
    + '<div class="card"><h2>SERVICES (FRONTEND)</h2>'
    + svc('Mikhmon (vouchers)', MIKHMON_URL, st.mikhmon)
    + svc('WebFig routeur', WEBFIG_URL, st.webfig)
    + svc('n8n workflows', N8N_URL, st.n8n)
    + '</div>'
    + '<div class="card"><h2>BASE POSTGRESQL (BACKEND)</h2>'
    + '<div class="svc"><div><b>autopilot</b><div class="det">' + ((st.db && st.db.detail) || '') + '</div></div>'
    + pill(st.db && st.db.ok, (st.db && st.db.ok) ? 'OUVERTE' : 'FERMÉE') + '</div>'
    + '<div class="det">Accès agent : agent_ro, SELECT seul. L\u2019application n\u2019écrit jamais via ce compte.</div>'
    + '</div>'
    + '<div class="card"><h2>ROUTEUR LIVE (BACKEND)</h2>' + live + '</div>'
    + '<div class="card"><h2>STOCK TICKETS NEUFS / PROFIL</h2><table>' + stockRows + '</table>'
    + '<div class="det">Neuf = jamais utilisé (uptime 0s), actif. Profils payants uniquement, default exclu.</div></div>'
    + '<div class="card"><h2>BOT TELEGRAM + WORKFLOWS</h2>'
    + '<div class="svc"><div><b>Bot tickets</b><div class="det">' + ((st.bot && st.bot.detail) || '') + '</div></div>'
    + pill(st.bot && st.bot.ok, (st.bot && st.bot.ok) ? 'ACTIF' : 'INACTIF') + '</div>'
    + '<div class="det">Commande : <b>/tickets</b> → profil → <b>120 / 240 / 480 / 500</b> → PDF auto. Format <b>identifiant = mot de passe</b> (préfixe + 8 car. [a-z0-9]). slh-paiement exclu.</div>'
    + '<div class="code">Webhook n8n : ' + N8N_WEBHOOK + '</div>'
    + '<div class="code">Retours n8n → ce portail : /api/n8n/callback (HMAC, idempotent).</div>'
    + '</div>'
    + '<div class="card"><h2>LIENS EXPLOITATION</h2>'
    + '<div class="kv"><span>Mikhmon vouchers</span><a href="' + MIKHMON_URL + '">ouvrir</a></div>'
    + '<div class="kv"><span>WebFig</span><a href="' + WEBFIG_URL + '">ouvrir</a></div>'
    + '<div class="kv"><span>n8n éditeur</span><a href="' + N8N_URL + '">ouvrir</a></div>'
    + '</div>'
    + '</div>'
    + '<div class="foot">APP_URL = ce portail. L\u2019application déployée ne dépend que d\u2019elle-même, de PostgreSQL et de l\u2019API REST du routeur.</div>'
    + '</div></body></html>';
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/api/status')) {
    const st = await collect();
    if (u.pathname === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Object.assign({ ok: true }, st)));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page(st));
    }
    return;
  }
  if (req.method === 'POST' && u.pathname === '/api/n8n/callback') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if (!CALLBACK_SECRET) { res.writeHead(500); res.end('callback secret missing'); return; }
      const sig = req.headers['x-signature'] || '';
      const expect = crypto.createHmac('sha256', CALLBACK_SECRET).update(raw).digest('hex');
      if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
        res.writeHead(401); res.end('bad signature'); return;
      }
      let body = {};
      try { body = raw.length ? JSON.parse(raw.toString('utf8')) : null; } catch (e) { res.writeHead(400); res.end('bad json'); return; }
      const runId = String((body && (body.runId || body.executionId)) || '');
      if (runId && seenRunIds.has(runId)) { res.writeHead(200); res.end('duplicate'); return; }
      if (runId) seenRunIds.add(runId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => console.log('SafeLink Auto-Pilot sur :' + PORT));
