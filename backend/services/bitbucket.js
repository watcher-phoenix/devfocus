/* eslint-disable no-console */
const axios = require('axios');
const { WorkItem, IntegrationConfig, Project } = require('../database/models');
const { Op } = require('sequelize');

const BB_API = 'https://api.bitbucket.org/2.0';

function getHeaders(config) {
  if (config.accessToken) {
    return { Authorization: `Bearer ${config.accessToken}` };
  }
  const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
  return { Authorization: `Basic ${auth}` };
}

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

async function getCurrentUser(headers) {
  try {
    const response = await axios.get(`${BB_API}/user`, { headers });
    return { uuid: response.data.uuid, displayName: response.data.display_name };
  } catch { return null; }
}

async function findProjectForRepo(repoSlug) {
  const projects = await Project.findAll({ where: { archived: false } });
  for (const project of projects) {
    if (!project.repoSlug) continue;
    const slugs = project.repoSlug.split(',').map((s) => s.trim().toLowerCase());
    if (slugs.includes(repoSlug.toLowerCase())) return project.id;
  }
  return null;
}

function makeMatchesUser(currentUser, config) {
  return (user) => {
    if (!user) return false;
    if (currentUser && user.uuid === currentUser.uuid) return true;
    // Match against all configured identifiers
    const identifiers = [];
    if (config.username) identifiers.push(config.username.toLowerCase());
    if (config.displayName) identifiers.push(config.displayName.toLowerCase());

    if (identifiers.length > 0) {
      const userFields = [
        (user.username || '').toLowerCase(),
        (user.nickname || '').toLowerCase(),
        (user.display_name || '').toLowerCase(),
      ].filter(Boolean);
      return identifiers.some((id) => userFields.includes(id));
    }
    return false;
  };
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
    return { success: false, error: 'Need workspace' };
  }
  if (!config.accessToken && (!config.username || !config.appPassword)) {
    return { success: false, error: 'Need access token or username + app password' };
  }

  const headers = getHeaders(config);

  try {
    const currentUser = await getCurrentUser(headers);
    const matchesUser = makeMatchesUser(currentUser, config);

    let repoList;
    if (config.repos) {
      repoList = config.repos.split(',').map((r) => r.trim()).filter(Boolean);
    } else {
      repoList = await fetchAllRepos(workspace, headers);
    }

    if (repoList.length === 0) {
      return { success: false, error: 'No repos found.' };
    }

    // Get Jira keys to match PRs against
    const myJiraKeys = [];
    try {
      const jiraItems = await WorkItem.findAll({
        where: { externalSource: 'jira', status: { [Op.ne]: 'done' } },
        attributes: ['externalId'],
      });
      jiraItems.forEach((i) => { if (i.externalId) myJiraKeys.push(i.externalId.toUpperCase()); });
    } catch { /* */ }

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const allOpenIds = [];
    const errors = [];

    for (const repoSlug of repoList) {
      try {
        const prResponse = await axios.get(
          `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
          { headers, params: { state: 'OPEN', pagelen: 50 } }
        );

        for (const pr of (prResponse.data.values || [])) {
          const externalId = `${repoSlug}#${pr.id}`;
          const existing = await WorkItem.findOne({
            where: { externalId, externalSource: 'bitbucket' },
          });

          const isAuthor = matchesUser(pr.author);
          const prText = `${pr.title} ${pr.source?.branch?.name || ''}`.toUpperCase();
          const isLinkedToMyJira = myJiraKeys.some((key) => prText.includes(key));

          // Check if user approved this PR by fetching individual PR for participants
          let hasApproved = false;
          if (!isAuthor && !isLinkedToMyJira) {
            // Fetch individual PR to check if user approved it
            try {
              const prDetail = await axios.get(
                `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests/${pr.id}`,
                { headers }
              );
              const participants = prDetail.data.participants || [];
              hasApproved = participants.some((p) => {
                const userMatch = matchesUser(p.user);
                // Bitbucket uses approved: true or state: "approved"
                const isApproved = p.approved === true || (p.state || '').toUpperCase() === 'APPROVED';
                return userMatch && isApproved;
              });
            } catch (err) {
              console.error(`[bitbucket] Error checking approval for ${repoSlug}#${pr.id}:`, err.message);
            }
          }

          const shouldImport = isAuthor || isLinkedToMyJira || hasApproved;

          if (!shouldImport) {
            if (existing) { await existing.destroy(); deleted++; }
            continue;
          }

          allOpenIds.push(externalId);
          const projectId = await findProjectForRepo(repoSlug);

          let prType = 'pr';
          let prTitle = `PR: ${pr.title}`;
          let status = 'active';

          // Use PR's updated_on as the real completion timestamp
          const prCompletedAt = pr.updated_on ? new Date(pr.updated_on) : new Date();

          if (hasApproved && !isAuthor) {
            prType = 'pr-review';
            prTitle = `Approved: ${pr.title}`;
            status = 'done';
          } else if (isLinkedToMyJira && !isAuthor) {
            prType = 'pr-review';
            prTitle = `PR (Jira): ${pr.title}`;
            status = 'inbox';
          }

          const data = {
            title: prTitle,
            externalId,
            externalUrl: pr.links?.html?.href || '',
            externalSource: 'bitbucket',
            type: prType,
            priority: 1,
            projectId,
          };

          if (existing) {
            const updates = { title: data.title, projectId: projectId || existing.projectId };
            if (hasApproved && !isAuthor && existing.status !== 'done') {
              updates.status = 'done';
              updates.completedAt = prCompletedAt;
            }
            await existing.update(updates);
            updated++;
          } else {
            await WorkItem.create({
              ...data,
              status,
              completedAt: status === 'done' ? prCompletedAt : null,
            });
            created++;
          }
        }
      } catch (err) {
        errors.push(`${repoSlug}: ${err.response?.data?.error?.message || err.message}`);
      }
    }

    // Catch recently merged PRs that may have been missed between sync cycles
    const mergedSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    for (const repoSlug of repoList) {
      try {
        const mergedResponse = await axios.get(
          `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests`,
          { headers, params: { state: 'MERGED', q: `updated_on > ${mergedSince}`, pagelen: 50 } }
        );

        for (const pr of (mergedResponse.data.values || [])) {
          const externalId = `${repoSlug}#${pr.id}`;
          if (allOpenIds.includes(externalId)) continue;

          const existing = await WorkItem.findOne({
            where: { externalId, externalSource: 'bitbucket' },
          });
          if (existing && existing.status === 'done') continue;

          const isAuthor = matchesUser(pr.author);
          const prText = `${pr.title} ${pr.source?.branch?.name || ''}`.toUpperCase();
          const isLinkedToMyJira = myJiraKeys.some((key) => prText.includes(key));

          let hasApproved = false;
          if (!isAuthor && !isLinkedToMyJira) {
            const participants = pr.participants || [];
            hasApproved = participants.some((p) => {
              const userMatch = matchesUser(p.user);
              const isApproved = p.approved === true || (p.state || '').toUpperCase() === 'APPROVED';
              return userMatch && isApproved;
            });
          }

          if (!isAuthor && !isLinkedToMyJira && !hasApproved) continue;

          const projectId = await findProjectForRepo(repoSlug);
          const prCompletedAt = pr.updated_on ? new Date(pr.updated_on) : new Date();

          let prType = 'pr';
          let prTitle = `PR: ${pr.title}`;
          if ((hasApproved || isLinkedToMyJira) && !isAuthor) {
            prType = 'pr-review';
            prTitle = hasApproved ? `Approved: ${pr.title}` : `PR (Jira): ${pr.title}`;
          }

          if (existing) {
            await existing.update({
              title: prTitle,
              status: 'done',
              completedAt: prCompletedAt,
              projectId: projectId || existing.projectId,
            });
            updated++;
          } else {
            await WorkItem.create({
              title: prTitle,
              externalId,
              externalUrl: pr.links?.html?.href || '',
              externalSource: 'bitbucket',
              type: prType,
              priority: 1,
              projectId,
              status: 'done',
              completedAt: prCompletedAt,
            });
            created++;
          }
          allOpenIds.push(externalId);
        }
      } catch (err) {
        errors.push(`${repoSlug} (merged): ${err.response?.data?.error?.message || err.message}`);
      }
    }

    // Handle PRs no longer open — mark merged ones done, declined/superseded as cancelled
    const staleItems = await WorkItem.findAll({
      where: {
        externalSource: 'bitbucket',
        status: { [Op.notIn]: ['done', 'cancelled'] },
        ...(allOpenIds.length > 0
          ? { externalId: { [Op.notIn]: allOpenIds } }
          : {}),
      },
    });

    let markedDone = 0;
    let markedCancelled = 0;
    for (const item of staleItems) {
      const [repoSlug, prId] = item.externalId.split('#');
      try {
        const prDetail = await axios.get(
          `${BB_API}/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
          { headers }
        );
        if (prDetail.data.state === 'MERGED') {
          await item.update({
            status: 'done',
            completedAt: prDetail.data.updated_on ? new Date(prDetail.data.updated_on) : new Date(),
          });
          markedDone++;
        } else if (prDetail.data.state === 'DECLINED' || prDetail.data.state === 'SUPERSEDED') {
          await item.update({ status: 'cancelled' });
          markedCancelled++;
        } else {
          await item.destroy();
          deleted++;
        }
      } catch {
        await item.destroy();
        deleted++;
      }
    }

    await integrationConfig.update({
      lastSyncAt: new Date(),
      lastSyncStatus: errors.length > 0 ? 'partial' : 'success',
    });

    return { success: true, created, updated, deleted, markedDone, markedCancelled, repos: repoList.length, user: currentUser?.displayName || 'workspace token', errors: errors.length > 0 ? errors : undefined };
  } catch (err) {
    console.error('Bitbucket sync error:', err.response?.data || err.message);
    await integrationConfig.update({ lastSyncAt: new Date(), lastSyncStatus: 'error' });
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

module.exports = { syncBitbucket };
