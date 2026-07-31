const express = require('express');
const { body } = require('express-validator');
const subscriptionController = require('../controllers/subscriptionController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/me', protect, subscriptionController.getMySubscription);

router.post('/create-order', protect, subscriptionController.createOrder);

router.post(
  '/verify-payment',
  protect,
  [
    body('razorpay_order_id').trim().notEmpty().withMessage('razorpay_order_id is required'),
    body('razorpay_payment_id').trim().notEmpty().withMessage('razorpay_payment_id is required'),
    body('razorpay_signature').trim().notEmpty().withMessage('razorpay_signature is required'),
  ],
  validate,
  subscriptionController.verifyPayment
);

module.exports = router;
