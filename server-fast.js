import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load env vars
dotenv.config();

// Connect to MongoDB
mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const app = express();

// Security & Performance Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize data
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Import routes (without admin companies OCR for now)
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import notificationRoutes from './routes/notifications.js';
import companyRoutes from './routes/companies.js';
import transactionRoutes from './routes/transactions.js';
import referralRoutes from './routes/referrals.js';
import portfolioRoutes from './routes/portfolio.js';
import adminRoutes from './routes/admin.js';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'UnlistedHub USM API is running',
    timestamp: new Date().toISOString(),
    mode: 'fast-deploy'
  });
});

// API routes info
app.get('/api', (req, res) => {
  res.json({
    name: 'UnlistedHub USM API',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      auth: '/api/auth',
      listings: '/api/listings',
      notifications: '/api/notifications',
      companies: '/api/companies',
      transactions: '/api/transactions',
      referrals: '/api/referrals',
      portfolio: '/api/portfolio',
      admin: '/api/admin'
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);
// Note: OCR routes temporarily disabled for faster deployment

// Error handling
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd && status === 500 ? 'Internal server error' : (err.message || 'Error');
  if (!isProd) console.error('Error:', err);
  res.status(status).json({ success: false, message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`⚡ Fast Deploy Mode: OCR disabled`);
  console.log(`📡 Auto-deploy test - ${new Date().toISOString()}`);
});

export default app;
