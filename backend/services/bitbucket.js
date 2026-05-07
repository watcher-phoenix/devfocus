/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig } = require('../database/models');

const BB_API = 'https://api.bitbucket.org/2.0';

// Build auth header — supports app password OR workspace/repo access token
function getHeaders(config) {
  if (config.accessToken) {
    return { Authorization: `Bearer ${config.accessToken}` };
  }
  // App password fallback
  const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  return { Authorization: `Basic ${auth}` };
}

// Fetch all repos in the workspace (paginated)
async function fetchAllRepos(workspace, headers) {
  const repos = [];
  let url = `${BB_API}/repositories/${workspace}?pagelen=100`;

  while (url) {
    const response = await axios.get(url, { headers }).catch(() => ({ data: { values: [], next: null } }));
    for (const repo of (response.data.values || [])) {
      repos.push(repo.slug);
    }
    url = response.data.next || null;
  }

  return repos;
}

async function syncBitbucket() {
  const integrationConfig = await IntegrationConfig.findOne({
    where: { provider: 'bitbucket', enabled: true },
  });

  if (!integrationConfig || !integrationConfig.config) {
    return { success: false, error: 'Bitbucket integration not configured' };
  }

  const config = JSON.parse(integrationConfig.config);
  const { workspace, username } = config;

  if (!workspace) {
    return { success: false, error: 'Bitbucket config incomplete — need workspace' };
  }

  if (!config.accessToken && (!username || !config.appPassword)) {
    return { success: false, error: 'Need either an access token or username + app password' };
  }

  const headers = getHeaders(config);

  try {
    let created = 0;
    let updated = 0;

    // Get repo list — either specified or all repos in workspace
    let repoList;
    if (config.repos) {
      repoList = config.repos.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      console.log('[bitbucket] Fetching all repos in workspace...');
      repoList = await fetchAllRepos(workspace, headers);
      console.log(`[bitbucket] Found ${repoList.length} repos`);
    }

    const allOpenIds = [];

    for (const repoSlug of repoList) {
      // Open PRs authored by this user
      const prParams = { state: 'OPEN', pagelen: 20 };
      if (username) prParams.q = `author.username="${username}"`;

      const prResponse = await axios.get(
        `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
        { headers, params: prParams }
      ).catch(() => ({ data: { values: [] } }));

      for (const pr of (prResponse.data.values || [])) {
        const externalId = `${repoSlug}#${pr.id}`;
        allOpenIds.push(externalId);
        const existing = await WorkItem.findOne({
          where: { externalId, externalSource: 'bitbucket' },
        });

        const data = {
          title: `PR: ${pr.title}`,
          externalId,
          externalUrl: pr.links?.html?.href || '',
          externalSource: 'bitbucket',
          type: 'pr',
          priority: 1,
        };

        if (existing) {
          await existing.update({ title: data.title });
          updated++;
        } else {
          await WorkItem.create({ ...data, status: 'active' });
          created++;
        }
      }

      // PRs where user is a reviewer
      if (username) {
        const reviewResponse = await axios.get(
          `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
          {
            headers,
            params: { state: 'OPEN', q: `reviewers.username="${username}"`, pagelen: 20 },
          }
        ).catch(() => ({ data: { values: [] } }));

        for (const pr of (reviewResponse.data.values || [])) {
          const externalId = `review:${repoSlug}#${pr.id}`;
          allOpenIds.push(externalId);
          const existing = await WorkItem.findOne({
            where: { externalId, externalSource: 'bitbucket' },
          });

          const data = {
            title: `Review: ${pr.title}`,
            externalId,
            externalUrl: pr.links?.html?.href || '',
            externalSource: 'bitbucket',
            type: 'review',
            priority: 2,
          };

          if (existing) {
            await existing.update({ title: data.title });
            updated++;
          } else {
            await WorkItem.create({ ...data, status: 'inbox' });
            created++;
          }
        }
      }
    }

    // Mark merged/closed PRs as done
    if (allOpenIds.length > 0) {
      const stale = await WorkItem.findAll({
        where: {
          externalSource: 'bitbucket',
          status: { [require('sequelize').Op.ne]: 'done' },
          externalId: { [require('sequelize').Op.notIn]: allOpenIds },
        },
      });
      for (const item of stale) {
        await item.update({ status: 'done', completedAt: new Date() });
      }
    }

    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    });

    return { success: true, created, updated, repos: repoList.length };
  } catch (err) {
    console.error('Bitbucket sync error:', err.response?.data || err.message);
    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
    });
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

module.exports = { syncBitbucket };
