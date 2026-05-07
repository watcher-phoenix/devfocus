/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig } = require('../database/models');

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
    // Build JQL — assigned to current user, not Done
    let jql = 'assignee = currentUser() AND status != Done ORDER BY updated DESC';
    if (projectKeys) {
      const keys = projectKeys.split(',').map((k) => k.trim()).filter(Boolean);
      if (keys.length > 0) {
        const projectFilter = keys.map((k) => `project = "${k}"`).join(' OR ');
        jql = `(${projectFilter}) AND assignee = currentUser() AND status != Done ORDER BY updated DESC`;
      }
    }

    const response = await axios.post(`${baseUrl}/rest/api/3/search/jql`, {
      jql,
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'project', 'issuetype', 'updated', 'parent', 'resolutiondate', 'statuscategorychangedate'],
    }, { headers });

    const issues = response.data.issues || [];
    let created = 0;
    let updated = 0;

    for (const issue of issues) {
      const existing = await WorkItem.findOne({
        where: { externalId: issue.key, externalSource: 'jira' },
      });

      const jiraPriority = mapJiraPriority(issue.fields.priority?.name);
      const jiraStatus = (issue.fields.status?.name || '').toLowerCase();
      const isDone = mapJiraStatusToDone(jiraStatus);
      const completionDate = issue.fields.resolutiondate
        || issue.fields.statuscategorychangedate
        || issue.fields.updated
        || new Date().toISOString();
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
        // Auto-mark as done if Jira status is a "done" status
        if (isDone && existing.status !== 'done') {
          updates.status = 'done';
          updates.completedAt = new Date(completionDate);
        }
        await existing.update(updates);
        updated++;
      } else {
        await WorkItem.create({
          ...data,
          status: isDone ? 'done' : 'inbox',
          completedAt: isDone ? new Date(completionDate) : null,
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

function mapJiraStatusToDone(statusName) {
  const doneStatuses = ['done', 'closed', 'resolved', 'ready for release', 'post release validation', 'pass', 'fail'];
  return doneStatuses.includes(statusName.toLowerCase());
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
