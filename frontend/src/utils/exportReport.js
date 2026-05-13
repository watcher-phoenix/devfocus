import { TYPE_LABELS, TYPE_COLORS } from '../constants/workTypes';

const RELEASE_ANCHOR = '2026-05-12';

function releaseFlags(dateStr) {
  const anchor = new Date(RELEASE_ANCHOR + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.floor((target - anchor) / (24 * 60 * 60 * 1000));
  const cycleDay = ((diffDays % 14) + 14) % 14;
  const isWeek = cycleDay >= 13 || cycleDay <= 3;
  const isDay = cycleDay === 0;
  return { isWeek, isDay };
}

export function exportTrendsCSV(data, label) {
  const rows = [['Type', 'Title', 'Project', 'Completed', 'External ID', 'After Hours', 'Release Week', 'Release Day']];

  Object.entries(data.typeDetails || {}).forEach(([type, items]) => {
    items.forEach((item) => {
      const completedDate = item.completedAt ? new Date(item.completedAt).toLocaleDateString('en-CA') : '';
      const rf = completedDate ? releaseFlags(completedDate) : {};
      rows.push([
        TYPE_LABELS[type] || type,
        item.title,
        item.project || '',
        item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '',
        item.externalId || '',
        item.afterHours ? 'Yes' : '',
        rf.isWeek ? 'Yes' : '',
        rf.isDay ? 'Yes' : '',
      ]);
    });
  });

  rows.push([]);
  rows.push(['--- Meetings ---']);
  rows.push(['Week Of', 'Meeting Hours', 'Release Week']);
  Object.entries(data.weeklyMeetingMinutes || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([week, mins]) => {
      rows.push([week, `${Math.round(mins / 60 * 10) / 10}h`, releaseFlags(week).isWeek ? 'Yes' : '']);
    });

  rows.push([]);
  rows.push(['--- Summary ---']);
  rows.push(['Total Completed', data.summary.totalCompleted]);
  rows.push(['Total Meetings', data.summary.totalMeetings]);
  rows.push(['Total Meeting Hours', data.summary.totalMeetingHours]);
  rows.push(['Avg Items/Week', data.summary.avgItemsPerWeek]);
  rows.push(['Avg Meeting Hours/Week', data.summary.avgMeetingHoursPerWeek]);
  rows.push(['After Hours Items', data.summary.afterHoursItems]);
  rows.push(['After Hours Meetings', data.summary.afterHoursMeetings]);

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devfocus-${label}-${new Date().toLocaleDateString('en-CA')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportHTML(data, { mode = 'shareable', dateRange = '' } = {}) {
  const summary = data.summary || {};
  const typeBreakdown = data.typeBreakdown || {};
  const projectBreakdown = data.projectBreakdown || {};
  const typeDetails = data.typeDetails || {};
  const isPersonal = mode === 'personal';

  const topTypes = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]).filter(([, c]) => c > 0);
  const topProjects = Object.entries(projectBreakdown).sort((a, b) => b[1] - a[1]).filter(([, c]) => c > 0);

  const statRows = [
    { label: 'Items Completed', value: summary.totalCompleted || 0 },
    { label: 'Meetings', value: `${summary.totalMeetings || 0} (${summary.totalMeetingHours || 0}h)` },
    { label: 'PRs Reviewed', value: summary.prsReviewed || 0 },
    { label: 'After Hours Items', value: summary.afterHoursItems || 0 },
    { label: 'After Hours Meetings', value: summary.afterHoursMeetings || 0 },
  ];

  const typeRows = topTypes.map(([type, count]) => `<tr><td>${TYPE_LABELS[type] || type}</td><td style="text-align:right;font-weight:600">${count}</td></tr>`).join('');

  const projectRows = topProjects.map(([project, count]) => `<tr><td>${project}</td><td style="text-align:right;font-weight:600">${count}</td></tr>`).join('');

  // Completed items list
  let itemsList = '';
  Object.entries(typeDetails).forEach(([type, items]) => {
    items.forEach((item) => {
      const link = item.externalUrl ? `<a href="${item.externalUrl}" target="_blank">${item.externalId || 'link'}</a>` : (item.externalId || '');
      const date = item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '';
      itemsList += `<tr><td>${TYPE_LABELS[type] || type}</td><td>${item.title}</td><td>${item.project || ''}</td><td>${date}</td><td>${link}</td></tr>`;
    });
  });

  const title = isPersonal ? 'DevFocus Report' : 'Weekly Summary';
  const subtitle = dateRange || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title} - ${subtitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  h2 { font-size: 1.1rem; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .subtitle { color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { text-align: left; padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
  th { font-weight: 600; background: #f5f5f5; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .stat-box { border: 1px solid #ddd; border-radius: 6px; padding: 12px; }
  .stat-value { font-size: 1.5rem; font-weight: 700; }
  .stat-label { font-size: 0.85rem; color: #666; }
  a { color: #1976d2; text-decoration: none; }
  a:hover { text-decoration: underline; }
  @media print {
    body { padding: 0; }
    a { color: #1a1a1a; }
    a::after { content: " (" attr(href) ")"; font-size: 0.7rem; color: #666; }
  }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="subtitle">${subtitle}</p>

<div class="stat-grid">
${statRows.map((s) => `  <div class="stat-box"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('\n')}
</div>

${topTypes.length > 0 ? `<h2>Work Breakdown</h2><table><tr><th>Type</th><th style="text-align:right">Count</th></tr>${typeRows}</table>` : ''}

${topProjects.length > 0 ? `<h2>By Project</h2><table><tr><th>Project</th><th style="text-align:right">Count</th></tr>${projectRows}</table>` : ''}

${itemsList ? `<h2>Completed Items</h2><table><tr><th>Type</th><th>Title</th><th>Project</th><th>Completed</th><th>Link</th></tr>${itemsList}</table>` : ''}

<p style="color:#999;font-size:0.75rem;margin-top:24px;">Generated by DevFocus on ${new Date().toLocaleDateString()}</p>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
