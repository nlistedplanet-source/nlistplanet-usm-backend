import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if not exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const securityLogFile = path.join(logsDir, 'security.log');

/**
 * Log security events to file and console
 */
export const logSecurityEvent = (type, details) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    ...details
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  // Write to file
  fs.appendFile(securityLogFile, logLine, (err) => {
    if (err) console.error('Failed to write security log:', err);
  });
  
  // Console log for monitoring
  console.log(`🔒 [SECURITY] ${type}:`, details);
};

/**
 * Middleware to log failed authentication attempts
 */
export const logFailedLogin = (req, email, reason) => {
  logSecurityEvent('FAILED_LOGIN', {
    email,
    reason,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware to log successful logins
 */
export const logSuccessfulLogin = (req, userId, email) => {
  logSecurityEvent('SUCCESSFUL_LOGIN', {
    userId,
    email,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware to log suspicious activities
 */
export const logSuspiciousActivity = (req, activity, details = {}) => {
  logSecurityEvent('SUSPICIOUS_ACTIVITY', {
    activity,
    ...details,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware to log rate limit violations
 */
export const logRateLimitViolation = (req, endpoint) => {
  logSecurityEvent('RATE_LIMIT_VIOLATION', {
    endpoint,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware to log account changes
 */
export const logAccountChange = (req, changeType, details = {}) => {
  logSecurityEvent('ACCOUNT_CHANGE', {
    changeType,
    ...details,
    userId: req.user?.id,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
};

/**
 * Middleware to detect and log SQL/NoSQL injection attempts
 */
export const detectInjectionAttempt = (req, res, next) => {
  const suspiciousPatterns = [
    /(\$where|mapReduce|group|\$regex)/i, // NoSQL injection
    /('|"|;|--|\*|\/\*|\*\/|xp_|sp_)/i,   // SQL injection
    /(script|javascript:|onerror|onload)/i, // XSS attempts
    /(\.\.\/|\.\.\\)/                        // Path traversal
  ];
  
  const checkPayload = (obj, depth = 0) => {
    if (depth > 5) return false; // Prevent deep recursion
    
    for (const key in obj) {
      const value = obj[key];
      
      // Check key names
      if (typeof key === 'string' && suspiciousPatterns.some(pattern => pattern.test(key))) {
        return true;
      }
      
      // Check string values
      if (typeof value === 'string' && suspiciousPatterns.some(pattern => pattern.test(value))) {
        return true;
      }
      
      // Recursively check nested objects
      if (typeof value === 'object' && value !== null) {
        if (checkPayload(value, depth + 1)) return true;
      }
    }
    return false;
  };
  
  if (checkPayload(req.body) || checkPayload(req.query) || checkPayload(req.params)) {
    logSuspiciousActivity(req, 'INJECTION_ATTEMPT', {
      body: req.body,
      query: req.query,
      params: req.params
    });
  }
  
  next();
};

export default {
  logSecurityEvent,
  logFailedLogin,
  logSuccessfulLogin,
  logSuspiciousActivity,
  logRateLimitViolation,
  logAccountChange,
  detectInjectionAttempt
};
