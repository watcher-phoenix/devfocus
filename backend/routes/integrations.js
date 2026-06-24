const { Router } = require('express');
const { IntegrationConfig } = require('../database/models');
const { syncProvider } = require('../services/sync');

const router = Router();

// List all integration configs
router.get('/', async (req, res) => {
  const configs = await IntegrationConfig.findAll();
  const safe = configs.map((c) => ({
    ...c.toJSON(),
    config: c.config ? { configured: true, ...safeConfigSummary(c.provider, c.config) } : null,
  }));
  res.json(safe);
});

// Get or create a specific integration config
router.get('/:provider', async (req, res) => {
  let config = await IntegrationConfig.findOne({ where: { provider: req.params.provider } });
  if (!config) {
    config = await IntegrationConfig.create({ provider: req.params.provider });
  }
  res.json({
    ...config.toJSON(),
    config: config.config ? { configured: true, ...safeConfigSummary(config.provider, config.config) } : null,
  });
});

// Update integration config
router.put('/:provider', async (req, res) => {
  let config = await IntegrationConfig.findOne({ where: { provider: req.params.provider } });

  const updateData = { ...req.body };
  if (updateData.config && typeof updateData.config === 'object') {
    // Merge into the existing config rather than replacing it, so a partial
    // update (e.g. setting the calendar's fallback ICS URL) doesn't wipe
    // server-managed secrets like the stored Graph token cache.
    const existing = config && config.config ? JSON.parse(config.config) : {};
    updateData.config = JSON.stringify({ ...existing, ...updateData.config });
  }

  if (!config) {
    config = await IntegrationConfig.create({ provider: req.params.provider, ...updateData });
  } else {
    await config.update(updateData);
  }

  res.json({
    ...config.toJSON(),
    config: config.config ? { configured: true, ...safeConfigSummary(config.provider, config.config) } : null,
  });
});

// Trigger sync for a provider
router.post('/:provider/sync', async (req, res) => {
  const config = await IntegrationConfig.findOne({
    where: { provider: req.params.provider, enabled: true },
  });

  if (!config) {
    return res.status(400).json({ error: `${req.params.provider} is not enabled` });
  }

  const result = await syncProvider(req.params.provider);
  return res.json(result);
});

// Test connection for a provider
router.post('/:provider/test', async (req, res) => {
  const config = await IntegrationConfig.findOne({ where: { provider: req.params.provider } });
  if (!config || !config.config) {
    return res.status(400).json({ error: 'Not configured' });
  }

  try {
    const result = await syncProvider(req.params.provider);
    return res.json({ success: result.success, message: result.error || 'Connection successful' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Return safe config summary without secrets
function safeConfigSummary(provider, configStr) {
  try {
    const parsed = JSON.parse(configStr);
    switch (provider) {
      case 'jira':
        return { baseUrl: parsed.baseUrl, email: parsed.email, projectKeys: parsed.projectKeys };
      case 'bitbucket':
        return { workspace: parsed.workspace, username: parsed.username, repos: parsed.repos, hasAccessToken: !!parsed.accessToken };
      case 'calendar':
        if (parsed.authMethod === 'graph' || parsed.homeAccountId) {
          return { authMethod: 'graph', account: parsed.account || null, icsFallback: parsed.icsUrl || '' };
        }
        return { authMethod: parsed.icsUrl ? 'ics' : null, icsUrl: parsed.icsUrl ? '(configured)' : null };
      default:
        return {};
    }
  } catch {
    return {};
  }
}

module.exports = router;
