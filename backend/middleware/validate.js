const { validationResult } = require('express-validator');

// Runs after a chain of express-validator checks. If any failed, respond
// with 400 and a flat list of { field, message }. Otherwise continue.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { validate };