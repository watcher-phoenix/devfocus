/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig } = require('../database/models');

const BB_API = 'https://api.bitbucket.org/2.0';

// Build auth header — supports workspace access token OR app password
function getHeaders(config) {
  if (config.accessToken) {
    // Workspace access tokens use Basic auth with x-token-auth as username
    const auth = Buffer.from(`x-token-auth:${config.accessToken}`).toString('base64');
    return { Authorization: `Basic ${auth}` };
  }
  const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  return { Authorization: `Basic ${auth}` };
}

// Fetch all repos in the workspace (paginated)
async function fetchAllRepos(workspace, headers) {
  const repos = [];
  let url = `${BB_API}/repositories/${workspace}?pagelen=100`;

  while (url) {
    const response = await axios.get(url, { headers });
    for (const repo of (response.data.values || [])) {
      repos.push(repo.slug);
    }
    url = response.data.next || null;
  }

  return repos;
}

// Get the current user's UUID for filtering PRs
async function getCurrentUser(headers) {
  try {
    const response = await axios.get(`${BB_API}/user`, { headers });
    return {
      uuid: response.data.uuid,
      displayName: response.data.display_name,
      accountId: response.data.account_id,
    };
  } catch (err) {
    console.error('[bitbucket] Could not fetch current user:', err.response?.data || err.message);
    return null;
  }
}

async function syncBitbucket() {
  const integrationConfig = await IntegrationConfig.findOne({
    where: { provider: 'bitbucket', enabled: true },
  });

  if (!integrationConfig || !integrationConfig.config) {
    return { success: false, error: 'Bitbucket integration not configured' };
  }

  const config = JSON.parse(integrationConfig.config);
  const { workspace } = config;

  if (!workspace) {
    return { success: false, error: 'Bitbucket config incomplete — need workspace' };
  }

  if (!config.accessToken && (!config.username || !config.appPassword)) {
    return { success: false, error: 'Need either an access token or username + app password' };
  }

  const headers = getHeaders(config);

  try {
    // First verify auth works by getting current user
    const currentUser = await getCurrentUser(headers);
    if (!currentUser) {
      return { success: false, error: 'Authentication failed — check your token or credentials' };
    }
    console.log(`[bitbucket] Authenticated as: ${currentUser.displayName} (${currentUser.uuid})`);

    let created = 0;
    let updated = 0;

    // Get repo list
    let repoList;
    if (config.repos) {
      repoList = config.repos.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      console.log('[bitbucket] Fetching all repos in workspace...');
      repoList = await fetchAllRepos(workspace, headers);
      console.log(`[bitbucket] Found ${repoList.length} repos`);
    }

    const allOpenIds = [];
    const errors = [];

    for (const repoSlug of repoList) {
      try {
        // Fetch ALL open PRs for this repo (no user filter — filter client-side)
        const prResponse = await axios.get(
          `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
          { headers, params: { state: 'OPEN', pagelen: 50 } }
        );

        const prs = prResponse.data.values || [];

        for (const pr of prs) {
          const isAuthor = pr.author?.uuid === currentUser.uuid;
          const isReviewer = (pr.reviewers || []).some((r) => r.uuid === currentUser.uuid);

          if (!isAuthor && !isReviewer) continue;

          if (isAuthor) {
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

          if (isReviewer) {
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
      } catch (err) {
        const msg = `${repoSlug}: ${err.response?.data?.error?.message || err.message}`;
        console.error(`[bitbucket] Error on repo ${msg}`);
        errors.push(msg);
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
      lastSyncStatus: errors.length > 0 ? 'partial' : 'success',
    });

    return {
      success: true,
      created,
      updated,
      repos: repoList.length,
      user: currentUser.displayName,
      errors: errors.length > 0 ? errors : undefined,
    };
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
