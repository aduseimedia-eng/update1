const express = require('express');
const router = express.Router();
const {
  sendPhoneOTP,
  verifyPhoneOTP,
  resendPhoneOTP
} = require('../controllers/phoneController');
const { body, validationResult } = require('express-validator');

/**
 * Validation error handler
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * POST /phone/send-otp
 * Send OTP to phone number
 */
router.post(
  '/send-otp',
  [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^(233[0-9]{9}|0[0-9]{9})$/).withMessage('Invalid Ghana phone number. Use format: 233XXXXXXXXX or 0XXXXXXXXX'),
    handleValidationErrors
  ],
  sendPhoneOTP
);

/**
 * POST /phone/verify-otp
 * Verify OTP code
 */
router.post(
  '/verify-otp',
  [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^(233[0-9]{9}|0[0-9]{9})$/).withMessage('Invalid Ghana phone number'),
    body('otp')
      .trim()
      .notEmpty().withMessage('OTP is required')
      .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    handleValidationErrors
  ],
  verifyPhoneOTP
);

/**
 * POST /phone/resend-otp
 * Resend OTP to phone number
 */
router.post(
  '/resend-otp',
  [
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required')
      .matches(/^(233[0-9]{9}|0[0-9]{9})$/).withMessage('Invalid Ghana phone number. Use format: 233XXXXXXXXX or 0XXXXXXXXX'),
    handleValidationErrors
  ],
  resendPhoneOTP
);

module.exports = router;
