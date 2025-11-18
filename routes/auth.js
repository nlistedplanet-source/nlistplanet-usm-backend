import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Generate Funny Username
const generateFunnyUsername = () => {
  const prefixes = [
    'ironman', 'batman', 'superman', 'spiderman', 'thor', 'hulk', 'captainamerica', 'blackwidow',
    'rajnikant', 'salmankhan', 'shahrukhkhan', 'amitabhbachchan', 'akshaykumar', 'hrithikroshan',
    'deepikapadukone', 'priyankachopra', 'katrinakaif', 'aliabhatt',
    'sherlock', 'jonsnow', 'tyrionlannister', 'tonystark', 'brucewayne',
    'delhi', 'mumbai', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'goa',
    'wolf', 'tiger', 'lion', 'eagle', 'falcon', 'panther', 'cobra', 'dragon',
    'ninja', 'samurai', 'warrior', 'knight', 'viking', 'spartan',
    'einstein', 'newton', 'tesla', 'edison', 'darwin',
    'crypto', 'stock', 'trader', 'investor', 'whale', 'bull', 'bear',
    'rockstar', 'legend', 'champion', 'master', 'boss', 'king', 'queen',
    'pixel', 'byte', 'quantum', 'matrix', 'cyber', 'tech', 'digital'
  ];
  
  const suffixes = [
    'trader', 'investor', 'pro', 'master', 'king', 'queen', 'boss', 'legend',
    'warrior', 'hero', 'star', 'genius', 'wizard', 'ninja', 'samurai',
    'returns', 'gains', 'profits', 'wealth', 'rich', 'millionaire',
    'hustler', 'grinder', 'player', 'gamer', 'winner', 'champion',
    'alpha', 'sigma', 'omega', 'prime', 'elite', 'supreme',
    '001', '247', '360', '007', '420', '786', '999'
  ];
  
  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${randomPrefix}_${randomSuffix}`;
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Auth specific rate limiter (mitigate brute force & abuse)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many requests. Please try later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation chains - bank-level security (alphanumeric only - no symbols to avoid XSS warnings)
const registerValidation = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail().isLength({ max: 254 }),
  body('password').isLength({ min: 12, max: 128 }).withMessage('Password must be 12-128 characters').custom(val => {
    // Require: uppercase, lowercase, numbers (no special chars to prevent XSS warning)
    const hasUpper = /[A-Z]/.test(val);
    const hasLower = /[a-z]/.test(val);
    const hasNum = /[0-9]/.test(val);
    const hasOnlyAlphaNum = /^[a-zA-Z0-9]+$/.test(val);
    if (!hasUpper || !hasLower || !hasNum) {
      throw new Error('Password must include uppercase, lowercase, and numbers');
    }
    if (!hasOnlyAlphaNum) {
      throw new Error('Password can only contain letters and numbers');
    }
    return true;
  }),
  body('fullName').isLength({ min: 3, max: 100 }).withMessage('Full name must be 3-100 characters').trim().escape(),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits').trim(),
  body('referredBy').optional().isString().trim().escape().isLength({ max: 20 })
];

const loginValidation = [
  body('username').isString().trim().escape().isLength({ min: 1, max: 254 }).withMessage('Username or email required'),
  body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Password required')
];

// Audit logging helper - bank-level audit trail for compliance
const logAuthEvent = (event, username, status, ip, userAgent) => {
  const timestamp = new Date().toISOString();
  // Sanitize inputs to prevent log injection attacks
  const sanitizedUsername = (username?.substring(0, 50) || 'unknown').replace(/[\n\r]/g, '');
  const sanitizedIp = (ip?.substring(0, 45) || 'unknown').replace(/[\n\r]/g, '');
  const logEntry = {
    timestamp,
    event,
    username: sanitizedUsername,
    status,
    ip: sanitizedIp,
    userAgent: (userAgent?.substring(0, 100) || 'unknown').replace(/[\n\r]/g, '')
  };
  console.log(`[AUTH_AUDIT] ${JSON.stringify(logEntry)}`);
};

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    logAuthEvent('validation_error', req.body.username || req.body.email, 'failed', ip, req.headers['user-agent']);
    // Generic response to prevent information disclosure
    return res.status(400).json({ success: false, message: 'Validation failed. Please check input requirements.' });
  }
  next();
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post(
  '/register',
  authLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 12, max: 128 }).matches(/^[a-zA-Z0-9]+$/).withMessage('Password: 12-128 alphanumeric'),
  body('fullName').isLength({ min: 3, max: 100 }).trim().escape(),
  body('phone').matches(/^[0-9]{10}$/),
  body('referredBy').optional().isString().trim().escape().isLength({ max: 20 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      logAuthEvent('validation_error', req.body?.email, 'failed', ip, req.headers['user-agent']);
      return res.status(400).json({ success: false, message: 'Invalid input format' });
    }
    next();
  },
  async (req, res, next) => {
  try {
    let { username, email, password, fullName, phone, referredBy } = req.body;

    // Auto-generate username if not provided
    if (!username || username.trim() === '') {
      username = generateFunnyUsername();
      let usernameExists = await User.findOne({ username: username.toLowerCase() });
      
      // Keep generating until we get a unique username
      while (usernameExists) {
        username = generateFunnyUsername();
        usernameExists = await User.findOne({ username: username.toLowerCase() });
      }
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username: username.toLowerCase() }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Validate referral code if provided
    let referrer = null;
    if (referredBy) {
      referrer = await User.findOne({ username: referredBy.toLowerCase() });
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
      }
    }

    // Create user
    const user = await User.create({
      username: username.toLowerCase(),
      email,
      password,
      fullName,
      phone,
      referredBy: referrer ? referrer.username : null
    });

    // Update referrer stats if exists
    if (referrer) {
      referrer.totalReferrals += 1;
      await referrer.save();
    }

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    logAuthEvent('register_success', email, 'success', ip, req.headers['user-agent']);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  authLimiter,
  body('username').isString().trim().escape().isLength({ min: 1, max: 254 }),
  body('password').isString().isLength({ min: 1, max: 128 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      logAuthEvent('validation_error', req.body?.username, 'failed', ip, req.headers['user-agent']);
      return res.status(400).json({ success: false, message: 'Invalid input format' });
    }
    next();
  },
  async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Find user (include password for comparison)
    const user = await User.findOne({ 
      $or: [
        { username: username.toLowerCase() }, 
        { email: username.toLowerCase() }
      ] 
    }).select('+password');

    if (!user) {
      logAuthEvent('login_failed', username, 'user_not_found', ip, req.headers['user-agent']);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if banned
    if (user.isBanned) {
      logAuthEvent('login_failed', username, 'account_banned', ip, req.headers['user-agent']);
      return res.status(403).json({
        success: false,
        message: 'Account suspended'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logAuthEvent('login_failed', username, 'invalid_password', ip, req.headers['user-agent']);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    logAuthEvent('login_success', username, 'success', ip, req.headers['user-agent']);

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: {
        ...req.user.getPublicProfile(),
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        isVerified: req.user.isVerified,
        totalEarnings: req.user.totalEarnings,
        referralCode: req.user.referralCode
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { fullName, phone, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
