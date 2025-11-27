# Security Features Documentation

## Overview
This document outlines all security features implemented in the UnlistedHub USM backend API.

## ✅ Implemented Security Features

### 1. **Rate Limiting**
- **Global Rate Limiter**: 300 requests per 15 minutes per IP
- **Auth Rate Limiter**: 20 requests per 15 minutes for login/register endpoints
- Prevents brute force attacks and API abuse
- Located in: `server.js` and `routes/auth.js`

### 2. **HTTP Security Headers (Helmet.js)**
- Content Security Policy (CSP) - prevents XSS attacks
- Strict Transport Security (HSTS) - enforces HTTPS
- X-Content-Type-Options - prevents MIME sniffing
- X-Frame-Options - prevents clickjacking
- Referrer Policy - controls referrer information
- Permissions Policy - restricts browser features
- Located in: `server.js`

### 3. **Input Validation & Sanitization**
- **Express Validator**: Validates all API inputs
- **Validation Rules**:
  - Email format and normalization
  - Password length (5-128 characters)
  - Phone number format (10 digits)
  - MongoDB ObjectId validation
  - PAN/ISIN/CIN format validation
  - Price and quantity ranges
- **Sanitization**:
  - HTML escaping to prevent XSS
  - NoSQL injection prevention (mongo-sanitize)
  - XSS pattern detection and removal
- Located in: `middleware/validation.js`

### 4. **CSRF Protection**
- Token-based CSRF protection for state-changing operations
- 1-hour token expiry
- Constant-time comparison to prevent timing attacks
- In-memory token store (upgrade to Redis for production scale)
- Located in: `middleware/csrf.js`

### 5. **Security Logging & Monitoring**
- **Logged Events**:
  - Failed login attempts (with reason)
  - Successful logins
  - Account changes (password, profile updates)
  - Rate limit violations
  - Injection attempt detection
  - Suspicious activities
- **Log Storage**: `logs/security.log` (JSON format)
- **Injection Detection**: Monitors for SQL/NoSQL/XSS/Path Traversal patterns
- Located in: `middleware/securityLogger.js`

### 6. **Password Security**
- Argon2id hashing algorithm (bank-grade)
- Automatic salting
- Configurable memory and time cost
- Password never stored in plain text
- Located in: `models/User.js`

### 7. **JWT Authentication**
- Token-based authentication
- Configurable expiration time
- Secure token generation
- Protected routes require valid JWT
- Located in: `middleware/auth.js`

### 8. **CORS Protection**
- Whitelist-based origin checking
- Credentials support
- Vercel preview deployment support
- Localhost development access
- Dynamic origin configuration via ENV
- Located in: `server.js`

### 9. **Additional Security Measures**
- Request body size limit (1MB)
- Compression for response optimization
- Environment variable validation on startup
- JWT secret length validation (minimum 32 characters)
- Production error message sanitization
- Audit logging for authentication events

## 📁 Security Files Structure

```
backend/
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── csrf.js              # CSRF protection
│   ├── securityLogger.js    # Security event logging
│   └── validation.js        # Input validation rules
├── logs/
│   └── security.log         # Security events log file
└── server.js                # Main security configuration
```

## 🔒 Security Best Practices Implemented

1. ✅ **Fail Securely**: Generic error messages to prevent information disclosure
2. ✅ **Defense in Depth**: Multiple layers of security (validation, sanitization, logging)
3. ✅ **Least Privilege**: Protected routes require authentication
4. ✅ **Secure by Default**: All security features enabled by default
5. ✅ **Logging & Monitoring**: Comprehensive security event logging
6. ✅ **Input Validation**: All user inputs validated and sanitized
7. ✅ **Password Security**: Strong hashing with Argon2id
8. ✅ **Rate Limiting**: Protection against brute force and DDoS

## 🚀 Usage Examples

### Using Validation Middleware
```javascript
import { validateListing, validateBid } from '../middleware/validation.js';

router.post('/listings', protect, validateListing, async (req, res) => {
  // Your listing creation logic
});

router.post('/listings/:id/bid', protect, validateBid, async (req, res) => {
  // Your bid placement logic
});
```

### Using CSRF Protection
```javascript
import { generateCsrfToken, validateCsrfToken } from '../middleware/csrf.js';

// Generate token endpoint
router.get('/csrf-token', protect, generateCsrfToken, (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

// Protected route with CSRF validation
router.post('/sensitive-action', protect, validateCsrfToken, async (req, res) => {
  // Your sensitive action logic
});
```

### Using Security Logger
```javascript
import { logSuspiciousActivity, logAccountChange } from '../middleware/securityLogger.js';

// Log suspicious activity
if (suspiciousCondition) {
  logSuspiciousActivity(req, 'UNUSUAL_ACTIVITY', { details: '...' });
}

// Log account changes
logAccountChange(req, 'email_changed', { userId: user._id });
```

## 🔧 Environment Variables

```env
# Security Configuration
JWT_SECRET=your-super-long-secret-key-minimum-32-characters
JWT_EXPIRE=7d
CORS_ORIGINS=https://yourdomain.com,https://anotherdomain.com
NODE_ENV=production
```

## 📊 Security Monitoring

Monitor the `logs/security.log` file for:
- Failed login patterns (potential brute force)
- Rate limit violations (DDoS attempts)
- Injection attempts (SQL/NoSQL/XSS)
- Suspicious activities
- Account changes

## 🔄 Future Enhancements

1. Redis-based CSRF token storage for horizontal scaling
2. IP-based geolocation for suspicious login detection
3. Two-factor authentication (2FA)
4. Email notifications for security events
5. Automated threat response system
6. Security headers testing automation
7. Penetration testing integration

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Argon2 Password Hashing](https://github.com/P-H-C/phc-winner-argon2)

---

**Last Updated**: November 27, 2025
**Security Level**: Production-Ready
