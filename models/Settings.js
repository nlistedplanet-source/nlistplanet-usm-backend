import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  // Platform Fees
  platformFeePercentage: {
    type: Number,
    default: 2,
    min: 0,
    max: 100
  },
  
  // Boost Fees
  boostFeeAmount: {
    type: Number,
    default: 500,
    min: 0
  },
  boostDurationDays: {
    type: Number,
    default: 7,
    min: 1
  },

  // Listing Limits
  maxListingsPerUser: {
    type: Number,
    default: 10,
    min: 1
  },
  listingExpiryDays: {
    type: Number,
    default: 30,
    min: 1
  },

  // Referral Settings
  referralCommissionPercentage: {
    type: Number,
    default: 1,
    min: 0,
    max: 100
  },
  
  // Platform Status
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: {
    type: String,
    default: 'Platform is under maintenance. Please check back later.'
  },

  // Contact & Support
  supportEmail: {
    type: String,
    default: 'support@nlistplanet.com'
  },
  contactPhone: {
    type: String,
    default: '+91 1234567890'
  },

  // Email Settings
  emailNotificationsEnabled: {
    type: Boolean,
    default: true
  },
  smsNotificationsEnabled: {
    type: Boolean,
    default: false
  },

  // Trading Limits
  minTradeAmount: {
    type: Number,
    default: 1000,
    min: 0
  },
  maxTradeAmount: {
    type: Number,
    default: 10000000,
    min: 0
  },

  // Updated timestamp
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists (singleton pattern)
// Note: _id is already indexed by MongoDB, no need to add custom index

export default mongoose.model('Settings', settingsSchema);
