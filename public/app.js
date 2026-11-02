import { getAllRepos, getContributions, getLanguages, getProfile, validUsername } from './api.js';
import { $, clearNotice, renderCompare, renderContributions, renderLanguages, renderProfile, renderRepos, renderStats, setLoading, showError, showNotice } from './ui.js';

let current = { user: null, repos: [], languages: null };

function setShareUrl(username) {
  const url = new URL(location.href); url.searchParams.set('user', username); history.replaceState({}, '', url);
}

async function loadUser(rawUsername, updateUrl = true) {
  const username = rawUsername.trim();
  if (!validUsername(username)) { showNotice('Enter a valid GitHub username: 1–39 letters or numbers, with single hyphens between characters.'); $('#username').focus(); return; }
  clearNotice(); setLoading(true); $('#export-button').disabled = true;
  if (updateUrl) setShareUrl(username);
  $('#username').value = username;
  try {
    const [user, pagedRepos] = await Promise.all([getProfile(username), getAllRepos(username)]);
    const repos = pagedRepos.repos;
    current = { user, repos, languages: null };
    renderProfile(user); renderStats(user, repos); refreshReposAndLanguages();
    $('#export-button').disabled = false;
    const jobs = [getContributions(username).then(renderContributions).catch((error) => { $('#activity-chart').textContent = error.message; $('#activity-chart').setAttribute('aria-label', error.message); })];
    if (pagedRepos.truncated) showNotice(`Showing the first 1,000 repositories. GitHub's REST API limits this view to 10 pages.`, 'info');
    await Promise.all(jobs);
  } catch (error) { showError(error.message); }
}

async function refreshReposAndLanguages() {
  if (!current.user) return;
  const includeForks = $('#include-forks').checked;
  const shown = includeForks ? current.repos : current.repos.filter((repo) => !repo.fork);
  renderRepos(shown);
  $('#language-content').textContent = 'Loading byte-level language data…';
  try {
    current.languages = await getLanguages(current.user.login, current.repos, includeForks);
    renderLanguages(current.languages.totals, current.languages.sampled, current.languages.available, includeForks);
  } catch (error) { $('#language-content').textContent = error.message; }
}

$('#search-form').addEventListener('submit', (event) => { event.preventDefault(); loadUser($('#username').value); });
$('#repo-sort').addEventListener('change', () => { if (current.user) renderRepos($('#include-forks').checked ? current.repos : current.repos.filter((repo) => !repo.fork)); });
$('#include-forks').addEventListener('change', refreshReposAndLanguages);
$('#export-button').addEventListener('click', () => {
  if (!current.user) return;
  const report = { generatedAt: new Date().toISOString(), profile: current.user, repositories: current.repos, languages: current.languages };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${current.user.login}-github-analytics.json`; anchor.click(); URL.revokeObjectURL(url);
});

const themeToggle = $('#theme-toggle');
function setTheme(theme) { document.documentElement.dataset.theme = theme; themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode'; themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`); try { localStorage.setItem('devscope-theme', theme); } catch { /* Theme preference is optional. */ } }
try { setTheme(localStorage.getItem('devscope-theme') || 'dark'); } catch { setTheme('dark'); }
themeToggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

$('#compare-toggle').addEventListener('click', () => { $('#compare-form').hidden = !$('#compare-form').hidden; if (!$('#compare-form').hidden) $('#compare-username').focus(); });
$('#compare-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const username = $('#compare-username').value.trim();
  if (!validUsername(username)) { showNotice('Enter a valid second GitHub username.'); return; }
  if (!current.user) { showNotice('Load the first profile before comparing.'); return; }
  try { const second = await getProfile(username); renderCompare(current.user, second); }
  catch (error) { showNotice(error.message); }
});

const queryUser = new URLSearchParams(location.search).get('user');
loadUser(queryUser && validUsername(queryUser) ? queryUser : 'ahmedibrahimyassindev', false);
