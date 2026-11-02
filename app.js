const state = { repos: [], username: 'octocat' };
const $ = (selector) => document.querySelector(selector);
const number = (value) => new Intl.NumberFormat().format(value || 0);
const dateLabel = (value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function showNotice(message, kind = 'error') {
  const notice = $('#notice');
  notice.textContent = message;
  notice.className = `notice ${kind}`;
  notice.hidden = false;
}

function clearNotice() { $('#notice').hidden = true; }

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    if (response.status === 404) throw new Error('That GitHub username could not be found. Check the spelling and try again.');
    if (response.status === 403 || response.status === 429) throw new Error('GitHub API rate limit reached. Please wait a minute and try again.');
    throw new Error(`GitHub returned an error (${response.status}). Please try again.`);
  }
  return response.json();
}

function renderProfile(user) {
  $('#profile').innerHTML = `<img class="avatar" src="${user.avatar_url}" alt="${user.login}'s avatar"><div class="profile-details"><div class="profile-name-row"><h2>${escapeHtml(user.name || user.login)}</h2><span class="verified-pill"><span>●</span> GITHUB PROFILE</span></div><a class="profile-handle" href="${user.html_url}" target="_blank" rel="noreferrer">@${escapeHtml(user.login)} <span>↗</span></a><p class="profile-bio">${escapeHtml(user.bio || 'No public bio provided.')}</p><div class="profile-meta">${user.location ? `<span>⌖ &nbsp;${escapeHtml(user.location)}</span>` : ''}${user.company ? `<span>▤ &nbsp;${escapeHtml(user.company)}</span>` : ''}${user.blog ? `<a href="${safeUrl(user.blog)}" target="_blank" rel="noreferrer">↗ &nbsp;${escapeHtml(user.blog.replace(/^https?:\/\//, ''))}</a>` : ''}<span>◷ &nbsp;Joined ${dateLabel(user.created_at)}</span></div></div><a class="github-link" href="${user.html_url}" target="_blank" rel="noreferrer">View profile <span>↗</span></a>`;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function safeUrl(url) { try { const parsed = new URL(url.startsWith('http') ? url : `https://${url}`); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#'; } catch { return '#'; } }

function renderStats(user, repos) {
  $('#repo-count').textContent = number(user.public_repos);
  $('#star-count').textContent = number(repos.reduce((sum, repo) => sum + repo.stargazers_count, 0));
  $('#follower-count').textContent = number(user.followers);
  $('#following-note').textContent = `${number(user.following)} following`;
  $('#fork-count').textContent = number(repos.reduce((sum, repo) => sum + repo.forks_count, 0));
  $('#repo-heading-count').textContent = number(repos.length);
}

function renderRepos() {
  const sort = $('#repo-sort').value;
  const repos = [...state.repos].sort((a, b) => sort === 'updated' ? new Date(b.updated_at) - new Date(a.updated_at) : b[sort === 'forks' ? 'forks_count' : 'stargazers_count'] - a[sort === 'forks' ? 'forks_count' : 'stargazers_count']);
  const shown = repos.slice(0, 6);
  $('#repo-list').innerHTML = shown.length ? shown.map((repo) => `<a class="repo-row" href="${repo.html_url}" target="_blank" rel="noreferrer"><div class="repo-main"><div class="repo-title">${escapeHtml(repo.name)} <span class="repo-arrow">↗</span></div><p>${escapeHtml(repo.description || 'No description provided.')}</p><div class="repo-meta">${repo.language ? `<span><i class="language-dot" style="--dot:${languageColor(repo.language)}"></i>${escapeHtml(repo.language)}</span>` : ''}<span>✳ ${number(repo.stargazers_count)}</span><span>⑂ ${number(repo.forks_count)}</span></div></div><span class="repo-date">Updated ${dateLabel(repo.updated_at)}</span></a>`).join('') : '<div class="empty-state">No public repositories found.</div>';
  $('#repo-footer').textContent = repos.length > 6 ? `Showing 6 of ${repos.length} repositories` : `${repos.length} public repositories`;
}

const colors = ['#b7e56b', '#73c9a1', '#7ca9ed', '#bd91e8', '#e9a66e', '#e27981', '#6fc8ce', '#d9d06f'];
function languageColor(language) { let hash = 0; for (const char of language) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return colors[hash % colors.length]; }

function renderLanguages(repos) {
  const counts = {};
  repos.forEach((repo) => { if (repo.language) counts[repo.language] = (counts[repo.language] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  if (!total) { $('#language-content').innerHTML = '<div class="empty-state">No language data available yet.</div>'; $('#language-foot').textContent = ''; return; }
  $('#language-content').innerHTML = `<div class="language-bar">${entries.map(([name, count]) => `<span title="${escapeHtml(name)} · ${Math.round(count / total * 100)}%" style="width:${count / total * 100}%;background:${languageColor(name)}"></span>`).join('')}</div><div class="language-list">${entries.slice(0, 6).map(([name, count]) => `<div class="language-row"><span class="language-name"><i class="language-dot" style="--dot:${languageColor(name)}"></i>${escapeHtml(name)}</span><span>${Math.round(count / total * 100)}%</span><span class="language-count">${count} ${count === 1 ? 'repo' : 'repos'}</span></div>`).join('')}</div>`;
  $('#language-foot').textContent = `Languages detected in ${total} of ${repos.length} repositories`;
}

function renderActivity(events) {
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - 83); start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 84 }, (_, i) => { const date = new Date(start); date.setDate(start.getDate() + i); return { date, count: 0 }; });
  events.filter((event) => event.type === 'PushEvent').forEach((event) => {
    const date = new Date(event.created_at); date.setHours(0, 0, 0, 0);
    const index = Math.floor((date - start) / 86400000);
    if (index >= 0 && index < days.length) days[index].count += Math.max(1, event.payload?.commits?.length || 0);
  });
  const weekly = Array.from({ length: 12 }, (_, week) => days.slice(week * 7, week * 7 + 7));
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const active = weekly.filter((week) => week.some((day) => day.count > 0)).length;
  $('#commit-total').textContent = number(total); $('#active-weeks').textContent = active;
  $('#activity-chart').innerHTML = weekly.map((week) => `<div class="week-column">${week.map((day) => `<span class="activity-cell level-${day.count === 0 ? 0 : day.count < 3 ? 1 : day.count < 6 ? 2 : day.count < 10 ? 3 : 4}" title="${day.count} observed commit${day.count === 1 ? '' : 's'} · ${day.date.toLocaleDateString()}"></span>`).join('')}</div>`).join('');
  $('#chart-labels').innerHTML = weekly.map((week, i) => i % 2 === 0 ? `<span>${week[0].date.toLocaleDateString(undefined, { month: 'short' })}</span>` : '<span></span>').join('');
}

async function loadUser(username) {
  clearNotice(); state.username = username;
  $('#profile').innerHTML = '<div class="profile-loading skeleton"></div>';
  $('#repo-list').innerHTML = '<div class="empty-state">Loading repositories…</div>';
  try {
    const user = await github(`/users/${encodeURIComponent(username)}`);
    const [repos, events] = await Promise.all([
      github(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`),
      github(`/users/${encodeURIComponent(username)}/events/public?per_page=100`).catch(() => [])
    ]);
    renderProfile(user); renderStats(user, repos); state.repos = repos; renderRepos(); renderLanguages(repos); renderActivity(events);
    if (repos.length < user.public_repos) showNotice(`Showing the latest ${repos.length} of ${user.public_repos} public repositories.`, 'info');
  } catch (error) {
    $('#profile').innerHTML = '<div class="empty-state profile-error">No profile loaded. Search for a GitHub username to get started.</div>';
    $('#repo-list').innerHTML = '<div class="empty-state">Repository data is unavailable.</div>';
    showNotice(error.message);
  }
}

$('#search-form').addEventListener('submit', (event) => { event.preventDefault(); const username = $('#username').value.trim(); if (username) loadUser(username); });
$('#repo-sort').addEventListener('change', renderRepos);
loadUser('octocat');
