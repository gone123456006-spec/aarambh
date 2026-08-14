const express = require('express');
const gameQuestionController = require('../controllers/gameQuestionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Frontend routes for fetching game questions (protected, any logged-in user)
router.use(protect);

// Get level configuration for a game
router.get('/:gameId/levels', gameQuestionController.getGameLevelConfig);

// Get questions for a specific game and level
router.get('/:gameId/levels/:level', gameQuestionController.getQuestionsByLevel);

module.exports = router;
