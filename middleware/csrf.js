import crypto from 'crypto';

// In-memory store for CSRF tokens (for production, use Redis)
const tokenStore = new Map();
const TOKEN_EXPIRY = 3600000; // 1 hour

/**
 * Generate CSRF token for session
 */
export const generateCsrfToken = (req, res, next) => {
  try {
    const userId = req.user?.id || req.ip;
    const token = crypto.randomBytes(32).toString('hex');
    
    tokenStore.set(userId, {
      token,
      createdAt: Date.now()
    });
    
    // Clean up expired tokens periodically
    cleanupExpiredTokens();
    
    res.locals.csrfToken = token;
    next();
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return res.status(500).json({ success: false, message: 'Security error' });
  }
};

/**
 * Validate CSRF token
 */
export const validateCsrfToken = (req, res, next) => {
  try {
    // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const userId = req.user?.id || req.ip;
    const clientToken = req.headers['x-csrf-token'] || req.body._csrf;
    
    if (!clientToken) {
      return res.status(403).json({ 
        success: false, 
        message: 'CSRF token missing' 
      });
    }
    
    const storedData = tokenStore.get(userId);
    
    if (!storedData) {
      return res.status(403).json({ 
        success: false, 
        message: 'CSRF token invalid or expired' 
      });
    }
    
    // Check token expiry
    if (Date.now() - storedData.createdAt > TOKEN_EXPIRY) {
      tokenStore.delete(userId);
      return res.status(403).json({ 
        success: false, 
        message: 'CSRF token expired' 
      });
    }
    
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(clientToken, 'hex'),
      Buffer.from(storedData.token, 'hex')
    )) {
      return res.status(403).json({ 
        success: false, 
        message: 'CSRF token invalid' 
      });
    }
    
    next();
  } catch (error) {
    console.error('CSRF validation error:', error);
    return res.status(403).json({ 
      success: false, 
      message: 'CSRF validation failed' 
    });
  }
};

/**
 * Cleanup expired tokens
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [userId, data] of tokenStore.entries()) {
    if (now - data.createdAt > TOKEN_EXPIRY) {
      tokenStore.delete(userId);
    }
  }
};

// Cleanup every 10 minutes
setInterval(cleanupExpiredTokens, 600000);

export default { generateCsrfToken, validateCsrfToken };
