const { Router } = require('express');
const { IntegrationConfig } = require('../database/models');

const router = Router();

router.get('/', async (req, res) => {
  const configs = await IntegrationConfig.findAll();
  // Strip sensitive config data from response
  const safe = configs.map((c) => ({
    ...c.toJSON(),
    config: c.config ? { configured: true } : null,
  }));
  res.json(safe);
});

router.put('/:provider', async (req, res) => {
  let config = await IntegrationConfig.findOne({ where: { provider: req.params.provider } });
  if (!config) {
    config = await IntegrationConfig.create({ provider: req.params.provider, ...req.body });
  } else {
    await config.update(req.body);
  }
  res.json({
    ...config.toJSON(),
    config: config.config ? { configured: true } : null,
  });
});

router.post('/:provider/sync', async (req, res) => {
  // Placeholder — will be wired up in Phase 3/4
  res.json({ message: `Sync for ${req.params.provider} not yet implemented` });
});

router.get('/:provider/status', async (req, res) => {
  const config = await IntegrationConfig.findOne({ where: { provider: req.params.provider } });
  if (!config) return res.status(404).json({ error: 'Integration not found' });
  return res.json({
    provider: config.provider,
    enabled: config.enabled,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
  });
});

module.exports = router;
