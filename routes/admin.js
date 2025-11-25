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
// @desc    Get all users
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

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
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
    const { name, scriptName, sector, isin, cin, pan, description } = req.body;

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
      scriptName: scriptName && scriptName.trim() ? scriptName.trim() : null,
      sector: sector.trim(),
      logo: logoData,
      isin: isin && isin.trim() ? isin.trim() : null,
      cin: cin && cin.trim() ? cin.trim() : null,
      pan: pan && pan.trim() ? pan.trim() : null,
      description: description && description.trim() ? description.trim() : null
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
    next(error);
  }
});

// @route   PUT /api/admin/companies/:id
// @desc    Update company with logo upload
// @access  Admin
router.put('/companies/:id', upload.single('logo'), async (req, res, next) => {
  try {
    const { name, scriptName, sector, isin, cin, pan, description } = req.body;
    
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Update fields
    if (name && name.trim()) company.name = name.trim();
    if (scriptName !== undefined) company.scriptName = scriptName && scriptName.trim() ? scriptName.trim() : null;
    if (sector && sector.trim()) company.sector = sector.trim();
    if (isin !== undefined) company.isin = isin && isin.trim() ? isin.trim() : null;
    if (cin !== undefined) company.cin = cin && cin.trim() ? cin.trim() : null;
    if (pan !== undefined) company.pan = pan && pan.trim() ? pan.trim() : null;
    if (description !== undefined) company.description = description && description.trim() ? description.trim() : null;

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
