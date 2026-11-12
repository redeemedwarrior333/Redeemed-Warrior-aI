const express = require('express');

const requireMember = require('../middleware/memberAuth');
const members = require('../services/members');
const fileStore = require('../services/fileStore');

const router = express.Router();

router.use(requireMember);
router.use((req, res, next) => {
  if (!members.isOwner(req.member)) {
    return res.status(403).json({ error: { message: 'Owner access only.' } });
  }
  next();
});

router.get('/', async (req, res, next) => {
  try {
    const files = await fileStore.list();
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, data } = req.body || {};
    const file = await fileStore.upload(name, data);
    res.status(201).json({ file });
  } catch (err) {
    next(err);
  }
});

router.delete('/:name', async (req, res, next) => {
  try {
    const result = await fileStore.remove(req.params.name);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
