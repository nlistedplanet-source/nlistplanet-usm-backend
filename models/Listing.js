import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: String,
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  message: String,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'countered', 'expired'],
    default: 'pending'
  },
  counterHistory: [{
    round: Number,
    by: String, // 'buyer' or 'seller'
    price: Number,
    quantity: Number,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const listingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: String,
  type: {
    type: String,
    enum: ['sell', 'buy'],
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  companyName: String,
  companySegmentation: {
    type: String,
    enum: ['SME', 'Mainboard', 'Unlisted', 'Pre-IPO', 'Startup'],
    default: null
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  minLot: {
    type: Number,
    required: true,
    default: 1
  },
  description: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'expired', 'cancelled'],
    default: 'active'
  },
  bids: [bidSchema], // For sell posts
  offers: [bidSchema], // For buy requests (using same schema)
  isBoosted: {
    type: Boolean,
    default: false
  },
  boostExpiresAt: {
    type: Date,
    default: null
  },
  views: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30*24*60*60*1000) // 30 days
  }
}, {
  timestamps: true
});

// Index for faster queries
listingSchema.index({ type: 1, status: 1, createdAt: -1 });
listingSchema.index({ userId: 1, status: 1 });
listingSchema.index({ companyId: 1, type: 1, status: 1 });
listingSchema.index({ isBoosted: 1, boostExpiresAt: 1 });

// Auto-expire listings
listingSchema.pre('find', function() {
  this.where({ expiresAt: { $gt: new Date() } });
});

export default mongoose.model('Listing', listingSchema);
