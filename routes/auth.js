import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UsernameHistory from '../models/UsernameHistory.js';
import { protect } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { logFailedLogin, logSuccessfulLogin, logAccountChange } from '../middleware/securityLogger.js';
import { validateProfileUpdate } from '../middleware/validation.js';

const router = express.Router();

// Generate Funny Username - Short & Memorable
const generateFunnyUsername = () => {
  const superheroes = [
    'ironman', 'batman', 'superman', 'spidey', 'thor', 'hulk', 'flash', 'arrow',
    'widow', 'hawkeye', 'antman', 'wasp', 'vision', 'falcon', 'strange'
  ];
  
  const bollywood = [
    'srk', 'salman', 'aamir', 'akshay', 'hrithik', 'ranbir', 'ranveer',
    'deepika', 'priyanka', 'katrina', 'alia', 'anushka', 'kangana'
  ];
  
  const cartoons = [
    'jerry', 'tom', 'mickey', 'donald', 'goofy', 'pluto', 'bugs', 'tweety',
    'scooby', 'shaggy', 'fred', 'velma', 'daphne', 'bart', 'homer', 'lisa',
    'popeye', 'olive', 'SpongeBob', 'patrick', 'squidward', 'dora', 'diego'
  ];
  
  const cities = [
    'delhi', 'mumbai', 'goa', 'jaipur', 'udaipur', 'shimla', 'manali',
    'kerala', 'kashmir', 'ladakh', 'pune', 'bangalore', 'mysore'
  ];
  
  const animals = [
    'wolf', 'tiger', 'lion', 'eagle', 'falcon', 'panther', 'cobra',
    'dragon', 'shark', 'rhino', 'bear', 'fox', 'leopard'
  ];
  
  const cool = [
    'ninja', 'samurai', 'viking', 'knight', 'warrior', 'legend', 'ace',
    'boss', 'king', 'queen', 'crypto', 'trader', 'whale', 'bull'
  ];
  
  // Randomly pick from one of the categories
  const allNames = [
    ...superheroes, ...bollywood, ...cartoons, 
    ...cities, ...animals, ...cool
  ];
  
  const randomName = allNames[Math.floor(Math.random() * allNames.length)];
  const randomNum = Math.floor(Math.random() * 999) + 1;
  
  // Format: name + number (e.g., ironman007, srk420, jerry786)
  return `${randomName}${randomNum}`;
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

// Validation chains - simplified password requirements
const registerValidation = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail().isLength({ max: 254 }),
  body('password').isLength({ min: 5, max: 128 }).withMessage('Password must be 5-128 characters'),
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
  body('password').isLength({ min: 5, max: 128 }),
  body('fullName').isLength({ min: 3, max: 100 }).trim().escape(),
  body('phone').matches(/^[0-9]{10}$/),
  body('referredBy').optional().isString().trim().escape().isLength({ max: 20 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      console.log('[VALIDATION DEBUG]', JSON.stringify({ body: req.body, errors: errors.array() }));
      logAuthEvent('validation_error', req.body?.email, 'failed', ip, req.headers['user-agent']);
      return res.status(400).json({ success: false, message: 'Invalid input format', errors: errors.array() });
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

    // Save initial username to history to prevent future reassignment
    await UsernameHistory.create({
      username: username.toLowerCase(),
      userId: user._id,
      reason: 'Initial registration'
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
      logFailedLogin(req, username, 'user_not_found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if banned
    if (user.isBanned) {
      logFailedLogin(req, username, 'account_banned');
      return res.status(403).json({
        success: false,
        message: 'Account suspended'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logFailedLogin(req, username, 'invalid_password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    logSuccessfulLogin(req, user._id, username);

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
router.put('/change-password', 
  protect,
  body('currentPassword').isString().isLength({ min: 1, max: 128 }).withMessage('Current password required'),
  body('newPassword').isLength({ min: 5, max: 128 }).withMessage('New password must be 5-128 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Invalid input format' });
    }
    next();
  },
  async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      logFailedLogin(req, user.email, 'incorrect_current_password');
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logAccountChange(req, 'password_changed', { userId: user._id });

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
router.put('/profile', protect, validateProfileUpdate, async (req, res, next) => {
  try {
    const { 
      username,
      fullName, 
      email,
      phone, 
      dob,
      gender,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      avatar,
      accountType,
      accountNumber,
      ifsc,
      bankName,
      nomineeName,
      nomineeRelationship
    } = req.body;

    const user = await User.findById(req.user._id);

    // Log profile update
    const changedFields = [];
    if (username && username !== user.username) changedFields.push('username');
    if (email && email !== user.email) changedFields.push('email');
    if (phone && phone !== user.phone) changedFields.push('phone');

    // Handle username change with history tracking
    if (username && username !== user.username) {
      const oldUsername = user.username;
      
      // Check if new username is in history (was used by any user before)
      const existingHistory = await UsernameHistory.findOne({ username: username.toLowerCase() });
      if (existingHistory) {
        return res.status(400).json({
          success: false,
          message: 'This username was previously used and cannot be assigned to another user'
        });
      }

      // Save old username to history
      await UsernameHistory.create({
        username: oldUsername.toLowerCase(),
        userId: user._id,
        reason: 'User changed username'
      });

      // Add to user's previous usernames array
      if (!user.previousUsernames) {
        user.previousUsernames = [];
      }
      user.previousUsernames.push({
        username: oldUsername,
        changedAt: new Date()
      });
    }

    // Update basic fields
    if (username) user.username = username;
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (dob) user.dob = dob;
    if (gender) user.gender = gender;
    if (avatar) user.avatar = avatar;

    // Update address fields
    if (addressLine1 !== undefined) user.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) user.addressLine2 = addressLine2;
    if (city !== undefined) user.city = city;
    if (state !== undefined) user.state = state;
    if (pincode !== undefined) user.pincode = pincode;
    if (country !== undefined) user.country = country;

    // Update bank account details
    if (accountType || accountNumber || ifsc || bankName) {
      if (!user.bankAccount) user.bankAccount = {};
      if (accountType !== undefined) user.bankAccount.accountType = accountType;
      if (accountNumber !== undefined) user.bankAccount.accountNumber = accountNumber;
      if (ifsc !== undefined) user.bankAccount.ifsc = ifsc;
      if (bankName !== undefined) user.bankAccount.bankName = bankName;
    }

    // Update nominee details
    if (nomineeName || nomineeRelationship) {
      if (!user.nominee) user.nominee = {};
      if (nomineeName !== undefined) user.nominee.name = nomineeName;
      if (nomineeRelationship !== undefined) user.nominee.relationship = nomineeRelationship;
    }

    await user.save();

    // Log profile changes
    if (changedFields.length > 0) {
      logAccountChange(req, 'profile_updated', { 
        userId: user._id, 
        changedFields 
      });
    }

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
