import express from 'express';
import multer from 'multer';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Transaction from '../models/Transaction.js';
import Company from '../models/Company.js';
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

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      data: listings,
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

export default router;
