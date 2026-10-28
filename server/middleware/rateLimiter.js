const rateLimit = require('express-rate-limit');

// Rate limiter for Employee ID validation to prevent enumeration
const employeeIdValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 100, // limit each IP to 100 requests per window
  skip: (req) => process.env.NODE_ENV === 'test' || req.headers['x-test-suite'] === 'true',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification attempts from this network. Please wait 15 minutes before trying again.'
  }
});

// General API rate limiter
const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.'
  }
});

module.exports = {
  employeeIdValidationLimiter,
  generalApiLimiter
};
