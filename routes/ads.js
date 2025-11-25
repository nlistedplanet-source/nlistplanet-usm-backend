import express from 'express';
import Ad from '../models/Ad.js';

const router = express.Router();

// @route   GET /api/ads
// @desc    Get active ads by position (public endpoint for frontend display)
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const { position } = req.query;
    const now = new Date();

    // Build query for active ads within date range
    const query = {
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now }
    };

    if (position) {
      query.position = position;
    }

    // Get ads sorted by priority (descending) and creation date
    const ads = await Ad.find(query)
      .select('title description imageUrl targetUrl position priority impressions')
      .sort('-priority -createdAt')
      .limit(position ? 10 : 20) // Limit based on whether position filter is applied
      .lean();

    res.json({
      success: true,
      data: ads
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/ads/:id/impression
// @desc    Track ad impression
// @access  Public
router.post('/:id/impression', async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Increment impression count
    ad.impressions += 1;
    await ad.save();

    res.json({
      success: true,
      message: 'Impression tracked'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/ads/:id/click
// @desc    Track ad click
// @access  Public
router.post('/:id/click', async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Increment click count
    ad.clicks += 1;
    await ad.save();

    res.json({
      success: true,
      message: 'Click tracked',
      targetUrl: ad.targetUrl
    });
  } catch (error) {
    next(error);
  }
});

export default router;
