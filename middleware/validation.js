import { body, param, query, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for creating/updating listings
 */
export const validateListing = [
  body('type').isIn(['sell', 'buy']).withMessage('Type must be sell or buy'),
  body('companyId').isMongoId().withMessage('Invalid company ID'),
  body('price').isFloat({ min: 1, max: 1000000000 }).withMessage('Price must be between 1 and 1000000000'),
  body('quantity').isInt({ min: 1, max: 100000000 }).withMessage('Quantity must be between 1 and 100000000'),
  body('minLot').isInt({ min: 1 }).withMessage('Minimum lot must be at least 1'),
  body('companySegmentation').optional().isIn(['SME', 'Mainboard', 'Private']).withMessage('Invalid segmentation'),
  body('description').optional().isString().isLength({ max: 1000 }).trim().escape().withMessage('Description max 1000 characters'),
  handleValidationErrors
];

/**
 * Validation rules for placing bid/offer
 */
export const validateBid = [
  body('price').isFloat({ min: 1, max: 1000000000 }).withMessage('Price must be between 1 and 1000000000'),
  body('quantity').isInt({ min: 1, max: 100000000 }).withMessage('Quantity must be between 1 and 100000000'),
  body('message').optional().isString().isLength({ max: 500 }).trim().escape().withMessage('Message max 500 characters'),
  handleValidationErrors
];

/**
 * Validation rules for accepting/rejecting bid
 */
export const validateBidAction = [
  param('listingId').isMongoId().withMessage('Invalid listing ID'),
  param('bidId').isMongoId().withMessage('Invalid bid ID'),
  body('action').isIn(['accept', 'reject']).withMessage('Action must be accept or reject'),
  handleValidationErrors
];

/**
 * Validation rules for counter offer
 */
export const validateCounterOffer = [
  param('listingId').isMongoId().withMessage('Invalid listing ID'),
  param('bidId').isMongoId().withMessage('Invalid bid ID'),
  body('price').isFloat({ min: 1, max: 1000000000 }).withMessage('Price must be between 1 and 1000000000'),
  body('quantity').isInt({ min: 1, max: 100000000 }).withMessage('Quantity must be between 1 and 100000000'),
  body('minQuantity').optional().isInt({ min: 1 }).withMessage('Minimum quantity must be at least 1'),
  handleValidationErrors
];

/**
 * Validation rules for MongoDB ObjectId params
 */
export const validateObjectId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  handleValidationErrors
];

/**
 * Validation rules for pagination
 */
export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

/**
 * Validation rules for company creation/update
 */
export const validateCompany = [
  body('name').isString().isLength({ min: 2, max: 200 }).trim().withMessage('Company name 2-200 characters'),
  body('symbol').isString().isLength({ min: 2, max: 20 }).trim().toUpperCase().withMessage('Symbol 2-20 characters'),
  body('sector').isString().isLength({ min: 2, max: 100 }).trim().withMessage('Sector 2-100 characters'),
  body('logo').optional().isURL().withMessage('Logo must be a valid URL'),
  body('pan').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN format'),
  body('isin').optional().matches(/^[A-Z]{2}[A-Z0-9]{10}$/).withMessage('Invalid ISIN format'),
  body('cin').optional().matches(/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/).withMessage('Invalid CIN format'),
  handleValidationErrors
];

/**
 * Validation rules for profile update
 */
export const validateProfileUpdate = [
  body('fullName').optional().isString().isLength({ min: 3, max: 100 }).trim().escape().withMessage('Full name 3-100 characters'),
  body('phone').optional().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('email').optional().isEmail().normalizeEmail().isLength({ max: 254 }).withMessage('Invalid email'),
  body('dob').optional().isString().matches(/^\d{2}\/\d{2}\/\d{4}$/).withMessage('DOB format: DD/MM/YYYY'),
  body('gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('address.addressLine1').optional().isString().isLength({ max: 200 }).trim().withMessage('Address line 1 max 200 characters'),
  body('address.city').optional().isString().isLength({ max: 100 }).trim().withMessage('City max 100 characters'),
  body('address.state').optional().isString().isLength({ max: 100 }).trim().withMessage('State max 100 characters'),
  body('address.pincode').optional().matches(/^[0-9]{6}$/).withMessage('Pincode must be 6 digits'),
  body('bankAccount.accountNumber').optional().matches(/^[0-9]{9,18}$/).withMessage('Invalid account number'),
  body('bankAccount.ifsc').optional().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code'),
  handleValidationErrors
];

/**
 * Sanitize user input to prevent XSS
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS patterns
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

export default {
  handleValidationErrors,
  validateListing,
  validateBid,
  validateBidAction,
  validateCounterOffer,
  validateObjectId,
  validatePagination,
  validateCompany,
  validateProfileUpdate,
  sanitizeInput
};
