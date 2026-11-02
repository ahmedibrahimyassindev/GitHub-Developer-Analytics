const memory = new Map();
const usernamePattern = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;

export function validUsername(value) { return usernamePattern.test(value); }

async function getJson(path, ttl = 15 * 60 * 1000) {
  const key = `devscope:${path}`;
  let cached;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) cached = JSON.parse(saved);
  } catch { /* Private browsing can disable session storage. */ }
  cached ||= memory.get(key);
  if (cached?.until > Date.now()) return cached.body;
  let response;
  try { response = await fetch(path); }
  catch { if (cached) return cached.body; throw new Error('Network error: could not reach the analytics server. Check your connection and retry.'); }
  const reset = response.headers.get('x-ratelimit-reset');
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error('That GitHub username could not be found. Check the spelling and try again.');
    if (response.status === 403 || response.status === 429) {
      const time = reset ? new Date(Number(reset) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'later';
      throw new Error(`GitHub rate limit reached. Try again after ${time}. ${body.message || ''}`.trim());
    }
    throw new Error(body.message || `Request failed (${response.status}). Please try again.`);
  }
  const body = await response.json();
  const entry = { body, until: Date.now() + ttl };
  memory.set(key, entry);
  try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* Cache remains in memory. */ }
  return body;
}

export async function getProfile(username) { return getJson(`/api/github/${encodeURIComponent(username)}`); }
export async function getContributions(username) { return getJson(`/api/github/${encodeURIComponent(username)}/contributions`, 6 * 60 * 60 * 1000); }

export async function getAllRepos(username) {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await getJson(`/api/github/${encodeURIComponent(username)}/repos?page=${page}`, 15 * 60 * 1000);
    all.push(...batch);
    if (batch.length < 100) return { repos: all, truncated: false };
  }
  return { repos: all, truncated: true };
}

async function pool(items, limit, fn) {
  const output = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; try { output[index] = await fn(items[index]); } catch { output[index] = {}; } }
  }));
  return output;
}

export async function getLanguages(username, repos, includeForks = false) {
  const candidates = repos.filter((repo) => includeForks || !repo.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 20);
  const results = await pool(candidates, 5, (repo) => getJson(`/api/github/${encodeURIComponent(username)}/languages/${encodeURIComponent(repo.name)}`, 24 * 60 * 60 * 1000));
  const totals = {};
  results.forEach((languageBytes) => Object.entries(languageBytes).forEach(([language, bytes]) => { totals[language] = (totals[language] || 0) + bytes; }));
  return { totals, sampled: candidates.length, available: repos.filter((repo) => includeForks || !repo.fork).length };
}
