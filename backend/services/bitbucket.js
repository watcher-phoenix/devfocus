/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig } = require('../database/models');

const BB_API = 'https://api.bitbucket.org/2.0';

// Build auth header — supports workspace access token OR app password
function getHeaders(config) {
  if (config.accessToken) {
    return { Authorization: `Bearer ${config.accessToken}` };
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
    // Try to get current user (may fail with workspace tokens — that's ok)
    const currentUser = await getCurrentUser(headers);
    if (currentUser) {
      console.log(`[bitbucket] Authenticated as: ${currentUser.displayName} (${currentUser.uuid})`);
    } else {
      console.log('[bitbucket] Using workspace token (no personal user context)');
    }

    let created = 0;
    let updated = 0;

    // Verify auth by fetching repos — this works with all token types
    let repoList;
    if (config.repos) {
      repoList = config.repos.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      console.log('[bitbucket] Fetching all repos in workspace...');
      repoList = await fetchAllRepos(workspace, headers);
      console.log(`[bitbucket] Found ${repoList.length} repos`);
    }

    if (repoList.length === 0) {
      return { success: false, error: 'No repos found. Check your workspace name and token permissions (needs Repositories:Read).' };
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
          // With a personal token, filter by user. With workspace token, take all PRs.
          const isAuthor = currentUser
            ? pr.author?.uuid === currentUser.uuid
            : true;
          const isReviewer = currentUser
            ? (pr.reviewers || []).some((r) => r.uuid === currentUser.uuid)
            : false;

          if (!isAuthor && !isReviewer) continue;

          // Create as authored PR
          const externalId = `${repoSlug}#${pr.id}`;
          allOpenIds.push(externalId);
          const existing = await WorkItem.findOne({
            where: { externalId, externalSource: 'bitbucket' },
          });

          const prType = isReviewer && !isAuthor ? 'review' : 'pr';
          const prTitle = isReviewer && !isAuthor ? `Review: ${pr.title}` : `PR: ${pr.title}`;

          const data = {
            title: prTitle,
            externalId,
            externalUrl: pr.links?.html?.href || '',
            externalSource: 'bitbucket',
            type: prType,
            priority: prType === 'review' ? 2 : 1,
          };

          if (existing) {
            await existing.update({ title: data.title });
            updated++;
          } else {
            await WorkItem.create({ ...data, status: prType === 'review' ? 'inbox' : 'active' });
            created++;
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
      user: currentUser?.displayName || 'workspace token',
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
