const { validationResult } = require('express-validator');

/**
 * Run after express-validator chains.
 * Returns 400 with error details if any field is invalid.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { validate };
