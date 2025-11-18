import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

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

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', async (req, res, next) => {
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
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // Find user (include password for comparison)
    const user = await User.findOne({ 
      $or: [
        { username: username.toLowerCase() }, 
        { email: username.toLowerCase() }
      ] 
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

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
