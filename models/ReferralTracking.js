import mongoose from 'mongoose';

const referralTrackingSchema = new mongoose.Schema({
  // Referrer (who shared the code)
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referrerName: {
    type: String,
    required: true
  },
  referrerCode: {
    type: String,
    required: true
  },

  // Referee (who used the code)
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refereeName: {
    type: String,
    required: true
  },

  // Deal/Transaction Details
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  companyName: {
    type: String
  },

  // Financial Breakdown
  dealAmount: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    default: 0
  },
  pricePerShare: {
    type: Number,
    default: 0
  },
  platformFeePercentage: {
    type: Number,
    default: 2
  },
  platformRevenue: {
    type: Number,
    required: true,
    min: 0
  },
  referralCommissionPercentage: {
    type: Number,
    default: 10 // 10% of platform revenue
  },
  referralAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Transaction reference
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending'
  },
  
  // Payment tracking
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String
  },
  paymentReference: {
    type: String
  },

  // Additional info
  dealType: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
referralTrackingSchema.index({ referrer: 1, status: 1 });
referralTrackingSchema.index({ referee: 1 });
referralTrackingSchema.index({ status: 1, createdAt: -1 });
referralTrackingSchema.index({ company: 1 });

// Calculate referral amount before saving
referralTrackingSchema.pre('save', function(next) {
  if (this.isModified('platformRevenue') || this.isModified('referralCommissionPercentage')) {
    this.referralAmount = (this.platformRevenue * this.referralCommissionPercentage) / 100;
  }
  next();
});

// Virtual for total company earnings (deal amount - platform fee)
referralTrackingSchema.virtual('companyEarnings').get(function() {
  return this.dealAmount - this.platformRevenue;
});

referralTrackingSchema.set('toJSON', { virtuals: true });
referralTrackingSchema.set('toObject', { virtuals: true });

export default mongoose.model('ReferralTracking', referralTrackingSchema);
