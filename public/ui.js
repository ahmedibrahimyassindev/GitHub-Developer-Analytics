import { languageColor, languageRows, renderContributionChart } from './charts.js';

export const $ = (selector) => document.querySelector(selector);
const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const externalLink = (href, text, className = '') => { const a = el('a', className, text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };

export function setLoading(loading) { $('#profile').replaceChildren(el('div', 'profile-loading skeleton')); $('#profile').setAttribute('aria-busy', String(loading)); $('#repo-list').replaceChildren(el('div', 'empty-state', loading ? 'Loading repositories…' : '')); }
export function showNotice(message, kind = 'error') { const node = $('#notice'); node.textContent = message; node.className = `notice ${kind}`; node.hidden = false; }
export function clearNotice() { $('#notice').hidden = true; }

export function renderProfile(user) {
  const card = $('#profile'); card.replaceChildren(); card.setAttribute('aria-busy', 'false');
  const avatar = el('img', 'avatar'); avatar.src = user.avatar_url; avatar.alt = `${user.login} avatar`;
  const details = el('div', 'profile-details');
  const row = el('div', 'profile-name-row'); row.append(el('h2', '', user.name || user.login), el('span', 'verified-pill', 'GITHUB PROFILE'));
  details.append(row, externalLink(user.html_url, `@${user.login} ↗`, 'profile-handle'), el('p', 'profile-bio', user.bio || 'No public bio provided.'));
  const meta = el('div', 'profile-meta');
  if (user.location) meta.append(el('span', '', `⌖  ${user.location}`));
  if (user.company) meta.append(el('span', '', `▤  ${user.company}`));
  if (user.blog) { let href = user.blog; try { if (!/^https?:\/\//i.test(href)) href = `https://${href}`; const parsed = new URL(href); if (!['http:', 'https:'].includes(parsed.protocol)) throw Error(); meta.append(externalLink(parsed.href, `↗  ${parsed.host}`)); } catch { /* Skip invalid profile links. */ } }
  meta.append(el('span', '', `◷  Joined ${new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`));
  details.append(meta); card.append(avatar, details, externalLink(user.html_url, 'View profile ↗', 'github-link'));
}

export function renderStats(user, repos) {
  const original = repos.filter((repo) => !repo.fork);
  $('#repo-count').textContent = fmt(user.public_repos); $('#star-count').textContent = fmt(original.reduce((sum, repo) => sum + repo.stargazers_count, 0));
  $('#follower-count').textContent = fmt(user.followers); $('#following-note').textContent = `${fmt(user.following)} following`;
  $('#fork-count').textContent = fmt(original.reduce((sum, repo) => sum + repo.forks_count, 0)); $('#repo-heading-count').textContent = fmt(repos.length);
}

export function renderRepos(repos) {
  const mode = $('#repo-sort').value;
  const sorted = [...repos].sort((a, b) => mode === 'updated' ? new Date(b.updated_at) - new Date(a.updated_at) : b[mode === 'forks' ? 'forks_count' : 'stargazers_count'] - a[mode === 'forks' ? 'forks_count' : 'stargazers_count']);
  const list = $('#repo-list'); list.replaceChildren();
  sorted.slice(0, 8).forEach((repo) => {
    const link = el('a', 'repo-row'); link.href = repo.html_url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const main = el('div', 'repo-main'); const title = el('div', 'repo-title', `${repo.name} ↗`); main.append(title, el('p', '', repo.description || 'No description provided.'));
    const meta = el('div', 'repo-meta'); if (repo.language) { const span = el('span'); const dot = el('i', 'language-dot'); dot.style.setProperty('--dot', languageColor(repo.language)); span.append(dot, document.createTextNode(repo.language)); meta.append(span); }
    meta.append(el('span', '', `✳ ${fmt(repo.stargazers_count)}`), el('span', '', `⑂ ${fmt(repo.forks_count)}`));
    if (repo.fork) meta.append(el('span', 'fork-label', 'FORK'));
    main.append(meta); link.append(main, el('span', 'repo-date', `Updated ${new Date(repo.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`)); list.append(link);
  });
  if (!sorted.length) list.append(el('div', 'empty-state', 'No public repositories found.'));
  $('#repo-footer').textContent = `${repos.length} repositories · forked repos excluded from summary totals`;
}

export function renderLanguages(totals, sampled, available, includeForks) {
  const { entries, total } = languageRows(totals); const content = $('#language-content'); content.replaceChildren();
  if (!total) { content.append(el('div', 'empty-state', 'No language byte data available for these repositories.')); $('#language-foot').textContent = ''; return; }
  const bar = el('div', 'language-bar'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', `Language byte distribution across ${sampled} repositories`);
  entries.forEach(([name, bytes]) => { const piece = el('span'); piece.style.width = `${bytes / total * 100}%`; piece.style.background = languageColor(name); piece.title = `${name}: ${fmt(bytes)} bytes`; bar.append(piece); }); content.append(bar);
  const table = el('table', 'language-table'); const head = el('thead'); const trh = el('tr'); ['Language', 'Bytes', 'Share'].forEach((name) => trh.append(el('th', '', name))); head.append(trh); table.append(head);
  const body = el('tbody'); entries.slice(0, 10).forEach(([name, bytes]) => { const row = el('tr'); const language = el('td'); const dot = el('i', 'language-dot'); dot.style.setProperty('--dot', languageColor(name)); language.append(dot, document.createTextNode(name)); row.append(language, el('td', '', fmt(bytes)), el('td', '', `${(bytes / total * 100).toFixed(1)}%`)); body.append(row); }); table.append(body); content.append(table);
  $('#language-foot').textContent = `Byte counts from ${sampled} of ${available} ${includeForks ? 'repositories (forks included)' : 'original repositories'} · sorted by stars`;
}

export function renderContributions(calendar) {
  const { total, active } = renderContributionChart($('#activity-chart'), calendar.weeks);
  $('#commit-total').textContent = fmt(calendar.totalContributions ?? total); $('#active-weeks').textContent = String(active);
  $('#activity-range').textContent = calendar.rangeLabel || 'LAST YEAR';
  $('#activity-unit').textContent = calendar.source === 'public-events' ? 'observed public push commits' : 'contributions';
  $('#activity-note').textContent = calendar.source === 'public-events' ? 'Public events · up to 30 days / 300 events' : 'GitHub contribution calendar';
}

export function renderCompare(primary, other) {
  const container = $('#compare-result'); container.replaceChildren(); container.hidden = false;
  const profiles = [primary, other];
  profiles.forEach((user) => { const card = el('article', 'compare-profile'); const avatar = el('img'); avatar.src = user.avatar_url; avatar.alt = ''; card.append(avatar, el('h3', '', user.name || user.login), externalLink(user.html_url, `@${user.login}`), el('p', '', `${fmt(user.public_repos)} repos · ${fmt(user.followers)} followers · ${fmt(user.public_gists)} gists`)); container.append(card); });
}

export function showError(message) { $('#profile').replaceChildren(el('div', 'empty-state profile-error', 'No profile loaded. Search for a GitHub username to get started.')); $('#profile').setAttribute('aria-busy', 'false'); $('#repo-list').replaceChildren(el('div', 'empty-state', 'Repository data is unavailable.')); showNotice(message); }
