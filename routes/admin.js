import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Transaction from '../models/Transaction.js';
import Company from '../models/Company.js';
import Settings from '../models/Settings.js';
import Ad from '../models/Ad.js';
import ReferralTracking from '../models/ReferralTracking.js';
import UsernameHistory from '../models/UsernameHistory.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// All routes require admin role
router.use(protect, authorize('admin'));

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Admin
router.get('/stats', async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalListings = await Listing.countDocuments();
    const activeListings = await Listing.countDocuments({ status: 'active' });
    const totalCompanies = await Company.countDocuments();

    // Revenue stats
    const platformFees = await Transaction.aggregate([
      { $match: { type: 'platform_fee' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const boostFees = await Transaction.aggregate([
      { $match: { type: 'boost_fee' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRevenue = (platformFees[0]?.total || 0) + (boostFees[0]?.total || 0);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        activeListings,
        totalCompanies,
        revenue: {
          total: totalRevenue,
          platformFees: platformFees[0]?.total || 0,
          boostFees: boostFees[0]?.total || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with activity stats
// @access  Admin
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Get listing and trade counts for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const listingsCount = await Listing.countDocuments({ userId: user._id });
        const tradesCount = await Listing.countDocuments({ 
          userId: user._id, 
          status: 'sold' 
        });
        
        return {
          ...user.toObject(),
          listingsCount,
          tradesCount
        };
      })
    );

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/listings
// @desc    Get all listings for admin with filters
// @access  Admin
router.get('/listings', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, type, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Search by company name or username
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by type
    if (type) query.type = type;
    
    // Filter by status
    if (status) query.status = status;

    const listings = await Listing.find(query)
      .populate('userId', 'username email fullName')
      .populate('companyId', 'name scriptName logo sector')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Get platform settings for fee calculation
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    const platformFeePercentage = settings.platformFeePercentage || 2;

    // Add fee calculations to each listing
    const listingsWithFees = listings.map(listing => {
      const listingObj = listing.toObject();
      const baseAmount = listing.price * listing.quantity;
      const platformFee = (baseAmount * platformFeePercentage) / 100;
      const totalAmount = baseAmount + platformFee;
      
      return {
        ...listingObj,
        baseAmount,
        platformFee,
        platformFeePercentage,
        totalAmount
      };
    });

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listingsWithFees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/admin/listings/:id
// @desc    Delete a listing
// @access  Admin
router.delete('/listings/:id', async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    await listing.deleteOne();

    res.json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/listings/:id/status
// @desc    Update listing status
// @access  Admin
router.put('/listings/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    res.json({
      success: true,
      message: 'Listing status updated successfully',
      data: listing
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/transactions
// @desc    Get all transactions with filters
// @access  Admin
router.get('/transactions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status, search } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Filter by type
    if (type) {
      query.type = type;
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Search by company name or description
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const transactions = await Transaction.find(query)
      .populate('buyerId', 'username email fullName')
      .populate('sellerId', 'username email fullName')
      .populate('affiliateId', 'username email fullName')
      .populate('listingId', 'companyName type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    // Calculate stats
    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          platformFees: { 
            $sum: { 
              $cond: [{ $eq: ['$type', 'platform_fee'] }, '$amount', 0] 
            } 
          },
          boostFees: { 
            $sum: { 
              $cond: [{ $eq: ['$type', 'boost_fee'] }, '$amount', 0] 
            } 
          },
          commissions: { 
            $sum: { 
              $cond: [{ $eq: ['$type', 'affiliate_commission'] }, '$amount', 0] 
            } 
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: transactions,
      stats: stats[0] || { totalAmount: 0, platformFees: 0, boostFees: 0, commissions: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/reports
// @desc    Get detailed platform reports and analytics
// @access  Admin
router.get('/reports', async (req, res, next) => {
  try {
    const { period = '30' } = req.query; // days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // User growth
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: daysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Listing statistics
    const listingStats = await Listing.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$price', '$quantity'] } }
        }
      }
    ]);

    const listingsByStatus = await Listing.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Revenue breakdown
    const revenueByType = await Transaction.aggregate([
      { $match: { createdAt: { $gte: daysAgo } } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const revenueTimeline = await Transaction.aggregate([
      { $match: { createdAt: { $gte: daysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top performing companies
    const topCompanies = await Listing.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$companyName',
          totalListings: { $sum: 1 },
          totalValue: { $sum: { $multiply: ['$price', '$quantity'] } }
        }
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 }
    ]);

    // Active users statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
      lastLogin: { $gte: daysAgo } 
    });
    const bannedUsers = await User.countDocuments({ isBanned: true });

    // Transaction statistics
    const totalTransactions = await Transaction.countDocuments();
    const recentTransactions = await Transaction.countDocuments({ 
      createdAt: { $gte: daysAgo } 
    });

    res.json({
      success: true,
      data: {
        period: parseInt(period),
        overview: {
          totalUsers,
          activeUsers,
          bannedUsers,
          totalTransactions,
          recentTransactions
        },
        userGrowth,
        listingStats: {
          byType: listingStats,
          byStatus: listingsByStatus
        },
        revenue: {
          byType: revenueByType,
          timeline: revenueTimeline
        },
        topCompanies
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/users/:id/ban
// @desc    Ban/Unban user
// @access  Admin
router.put('/users/:id/ban', async (req, res, next) => {
  try {
    const { isBanned } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isBanned ? 'banned' : 'unbanned'} successfully`,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/admin/companies
// @desc    Create new company
// @access  Admin
router.post('/companies', async (req, res, next) => {
  try {
    const company = await Company.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/companies
// @desc    Get all companies with stats
// @access  Admin
router.get('/companies', async (req, res, next) => {
  try {
    const companies = await Company.find({}).sort({ name: 1 });

    // Get listing counts for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const listingsCount = await Listing.countDocuments({ 
          companyId: company._id,
          status: 'active'
        });
        
        return {
          ...company.toObject(),
          listingsCount
        };
      })
    );

    res.json({
      success: true,
      count: companiesWithStats.length,
      companies: companiesWithStats
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/admin/companies
// @desc    Create new company with logo upload
// @access  Admin
router.post('/companies', upload.single('logo'), async (req, res, next) => {
  try {
    const { name, scriptName, sector, isin, cin, pan, registrationDate, description } = req.body;

    // Check if company already exists
    const existingCompany = await Company.findOne({ name: name.trim() });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name already exists'
      });
    }

    // Handle logo upload - convert to base64 if file provided
    let logoData = null;
    if (req.file) {
      logoData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const company = await Company.create({
      name: name.trim(),
      scriptName: (scriptName && scriptName.trim()) ? scriptName.trim() : null,
      sector: sector.trim(),
      logo: logoData,
      isin: (isin && isin.trim()) ? isin.trim() : null,
      cin: (cin && cin.trim()) ? cin.trim() : null,
      pan: (pan && pan.trim()) ? pan.trim() : null,
      registrationDate: registrationDate ? new Date(registrationDate) : null,
      description: (description && description.trim()) ? description.trim() : null
    });

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name already exists'
      });
    }
    // Better error handling for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    console.error('Company create error:', error);
    next(error);
  }
});

// @route   PUT /api/admin/companies/:id
// @desc    Update company with logo upload
// @access  Admin
router.put('/companies/:id', upload.single('logo'), async (req, res, next) => {
  try {
    const { name, scriptName, sector, isin, cin, pan, registrationDate, description } = req.body;
    
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Update fields with proper null handling
    if (name && name.trim()) company.name = name.trim();
    company.scriptName = (scriptName && scriptName.trim()) ? scriptName.trim() : null;
    if (sector && sector.trim()) company.sector = sector.trim();
    company.isin = (isin && isin.trim()) ? isin.trim() : null;
    company.cin = (cin && cin.trim()) ? cin.trim() : null;
    company.pan = (pan && pan.trim()) ? pan.trim() : null;
    company.registrationDate = registrationDate ? new Date(registrationDate) : null;
    company.description = (description && description.trim()) ? description.trim() : null;

    // Handle logo upload
    if (req.file) {
      company.logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await company.save();

    res.json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name already exists'
      });
    }
    // Better error handling for validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    console.error('Company update error:', error);
    next(error);
  }
});

// @route   DELETE /api/admin/companies/:id
// @desc    Delete company
// @access  Admin
router.delete('/companies/:id', async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if company has active listings
    const activeListings = await Listing.countDocuments({
      companyId: company._id,
      status: 'active'
    });

    if (activeListings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete company with ${activeListings} active listings`
      });
    }

    await company.deleteOne();

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/settings
// @desc    Get platform settings
// @access  Admin
router.get('/settings', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await Settings.create({});
    }

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/settings
// @desc    Update platform settings
// @access  Admin
router.put('/settings', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      // Update all provided fields
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          settings[key] = req.body[key];
        }
      });
      settings.lastUpdatedBy = req.user._id;
      await settings.save();
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

// ==================== AD MANAGEMENT ROUTES ====================

// @route   GET /api/admin/ads
// @desc    Get all ads with filters
// @access  Admin
router.get('/ads', async (req, res, next) => {
  try {
    const { status, position, search, sortBy = '-createdAt' } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (position) query.position = position;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const ads = await Ad.find(query)
      .populate('createdBy', 'name email')
      .sort(sortBy)
      .lean();

    // Calculate stats
    const totalAds = ads.length;
    const activeAds = ads.filter(ad => ad.status === 'active').length;
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: ads,
      stats: {
        totalAds,
        activeAds,
        totalImpressions,
        totalClicks,
        avgCTR
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/admin/ads
// @desc    Create new ad
// @access  Admin
router.post('/ads', async (req, res, next) => {
  try {
    const adData = {
      ...req.body,
      createdBy: req.user._id
    };

    const ad = await Ad.create(adData);

    res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      data: ad
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/ads/:id
// @desc    Get single ad
// @access  Admin
router.get('/ads/:id', async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    res.json({
      success: true,
      data: ad
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/ads/:id
// @desc    Update ad
// @access  Admin
router.put('/ads/:id', async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        ad[key] = req.body[key];
      }
    });

    await ad.save();

    res.json({
      success: true,
      message: 'Ad updated successfully',
      data: ad
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/ads/:id/status
// @desc    Update ad status
// @access  Admin
router.put('/ads/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'paused', 'expired'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    ad.status = status;
    await ad.save();

    res.json({
      success: true,
      message: `Ad ${status} successfully`,
      data: ad
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/admin/ads/:id
// @desc    Delete ad
// @access  Admin
router.delete('/ads/:id', async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    await ad.deleteOne();

    res.json({
      success: true,
      message: 'Ad deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ==================== REFERRAL TRACKING ROUTES ====================

// @route   GET /api/admin/referrals/stats
// @desc    Get referral tracking overview stats
// @access  Admin
router.get('/referrals/stats', async (req, res, next) => {
  try {
    const totalReferrals = await ReferralTracking.countDocuments();
    const pendingReferrals = await ReferralTracking.countDocuments({ status: 'pending' });
    const approvedReferrals = await ReferralTracking.countDocuments({ status: 'approved' });
    const paidReferrals = await ReferralTracking.countDocuments({ status: 'paid' });

    // Calculate total amounts
    const totalDealAmount = await ReferralTracking.aggregate([
      { $group: { _id: null, total: { $sum: '$dealAmount' } } }
    ]);

    const totalPlatformRevenue = await ReferralTracking.aggregate([
      { $group: { _id: null, total: { $sum: '$platformRevenue' } } }
    ]);

    const totalReferralAmount = await ReferralTracking.aggregate([
      { $group: { _id: null, total: { $sum: '$referralAmount' } } }
    ]);

    const pendingReferralAmount = await ReferralTracking.aggregate([
      { $match: { status: { $in: ['pending', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$referralAmount' } } }
    ]);

    const paidReferralAmount = await ReferralTracking.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$referralAmount' } } }
    ]);

    // Top referrers
    const topReferrers = await ReferralTracking.aggregate([
      { $group: { 
          _id: '$referrer', 
          referrerName: { $first: '$referrerName' },
          totalDeals: { $sum: 1 },
          totalEarnings: { $sum: '$referralAmount' }
        } 
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalReferrals,
          pendingReferrals,
          approvedReferrals,
          paidReferrals
        },
        financial: {
          totalDealAmount: totalDealAmount[0]?.total || 0,
          totalPlatformRevenue: totalPlatformRevenue[0]?.total || 0,
          totalReferralAmount: totalReferralAmount[0]?.total || 0,
          pendingReferralAmount: pendingReferralAmount[0]?.total || 0,
          paidReferralAmount: paidReferralAmount[0]?.total || 0
        },
        topReferrers
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/referrals
// @desc    Get all referral tracking records with filters
// @access  Admin
router.get('/referrals', async (req, res, next) => {
  try {
    const { status, referrer, search, sortBy = '-createdAt', startDate, endDate } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (referrer) query.referrer = referrer;
    if (search) {
      query.$or = [
        { referrerName: { $regex: search, $options: 'i' } },
        { refereeName: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const referrals = await ReferralTracking.find(query)
      .populate('referrer', 'name email phone')
      .populate('referee', 'name email phone')
      .populate('company', 'name logo')
      .populate('listing', 'type quantity price')
      .sort(sortBy)
      .lean();

    // Calculate stats for filtered results
    const totalDealAmount = referrals.reduce((sum, ref) => sum + ref.dealAmount, 0);
    const totalPlatformRevenue = referrals.reduce((sum, ref) => sum + ref.platformRevenue, 0);
    const totalReferralAmount = referrals.reduce((sum, ref) => sum + ref.referralAmount, 0);

    res.json({
      success: true,
      data: referrals,
      stats: {
        count: referrals.length,
        totalDealAmount,
        totalPlatformRevenue,
        totalReferralAmount
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/referrals/:id
// @desc    Get single referral tracking record
// @access  Admin
router.get('/referrals/:id', async (req, res, next) => {
  try {
    const referral = await ReferralTracking.findById(req.params.id)
      .populate('referrer', 'name email phone')
      .populate('referee', 'name email phone')
      .populate('company', 'name logo')
      .populate('listing', 'type quantity price status')
      .populate('transaction');

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral record not found'
      });
    }

    res.json({
      success: true,
      data: referral
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/referrals/:id/status
// @desc    Update referral status (approve/reject/paid)
// @access  Admin
router.put('/referrals/:id/status', async (req, res, next) => {
  try {
    const { status, paymentMethod, paymentReference, notes } = req.body;

    if (!['pending', 'approved', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const referral = await ReferralTracking.findById(req.params.id);

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral record not found'
      });
    }

    referral.status = status;
    if (status === 'paid') {
      referral.paidAt = new Date();
      if (paymentMethod) referral.paymentMethod = paymentMethod;
      if (paymentReference) referral.paymentReference = paymentReference;
    }
    if (notes) referral.notes = notes;

    await referral.save();

    res.json({
      success: true,
      message: `Referral ${status} successfully`,
      data: referral
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/admin/referrals/:id
// @desc    Update referral details
// @access  Admin
router.put('/referrals/:id', async (req, res, next) => {
  try {
    const referral = await ReferralTracking.findById(req.params.id);

    if (!referral) {
      return res.status(404).json({
        success: false,
        message: 'Referral record not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['notes', 'paymentMethod', 'paymentReference'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        referral[field] = req.body[field];
      }
    });

    await referral.save();

    res.json({
      success: true,
      message: 'Referral updated successfully',
      data: referral
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/username-history/:userId
// @desc    Get username change history for a specific user
// @access  Admin
router.get('/username-history/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('username previousUsernames email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all username history from UsernameHistory collection
    const history = await UsernameHistory.find({ userId: user._id })
      .sort({ changedAt: -1 });

    res.json({
      success: true,
      data: {
        currentUsername: user.username,
        email: user.email,
        previousUsernames: user.previousUsernames || [],
        fullHistory: history
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/admin/check-username/:username
// @desc    Check if username was ever used before
// @access  Admin
router.get('/check-username/:username', async (req, res, next) => {
  try {
    const username = req.params.username.toLowerCase();
    
    // Check current users
    const currentUser = await User.findOne({ username }).select('username email createdAt');
    
    // Check username history
    const history = await UsernameHistory.findOne({ username })
      .populate('userId', 'username email');

    if (!currentUser && !history) {
      return res.json({
        success: true,
        available: true,
        message: 'Username is available and has never been used'
      });
    }

    res.json({
      success: true,
      available: false,
      data: {
        currentlyUsedBy: currentUser ? {
          username: currentUser.username,
          email: currentUser.email,
          createdAt: currentUser.createdAt
        } : null,
        previouslyUsedBy: history ? {
          username: history.userId.username,
          email: history.userId.email,
          changedAt: history.changedAt,
          reason: history.reason
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
