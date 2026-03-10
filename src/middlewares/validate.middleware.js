const { validationResult } = require('express-validator');
const { sendValidationError } = require('../utils/response');

/**
 * Validate request using express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return sendValidationError(res, formattedErrors);
  }
  
  next();
};

module.exports = {
  validate
};

