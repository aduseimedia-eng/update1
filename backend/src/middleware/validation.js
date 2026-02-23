const { body, param, query, validationResult } = require('express-validator');
const { 
  EXPENSE_CATEGORIES, 
  PAYMENT_METHODS, 
  INCOME_SOURCES,
  BUDGET_PERIODS,
  GHANA_PHONE_REGEX
} = require('../config/constants');

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
 * Registration validation rules
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(GHANA_PHONE_REGEX).withMessage('Invalid Ghana phone number. Use format: 0XXXXXXXXX or 233XXXXXXXXX'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and a number'),
  
  handleValidationErrors
];

/**
 * Login validation rules
 */
const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Email or phone number is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * Expense validation rules
 */
const expenseValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
    .toFloat(),
  
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(EXPENSE_CATEGORIES).withMessage('Invalid expense category'),
  
  body('payment_method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(PAYMENT_METHODS).withMessage('Invalid payment method'),
  
  body('expense_date')
    .notEmpty().withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}(T|\s|$)/).withMessage('Date must be in YYYY-MM-DD format or ISO8601')
    .toDate(),
  
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Note must not exceed 500 characters'),
  
  body('is_recurring')
    .optional()
    .isBoolean().withMessage('is_recurring must be a boolean'),
  
  body('recurring_frequency')
    .optional()
    .isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid recurring frequency'),
  
  handleValidationErrors
];

/**
 * Income validation rules
 */
const incomeValidation = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
    .toFloat(),
  
  body('source')
    .notEmpty().withMessage('Source is required')
    .isIn(INCOME_SOURCES).withMessage('Invalid income source'),
  
  body('income_date')
    .notEmpty().withMessage('Date is required')
    .matches(/^\d{4}-\d{2}-\d{2}(T|\s|$)/).withMessage('Date must be in YYYY-MM-DD format or ISO8601')
    .toDate(),
  
  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Note must not exceed 500 characters'),
  
  handleValidationErrors
];

/**
 * Budget validation rules
 */
const budgetValidation = [
  body('period_type')
    .notEmpty().withMessage('Period type is required')
    .isIn(BUDGET_PERIODS).withMessage('Period type must be weekly or monthly'),
  
  body('amount')
    .notEmpty().withMessage('Budget amount is required')
    .isFloat({ min: 1 }).withMessage('Budget amount must be at least GHS 1')
    .toFloat(),
  
  body('start_date')
    .notEmpty().withMessage('Start date is required')
    .matches(/^\d{4}-\d{2}-\d{2}(T|\s|$)/).withMessage('Date must be in YYYY-MM-DD format or ISO8601')
    .toDate(),
  
  handleValidationErrors
];

/**
 * Goal validation rules
 */
const goalValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Goal title is required')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  
  body('target_amount')
    .notEmpty().withMessage('Target amount is required')
    .isFloat({ min: 1 }).withMessage('Target amount must be at least GHS 1')
    .toFloat(),
  
  body('deadline')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601().withMessage('Invalid date format')
    .toDate()
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Deadline must be in the future');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * UUID parameter validation
 */
const uuidParamValidation = [
  param('id')
    .isUUID().withMessage('Invalid ID format'),
  
  handleValidationErrors
];

/**
 * Date range validation for reports
 */
const dateRangeValidation = [
  query('start_date')
    .optional()
    .isISO8601().withMessage('Invalid start date format')
    .toDate(),
  
  query('end_date')
    .optional()
    .isISO8601().withMessage('Invalid end date format')
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query.start_date && new Date(endDate) < new Date(req.query.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Password reset validation
 */
const passwordResetValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  handleValidationErrors
];

/**
 * Password change validation
 */
const passwordChangeValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  
  body('new_password')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
  
  handleValidationErrors
];

module.exports = {
  registerValidation,
  loginValidation,
  expenseValidation,
  incomeValidation,
  budgetValidation,
  goalValidation,
  uuidParamValidation,
  dateRangeValidation,
  passwordResetValidation,
  passwordChangeValidation,
  handleValidationErrors
};
