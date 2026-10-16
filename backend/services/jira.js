/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig, StatusConfig } = require('../database/models');

async function syncJira() {
  const integrationConfig = await IntegrationConfig.findOne({
    where: { provider: 'jira', enabled: true },
  });

  if (!integrationConfig || !integrationConfig.config) {
    return { success: false, error: 'Jira integration not configured' };
  }

  const config = JSON.parse(integrationConfig.config);
  const { baseUrl, email, apiToken, projectKeys } = config;

  if (!baseUrl || !email || !apiToken) {
    return { success: false, error: 'Jira config incomplete — need baseUrl, email, apiToken' };
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  try {
    // Two queries:
    // 1. Active tickets (not done) — to track current work
    // 2. Recently completed tickets (last 14 days) — to capture completions with real dates
    const doneStatuses = ['Done', 'Ready for Release', 'Post Release Validation', 'Pass', 'Fail'];
    const cancelledStatuses = ["Won't Do", 'Duplicate', 'Cancelled'];
    const allTerminalStatuses = [...doneStatuses, ...cancelledStatuses];
    const doneFilter = allTerminalStatuses.map((s) => `"${s}"`).join(', ');
    const notDoneFilter = `status NOT IN (${doneFilter})`;
    const recentDoneFilter = `status IN (${doneFilter}) AND updated >= -14d`;

    let activeJql = `assignee = currentUser() AND ${notDoneFilter} ORDER BY updated DESC`;
    let doneJql = `assignee = currentUser() AND ${recentDoneFilter} ORDER BY updated DESC`;
    if (projectKeys) {
      const keys = projectKeys.split(',').map((k) => k.trim()).filter(Boolean);
      if (keys.length > 0) {
        const projectFilter = keys.map((k) => `project = "${k}"`).join(' OR ');
        activeJql = `(${projectFilter}) AND assignee = currentUser() AND ${notDoneFilter} ORDER BY updated DESC`;
        doneJql = `(${projectFilter}) AND assignee = currentUser() AND ${recentDoneFilter} ORDER BY updated DESC`;
      }
    }

    const jiraFields = ['summary', 'status', 'priority', 'project', 'issuetype', 'updated', 'parent', 'resolutiondate', 'statuscategorychangedate'];

    const [activeResponse, doneResponse] = await Promise.all([
      axios.post(`${baseUrl}/rest/api/3/search/jql`, { jql: activeJql, maxResults: 50, fields: jiraFields }, { headers }),
      axios.post(`${baseUrl}/rest/api/3/search/jql`, { jql: doneJql, maxResults: 50, fields: jiraFields }, { headers }),
    ]);

    // Merge and dedupe
    const issueMap = new Map();
    for (const issue of (activeResponse.data.issues || [])) issueMap.set(issue.key, issue);
    for (const issue of (doneResponse.data.issues || [])) issueMap.set(issue.key, issue);
    const issues = Array.from(issueMap.values());

    // Build the Jira-status -> DevFocus-column mapper from the live columns, so
    // custom columns (e.g. "In Testing") map automatically by matching label.
    const statusConfigs = await StatusConfig.findAll();
    const { map: mapJiraStatus, controlled: jiraControlledKeys } = buildJiraStatusMapper(statusConfigs);

    let created = 0;
    let updated = 0;

    for (const issue of issues) {
      const existing = await WorkItem.findOne({
        where: { externalId: issue.key, externalSource: 'jira' },
      });

      const jiraPriority = mapJiraPriority(issue.fields.priority?.name);
      const jiraStatus = (issue.fields.status?.name || '').toLowerCase();
      const targetStatus = mapJiraStatus(jiraStatus);
      const isTerminalTarget = targetStatus === 'done' || targetStatus === 'cancelled';
      // Use real completion date — don't fall back to 'updated' since that
      // changes whenever anyone touches the ticket
      const completionDate = issue.fields.resolutiondate
        || issue.fields.statuscategorychangedate
        || null;
      const issueType = issue.fields.issuetype?.name || '';
      const parent = issue.fields.parent;
      const parentPrefix = parent ? `${parent.key}: ${parent.fields?.summary} > ` : '';
      const typeTag = issueType ? `[${issueType}] ` : '';

      const data = {
        title: `${typeTag}${parentPrefix}${issue.key}: ${issue.fields.summary}`,
        description: [
          parent ? `Parent: ${parent.key} — ${parent.fields?.summary}` : null,
          issueType ? `Type: ${issueType}` : null,
          issue.fields.project?.name ? `Project: ${issue.fields.project.name}` : null,
        ].filter(Boolean).join('\n'),
        externalId: issue.key,
        externalUrl: parent ? `${baseUrl}/browse/${parent.key}` : `${baseUrl}/browse/${issue.key}`,
        externalSource: 'jira',
        type: 'jira',
        priority: jiraPriority,
      };

      if (existing) {
        const updates = {
          title: data.title,
          description: data.description,
          priority: jiraPriority,
        };
        // Jira owns the lifecycle columns (Brain Dump / Active / In Testing / Done / Cancelled).
        // Terminal states (Done/Cancelled) always win. For non-terminal moves we only
        // reshuffle among Jira-controlled columns, so a manual park in Waiting/Later/
        // Scheduled (or any custom column) is preserved.
        if (existing.status !== targetStatus
          && (isTerminalTarget || jiraControlledKeys.has(existing.status))) {
          updates.status = targetStatus;
          updates.completedAt = targetStatus === 'done'
            ? (completionDate ? new Date(completionDate) : new Date())
            : null;
        }
        await existing.update(updates);
        updated++;
      } else {
        await WorkItem.create({
          ...data,
          status: targetStatus,
          completedAt: targetStatus === 'done' ? (completionDate ? new Date(completionDate) : new Date()) : null,
        });
        created++;
      }
    }

    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    });

    return { success: true, created, updated, total: issues.length };
  } catch (err) {
    console.error('Jira sync error:', err.response?.data || err.message);
    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
    });
    return { success: false, error: err.response?.data?.errorMessages?.[0] || err.message };
  }
}

// Jira status names (lowercased) that map to terminal DevFocus columns.
const DONE_STATUSES = ['done', 'ready for release', 'post release validation', 'pass', 'fail'];
const CANCELLED_STATUSES = ["won't do", 'duplicate', 'cancelled'];
// Jira statuses that map to Brain Dump / Active when there's no exact column-label match.
const INBOX_ALIASES = ['backlog', 'to do', 'open', 'new', 'selected for development'];
const ACTIVE_ALIASES = ['active', 'in progress', 'in development'];
// Jira workflow statuses that ride on custom DevFocus columns matched by synonym.
// Each group lists the Jira status names (and DevFocus column labels) that mean the
// same lifecycle stage, so Jira "Testing" lands in a DevFocus "In Testing" column
// even though the strings don't match exactly.
const TESTING_ALIASES = ['in testing', 'testing', 'ready for testing', 'in qa', 'qa'];
const REVIEW_ALIASES = ['in review', 'code review', 'review', 'in code review', 'peer review'];
// Jira workflow statuses that ride on custom DevFocus columns matched by label/synonym.
// These columns are treated as Jira-controlled (not manual parking columns).
const WORKFLOW_LABELS = [...TESTING_ALIASES, ...REVIEW_ALIASES];

// Build a Jira-status -> DevFocus-column mapper from the live StatusConfig rows.
// A custom column auto-maps when its label matches the Jira status name exactly
// (e.g. Jira "In Testing" -> DevFocus "In Testing"), or when both the Jira status and
// a column label fall in the same synonym group (e.g. Jira "Testing" -> "In Testing").
function buildJiraStatusMapper(statusConfigs) {
  const byLabel = new Map(statusConfigs.map((s) => [s.label.toLowerCase(), s.key]));
  const hasKey = (k) => statusConfigs.some((s) => s.key === k);

  // Resolve the first existing column whose label matches any synonym in the group.
  const columnForGroup = (aliases) => {
    const match = aliases.find((a) => byLabel.has(a));
    return match ? byLabel.get(match) : null;
  };
  const testingKey = columnForGroup(TESTING_ALIASES);
  const reviewKey = columnForGroup(REVIEW_ALIASES);

  const map = (statusName) => {
    const n = (statusName || '').toLowerCase().trim();
    if (CANCELLED_STATUSES.includes(n)) return 'cancelled';
    if (DONE_STATUSES.includes(n)) return 'done';
    if (byLabel.has(n)) return byLabel.get(n); // exact column-label match (handles "In Testing", "Active")
    if (TESTING_ALIASES.includes(n) && testingKey) return testingKey; // Jira "Testing" -> "In Testing" column
    if (REVIEW_ALIASES.includes(n) && reviewKey) return reviewKey;
    if (ACTIVE_ALIASES.includes(n)) return hasKey('active') ? 'active' : 'inbox';
    if (INBOX_ALIASES.includes(n)) return 'inbox';
    return 'inbox';
  };

  // Columns whose contents Jira owns: base lifecycle + any label-matched workflow column.
  const controlled = new Set(['inbox', 'active', 'done', 'cancelled']);
  statusConfigs.forEach((s) => {
    if (WORKFLOW_LABELS.includes(s.label.toLowerCase())) controlled.add(s.key);
  });

  return { map, controlled };
}

function mapJiraPriority(jiraPriorityName) {
  if (!jiraPriorityName) return 0;
  const name = jiraPriorityName.toLowerCase();
  if (name.includes('highest') || name.includes('critical') || name.includes('blocker')) return 3;
  if (name.includes('high')) return 2;
  if (name.includes('medium')) return 1;
  return 0;
}

module.exports = { syncJira };
