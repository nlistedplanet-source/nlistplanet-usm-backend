import mongoose from 'mongoose';

const usernameHistorySchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    default: 'User changed username'
  }
}, {
  timestamps: true
});

// Index for faster lookups
usernameHistorySchema.index({ username: 1, userId: 1 });

export default mongoose.model('UsernameHistory', usernameHistorySchema);
