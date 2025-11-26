import mongoose from 'mongoose';

const adSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  imageUrl: {
    type: String,
    required: true
  },
  targetUrl: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    required: true,
    enum: ['home-banner', 'home-sidebar', 'listings-top', 'listings-sidebar', 'company-detail'],
    default: 'home-banner'
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'expired'],
    default: 'active'
  },
  impressions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
adSchema.index({ status: 1, position: 1, startDate: 1, endDate: 1 });
adSchema.index({ createdBy: 1 });

// Virtual for CTR (Click Through Rate)
adSchema.virtual('ctr').get(function() {
  if (this.impressions === 0) return 0;
  return ((this.clicks / this.impressions) * 100).toFixed(2);
});

// Check if ad is currently active based on dates
adSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         this.endDate >= now;
};

// Auto-expire ads that have passed their end date
adSchema.pre('save', function(next) {
  const now = new Date();
  if (this.endDate < now && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

adSchema.set('toJSON', { virtuals: true });
adSchema.set('toObject', { virtuals: true });

const Ad = mongoose.model('Ad', adSchema);
export default Ad;
