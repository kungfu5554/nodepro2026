// utils/validation.js
const { validationResult } = require('express-validator');
const { fail } = require('./response');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400);
  }
  next();
}

function parseRequiredJudges(value, fallback = 3) {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: fallback };
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 10) {
    return { valid: false, value: null };
  }
  return { valid: true, value: num };
}

module.exports = {
  handleValidationErrors,
  parseRequiredJudges
};
