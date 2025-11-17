import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'new_bid',
      'new_offer',
      'bid_accepted',
      'offer_accepted',
      'bid_rejected',
      'offer_rejected',
      'counter_offer',
      'listing_expired',
      'boost_activated',
      'referral_earning'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    listingId: mongoose.Schema.Types.ObjectId,
    bidId: mongoose.Schema.Types.ObjectId,
    fromUser: String,
    amount: Number,
    quantity: Number,
    companyName: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  actionUrl: String
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
