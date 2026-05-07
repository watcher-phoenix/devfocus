/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig } = require('../database/models');

const BB_API = 'https://api.bitbucket.org/2.0';

async function syncBitbucket() {
  const integrationConfig = await IntegrationConfig.findOne({
    where: { provider: 'bitbucket', enabled: true },
  });

  if (!integrationConfig || !integrationConfig.config) {
    return { success: false, error: 'Bitbucket integration not configured' };
  }

  const config = JSON.parse(integrationConfig.config);
  const { workspace, username, appPassword, repos } = config;

  if (!workspace || !username || !appPassword) {
    return { success: false, error: 'Bitbucket config incomplete — need workspace, username, appPassword' };
  }

  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  try {
    let created = 0;
    let updated = 0;
    const repoList = repos
      ? repos.split(',').map((r) => r.trim()).filter(Boolean)
      : [];

    // Fetch PRs authored by user across repos
    for (const repoSlug of repoList) {
      // Open PRs authored by this user
      const prResponse = await axios.get(
        `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
        {
          headers,
          params: {
            state: 'OPEN',
            q: `author.username="${username}"`,
            pagelen: 20,
          },
        }
      ).catch(() => ({ data: { values: [] } }));

      for (const pr of (prResponse.data.values || [])) {
        const externalId = `${repoSlug}#${pr.id}`;
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
    }

    // Fetch PRs where user is a reviewer
    for (const repoSlug of repoList) {
      const reviewResponse = await axios.get(
        `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
        {
          headers,
          params: {
            state: 'OPEN',
            q: `reviewers.username="${username}"`,
            pagelen: 20,
          },
        }
      ).catch(() => ({ data: { values: [] } }));

      for (const pr of (reviewResponse.data.values || [])) {
        const externalId = `review:${repoSlug}#${pr.id}`;
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

    // Clean up PRs that are no longer open
    const allOpenIds = [];
    // Re-scan to build ID list
    for (const repoSlug of repoList) {
      const allPRs = await axios.get(
        `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
        { headers, params: { state: 'OPEN', pagelen: 50 } }
      ).catch(() => ({ data: { values: [] } }));

      for (const pr of (allPRs.data.values || [])) {
        allOpenIds.push(`${repoSlug}#${pr.id}`);
        allOpenIds.push(`review:${repoSlug}#${pr.id}`);
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

    return { success: true, created, updated };
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
