const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

loadEnv();
const root = path.resolve(__dirname);
const publicRoot = path.join(root, 'public');
const port = Number(process.env.PORT) || 5173;
const token = process.env.GITHUB_TOKEN || '';
const cache = new Map();
const staticFiles = new Set(['index.html', 'styles.css', 'theme.css', 'accessibility.css', 'api.js', 'charts.js', 'ui.js', 'app.js', 'favicon.svg']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://avatars.githubusercontent.com data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !Object.hasOwn(process.env, match[1])) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}
function validUser(value) { return typeof value === 'string' && value.length <= 39 && /^[A-Za-z0-9-]+$/.test(value) && !value.startsWith('-') && !value.endsWith('-') && !value.includes('--'); }

async function proxyRest(req, res, url, apiPath, ttl) {
  const key = `rest:${apiPath}`;
  const current = cache.get(key);
  if (current && current.until > Date.now()) return send(res, 200, current.body, { 'X-Cache': 'HIT', ...(current.etag ? { ETag: current.etag } : {}) });
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'GitHub-Developer-Analytics' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (current?.etag) headers['If-None-Match'] = current.etag;
  try {
    const upstream = await fetch(`https://api.github.com${apiPath}`, { headers });
    const extra = { 'X-Cache': 'MISS' };
    for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'etag', 'link']) {
      const value = upstream.headers.get(name); if (value) extra[name] = value;
    }
    if (upstream.status === 304 && current) {
      current.until = Date.now() + ttl;
      return send(res, 200, current.body, { ...extra, 'X-Cache': 'REVALIDATED', ...(current.etag ? { ETag: current.etag } : {}) });
    }
    const body = await upstream.json().catch(() => ({}));
    if (upstream.ok) cache.set(key, { body, etag: upstream.headers.get('etag'), until: Date.now() + ttl });
    return send(res, upstream.status, body, extra);
  } catch {
    if (current) return send(res, 200, current.body, { 'X-Cache': 'STALE' });
    return send(res, 502, { message: 'Unable to reach GitHub. Check the server connection and try again.' });
  }
}

async function proxyGraphql(res, username) {
  if (!token) return proxyPublicEventsCalendar(res, username);
  const key = `graphql:${username}`;
  const current = cache.get(key);
  if (current && current.until > Date.now()) return send(res, 200, current.body, { 'X-Cache': 'HIT' });
  try {
    const response = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'GitHub-Developer-Analytics' }, body: JSON.stringify({ query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount date}}}}}}`, variables: { login: username } }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors) {
      const message = body.errors?.[0]?.message || 'GitHub GraphQL request failed.';
      const status = response.status !== 200 ? response.status : (/rate limit/i.test(message) ? 429 : 502);
      const reset = response.headers.get('x-ratelimit-reset');
      return send(res, status, { message }, reset ? { 'x-ratelimit-reset': reset } : {});
    }
    const calendar = body.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) return send(res, 404, { message: 'Contribution history is not available for this profile.' });
    const result = { totalContributions: calendar.totalContributions, weeks: calendar.weeks.map((week) => week.contributionDays) };
    cache.set(key, { body: result, until: Date.now() + 6 * 60 * 60 * 1000 });
    return send(res, 200, result, { 'X-Cache': 'MISS' });
  } catch { return send(res, 502, { message: 'Unable to reach GitHub GraphQL API.' }); }
}

async function proxyPublicEventsCalendar(res, username) {
  const key = `events:${username}`;
  const current = cache.get(key);
  if (current && current.until > Date.now()) return send(res, 200, current.body, { 'X-Cache': 'HIT' });
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'GitHub-Developer-Analytics' }
    });
    const extra = { 'X-Cache': 'MISS' };
    for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
      const value = response.headers.get(name); if (value) extra[name] = value;
    }
    const events = await response.json().catch(() => []);
    if (!response.ok) return send(res, response.status, events, extra);

    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(end.getDate() - 34);
    const days = Array.from({ length: 35 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      return { date, contributionCount: 0 };
    });
    for (const event of events) {
      if (event.type !== 'PushEvent') continue;
      const date = new Date(event.created_at); date.setHours(0, 0, 0, 0);
      const index = Math.floor((date - start) / 86400000);
      if (index >= 0 && index < days.length) days[index].contributionCount += Math.max(1, event.payload?.size || event.payload?.commits?.length || 1);
    }
    const weeks = Array.from({ length: 5 }, (_, week) => days.slice(week * 7, week * 7 + 7));
    const result = {
      totalContributions: days.reduce((sum, day) => sum + day.contributionCount, 0),
      weeks: weeks.map((week) => week.map((day) => ({ date: day.date.toISOString().slice(0, 10), contributionCount: day.contributionCount }))),
      source: 'public-events',
      rangeLabel: 'LAST 30 DAYS'
    };
    cache.set(key, { body: result, until: Date.now() + 15 * 60 * 1000 });
    return send(res, 200, result, extra);
  } catch {
    if (current) return send(res, 200, current.body, { 'X-Cache': 'STALE' });
    return send(res, 502, { message: 'Unable to reach GitHub public events API.' });
  }
}

function apiRoute(req, res, url) {
  let parts;
  try { parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part)); }
  catch { return send(res, 400, { message: 'Invalid API path.' }); }
  if (parts[0] !== 'api' || parts[1] !== 'github') return send(res, 404, { message: 'Not found.' });
  if (req.method !== 'GET') return send(res, 405, { message: 'Method not allowed.' }, { Allow: 'GET' });
  const username = parts[2];
  if (!validUser(username)) return send(res, 400, { message: 'Username must be 1–39 letters, numbers, or hyphens.' });
  if (parts[3] === 'contributions' && parts.length === 4) return proxyGraphql(res, username);
  if (parts[3] === 'repos' && parts.length === 4) {
    const page = Number(url.searchParams.get('page') || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10) return send(res, 400, { message: 'Repository page must be between 1 and 10.' });
    return proxyRest(req, res, url, `/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated`, 10 * 60 * 1000);
  }
  if (parts[3] === 'languages' && parts.length === 5) {
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(parts[4]) || parts[4] === '.' || parts[4] === '..') return send(res, 400, { message: 'Invalid repository name.' });
    return proxyRest(req, res, url, `/repos/${encodeURIComponent(username)}/${encodeURIComponent(parts[4])}/languages`, 24 * 60 * 60 * 1000);
  }
  if (parts.length === 3) return proxyRest(req, res, url, `/users/${encodeURIComponent(username)}`, 10 * 60 * 1000);
  return send(res, 404, { message: 'Not found.' });
}

const httpServer = http.createServer((req, res) => {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return send(res, 400, { message: 'Invalid request URL.' }); }
  if (url.pathname.startsWith('/api/')) return apiRoute(req, res, url);
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { return res.writeHead(400).end('Bad request'); }
  const name = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (!staticFiles.has(name) || name.includes('..') || path.basename(name) !== name) return res.writeHead(404).end('Not found');
  const file = path.resolve(publicRoot, name);
  if (!file.startsWith(publicRoot + path.sep)) return res.writeHead(403).end('Forbidden');
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

module.exports = { apiRoute };

if (require.main === module) {
  httpServer.listen(port, () => console.log(`GitHub Developer Analytics running at http://localhost:${port}${token ? ' (GitHub token loaded)' : ' (no GitHub token)'}`));
}
