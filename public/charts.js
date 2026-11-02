const colors = ['#b7e56b', '#73c9a1', '#7ca9ed', '#bd91e8', '#e9a66e', '#e27981', '#6fc8ce', '#d9d06f'];
export function languageColor(language) { let hash = 0; for (const char of language) hash = (hash * 31 + char.charCodeAt(0)) >>> 0; return colors[hash % colors.length]; }

export function languageRows(totals) {
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  return { entries, total };
}

export function renderContributionChart(container, weeks) {
  const days = weeks.flat();
  const total = days.reduce((sum, day) => sum + day.contributionCount, 0);
  const active = weeks.filter((week) => week.some((day) => day.contributionCount > 0)).length;
  const chart = document.createElement('div'); chart.className = 'activity-chart'; chart.setAttribute('role', 'img');
  chart.style.gridTemplateColumns = `repeat(${weeks.length}, minmax(2px, 1fr))`;
  chart.setAttribute('aria-label', `${total} contributions over the last year, across ${active} active weeks`);
  const labels = document.createElement('div'); labels.className = 'chart-x-labels';
  labels.style.gridTemplateColumns = `repeat(${weeks.length}, minmax(2px, 1fr))`;
  const disclosure = document.createElement('details'); disclosure.className = 'activity-details';
  const summary = document.createElement('summary'); summary.textContent = 'View weekly contributions as a table'; disclosure.append(summary);
  const table = document.createElement('table'); table.className = 'activity-table';
  const caption = document.createElement('caption'); caption.textContent = 'Weekly contribution totals'; table.append(caption);
  const body = document.createElement('tbody');
  let lastMonth = '';
  weeks.forEach((week) => {
    const col = document.createElement('div'); col.className = 'week-column';
    week.forEach((day) => {
      const cell = document.createElement('span');
      const n = day.contributionCount;
      cell.className = `activity-cell level-${n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : n < 10 ? 3 : 4}`;
      cell.title = `${n} contributions · ${day.date}`; col.append(cell);
    });
    chart.append(col);
    const first = week[0];
    const date = new Date(`${first.date}T00:00:00`);
    const month = date.toLocaleDateString(undefined, { month: 'short' });
    const label = document.createElement('span'); label.textContent = month === lastMonth ? '' : month; lastMonth = month;
    labels.append(label);
    const tr = document.createElement('tr'); const range = document.createElement('th'); range.scope = 'row'; range.textContent = `${week[0].date} – ${week.at(-1).date}`;
    const count = document.createElement('td'); count.textContent = String(week.reduce((sum, day) => sum + day.contributionCount, 0)); tr.append(range, count); body.append(tr);
  });
  table.append(body);
  disclosure.append(table); container.replaceChildren(chart, labels, disclosure);
  return { total, active };
}
