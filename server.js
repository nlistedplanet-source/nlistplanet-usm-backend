import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

// Import routes
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import notificationRoutes from './routes/notifications.js';
import companyRoutes from './routes/companies.js';
import transactionRoutes from './routes/transactions.js';
import referralRoutes from './routes/referrals.js';
import portfolioRoutes from './routes/portfolio.js';
import adminRoutes from './routes/admin.js';

// Load environment variables
dotenv.config();

const app = express();

// Trust proxy - Required for Render.com reverse proxy
app.set('trust proxy', 1);

// Bank-level security headers with strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  noSniff: true,
  xssFilter: true,
  permissionsPolicy: {
    accelerometer: [],
    camera: [],
    microphone: [],
    geolocation: [],
    magnetometer: [],
    usb: []
  }
}));

// Stable whitelist CORS configuration (extendable via ENV ORIGINS comma separated)
const extraOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
const allowedOriginsArray = [
  'http://localhost:3000',
  'https://localhost:3000',
  process.env.FRONTEND_URL,
  'https://nlistplanet-iaefn2dmm-nlist-planets-projects.vercel.app',
  'https://nlistplanet-app.vercel.app',
  ...extraOrigins
].filter(Boolean);
const allowedOrigins = new Set(allowedOriginsArray);

console.log('[CORS] Allowed origins:', Array.from(allowedOrigins));

// Append allowed origins to CSP connectSrc dynamically
const helmetMiddleware = helmet.contentSecurityPolicy && helmet.contentSecurityPolicy.getDefaultDirectives;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow non-browser tools
    if (allowedOrigins.has(origin)) return callback(null, true);
    // Allow all Vercel preview deployments
    if (origin && origin.match(/\.vercel\.app$/)) return callback(null, true);
    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
}));

// Preflight handler (only for whitelisted origins)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(compression()); // Compress responses
app.use(morgan('dev')); // Logging
app.use(express.json({ limit: '1mb' })); // Parse JSON bodies with size limit
app.use(express.urlencoded({ extended: true }));

// Security hardening middleware
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Basic XSS protection (note: deprecated library, consider replacement later)

// Global rate limiter (all routes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Max requests per window per IP
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Enforce HSTS when behind HTTPS (Vercel passes x-forwarded-proto)
app.use((req, res, next) => {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  if (proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
});

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'UnlistedHub USM API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'UnlistedHub USM API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  // Avoid leaking internals in production
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
});

export default app;
