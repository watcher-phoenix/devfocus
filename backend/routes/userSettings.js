const { Router } = require('express');
const { UserSettings } = require('../database/models');

const router = Router();

async function getOrCreate() {
  let settings = await UserSettings.findOne();
  if (!settings) {
    settings = await UserSettings.create({});
  }
  return settings;
}

router.get('/', async (req, res) => {
  const settings = await getOrCreate();
  res.json(settings);
});

router.put('/', async (req, res) => {
  const settings = await getOrCreate();
  await settings.update(req.body);
  res.json(settings);
});

module.exports = router;
