import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// @route   POST /api/kyc/submit
// @desc    Submit complete KYC information with documents
// @access  Private
router.post('/submit', protect, async (req, res) => {
  try {
    const { 
      fullName,
      username,
      dob,
      gender,
      address,
      workIncome,
      bankAccount,
      nominee,
      dematAccount,
      documents // { pan, aadhaar, bankProof, cdslStatement } with base64 or URLs
    } = req.body;

    // Validate required fields
    if (!fullName || !dob || !gender || !address?.line1 || !address?.city || 
        !address?.state || !address?.pincode || !workIncome?.incomeRange || 
        !workIncome?.sourceOfWealth || !bankAccount?.accountNumber || 
        !bankAccount?.ifsc || !bankAccount?.bankName || !nominee?.name || 
        !nominee?.relationship || !dematAccount?.dpId || !dematAccount?.clientId) {
      return res.status(400).json({ message: 'All required KYC fields must be filled' });
    }

    // Update user with KYC data
    const user = await User.findById(req.user._id);
    
    // Basic info
    user.fullName = fullName;
    if (username) user.username = username;
    user.dob = new Date(dob);
    user.gender = gender;
    
    // Address
    user.address = {
      line1: address.line1,
      line2: address.line2 || null,
      line3: address.line3 || null,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || 'India'
    };
    
    // Work & Income
    user.workIncome = {
      incomeRange: workIncome.incomeRange,
      sourceOfWealth: workIncome.sourceOfWealth
    };
    
    // Bank Account
    user.bankAccount = {
      accountType: bankAccount.accountType,
      accountNumber: bankAccount.accountNumber,
      ifsc: bankAccount.ifsc,
      bankName: bankAccount.bankName,
      branch: bankAccount.branch || null
    };
    
    // Nominee
    user.nominee = {
      name: nominee.name,
      relationship: nominee.relationship,
      dob: nominee.dob ? new Date(nominee.dob) : null,
      mobile: nominee.mobile,
      sharePercentage: nominee.sharePercentage || 100,
      copyAddress: nominee.copyAddress || false
    };
    
    // Demat Account
    user.dematAccount = {
      dpId: dematAccount.dpId,
      clientId: dematAccount.clientId
    };
    
    // Documents (if provided)
    if (documents) {
      const now = new Date();
      if (documents.pan) {
        user.kycDocuments.pan = {
          url: documents.pan,
          status: 'pending',
          uploadedAt: now
        };
      }
      if (documents.aadhaar) {
        user.kycDocuments.aadhaar = {
          url: documents.aadhaar,
          status: 'pending',
          uploadedAt: now
        };
      }
      if (documents.bankProof) {
        user.kycDocuments.bankProof = {
          url: documents.bankProof,
          status: 'pending',
          uploadedAt: now
        };
      }
      if (documents.cdslStatement) {
        user.kycDocuments.cdslStatement = {
          url: documents.cdslStatement,
          status: 'pending',
          uploadedAt: now
        };
      }
    }
    
    // Update KYC status
    user.kycStatus = 'pending';
    user.kycSubmittedAt = new Date();
    
    await user.save();

    res.json({
      message: 'KYC submitted successfully for verification',
      kycStatus: user.kycStatus,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        kycStatus: user.kycStatus
      }
    });
  } catch (error) {
    console.error('KYC submit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/kyc/draft
// @desc    Save KYC as draft (partial data allowed)
// @access  Private
router.post('/draft', protect, async (req, res) => {
  try {
    const kycData = req.body;
    const user = await User.findById(req.user._id);
    
    // Update only provided fields
    if (kycData.fullName) user.fullName = kycData.fullName;
    if (kycData.username) user.username = kycData.username;
    if (kycData.dob) user.dob = new Date(kycData.dob);
    if (kycData.gender) user.gender = kycData.gender;
    if (kycData.address) user.address = { ...user.address, ...kycData.address };
    if (kycData.workIncome) user.workIncome = { ...user.workIncome, ...kycData.workIncome };
    if (kycData.bankAccount) user.bankAccount = { ...user.bankAccount, ...kycData.bankAccount };
    if (kycData.nominee) user.nominee = { ...user.nominee, ...kycData.nominee };
    if (kycData.dematAccount) user.dematAccount = { ...user.dematAccount, ...kycData.dematAccount };
    
    await user.save();

    res.json({
      message: 'KYC draft saved successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('KYC draft error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/kyc/status
// @desc    Get current user KYC status and data
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      kycStatus: user.kycStatus,
      kycSubmittedAt: user.kycSubmittedAt,
      kycVerifiedAt: user.kycVerifiedAt,
      kycRejectionReason: user.kycRejectionReason,
      kycDocuments: user.kycDocuments,
      personalInfo: {
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        dob: user.dob,
        gender: user.gender
      },
      address: user.address,
      workIncome: user.workIncome,
      bankAccount: user.bankAccount,
      nominee: user.nominee,
      dematAccount: user.dematAccount
    });
  } catch (error) {
    console.error('KYC status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/kyc/verify
// @desc    Admin verify/reject KYC (Admin only)
// @access  Private + Admin
router.post('/verify', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { userId, status, rejectionReason, documentStatuses } = req.body;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.kycStatus = status;
    
    if (status === 'approved') {
      user.kycVerifiedAt = new Date();
      user.kycRejectionReason = null;
      
      // Update all document statuses to approved
      if (user.kycDocuments.pan) user.kycDocuments.pan.status = 'approved';
      if (user.kycDocuments.aadhaar) user.kycDocuments.aadhaar.status = 'approved';
      if (user.kycDocuments.bankProof) user.kycDocuments.bankProof.status = 'approved';
      if (user.kycDocuments.cdslStatement) user.kycDocuments.cdslStatement.status = 'approved';
    } else {
      user.kycRejectionReason = rejectionReason;
      
      // Update individual document statuses if provided
      if (documentStatuses) {
        if (documentStatuses.pan && user.kycDocuments.pan) {
          user.kycDocuments.pan.status = documentStatuses.pan.status;
          user.kycDocuments.pan.rejectionReason = documentStatuses.pan.reason;
        }
        if (documentStatuses.aadhaar && user.kycDocuments.aadhaar) {
          user.kycDocuments.aadhaar.status = documentStatuses.aadhaar.status;
          user.kycDocuments.aadhaar.rejectionReason = documentStatuses.aadhaar.reason;
        }
        if (documentStatuses.bankProof && user.kycDocuments.bankProof) {
          user.kycDocuments.bankProof.status = documentStatuses.bankProof.status;
          user.kycDocuments.bankProof.rejectionReason = documentStatuses.bankProof.reason;
        }
        if (documentStatuses.cdslStatement && user.kycDocuments.cdslStatement) {
          user.kycDocuments.cdslStatement.status = documentStatuses.cdslStatement.status;
          user.kycDocuments.cdslStatement.rejectionReason = documentStatuses.cdslStatement.reason;
        }
      }
    }

    await user.save();

    res.json({
      message: `KYC ${status} successfully`,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        kycStatus: user.kycStatus
      }
    });
  } catch (error) {
    console.error('KYC verify error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/kyc/pending
// @desc    Get all pending KYC submissions (Admin only)
// @access  Private + Admin
router.get('/pending', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const pendingUsers = await User.find({ kycStatus: 'pending' })
      .select('fullName username email phone kycStatus kycSubmittedAt kycDocuments')
      .sort({ kycSubmittedAt: -1 });

    res.json({
      count: pendingUsers.length,
      users: pendingUsers
    });
  } catch (error) {
    console.error('KYC pending list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
