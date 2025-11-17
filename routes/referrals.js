import express from 'express';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/referrals/my-referrals
// @desc    Get user's referrals
// @access  Private
router.get('/my-referrals', protect, async (req, res, next) => {
  try {
    const referrals = await User.find({ 
      referredBy: req.user.username 
    }).select('username fullName avatar createdAt');

    res.json({
      success: true,
      data: referrals,
      total: referrals.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;
