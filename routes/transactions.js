import express from 'express';
import Transaction from '../models/Transaction.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/transactions/my-earnings
// @desc    Get user's affiliate earnings
// @access  Private
router.get('/my-earnings', protect, async (req, res, next) => {
  try {
    const earnings = await Transaction.find({
      affiliateId: req.user._id,
      type: 'affiliate_commission'
    }).sort('-createdAt');

    const totalEarnings = earnings.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      data: earnings,
      totalEarnings
    });
  } catch (error) {
    next(error);
  }
});

export default router;
