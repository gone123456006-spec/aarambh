const express = require('express');
const { body } = require('express-validator');
const gameController = require('../controllers/gameController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/progress', protect, gameController.getGameProgress);

router.post(
  '/progress',
  protect,
  [
    body('gameId')
      .isIn(['quiz', 'scramble', 'fill', 'flash'])
      .withMessage('Invalid game type identifier'),
    body('level').optional().isInt({ min: 0 }).withMessage('Level must be a non-negative integer'),
    body('score').optional().isInt({ min: 0 }).withMessage('Score must be a non-negative integer'),
    body('completed').optional().isBoolean().withMessage('completed must be a boolean value'),
  ],
  validate,
  gameController.saveGameProgress
);

router.post(
  '/score',
  protect,
  [
    body('gameId')
      .isIn(['quiz', 'scramble', 'fill', 'flash'])
      .withMessage('Invalid game type identifier'),
    body('isCorrect').isBoolean().withMessage('isCorrect must be a boolean value'),
  ],
  validate,
  gameController.recordAnswer
);

router.get('/total-score', protect, gameController.getTotalScore);

module.exports = router;
