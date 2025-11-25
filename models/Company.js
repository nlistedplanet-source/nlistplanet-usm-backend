import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  scriptName: {
    type: String,
    trim: true,
    default: null
  },
  logo: {
    type: String,
    default: null
  },
  sector: {
    type: String,
    required: true
  },
  description: {
    type: String,
    maxlength: 1000
  },
  isin: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'Invalid ISIN format']
  },
  pan: {
    type: String,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format']
  },
  cin: {
    type: String,
    match: [/^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, 'Invalid CIN format']
  },
  website: String,
  foundedYear: Number,
  totalListings: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search
companySchema.index({ name: 'text', sector: 'text' });
companySchema.index({ sector: 1, isActive: 1 });

export default mongoose.model('Company', companySchema);
