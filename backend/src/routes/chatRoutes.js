const express = require('express');
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/sessions', protect, chatController.getSessions);

router.get('/history/:sessionId', protect, chatController.getHistory);

module.exports = router;
