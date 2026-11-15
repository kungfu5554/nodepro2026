const { validationResult } = require('express-validator');
const { fail } = require('./response');

const handleValidationErrors = (req, res, next) => {
  const errs = validationResult(req);
  return errs.isEmpty() ? next() : fail(res, errs.array()[0].msg, 400);
};

const parseRequiredJudges = (val, fb = 3) => {
  if (val === undefined || val === null || val === '') return { valid: true, value: fb };
  const n = Number(val);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? { valid: true, value: n } : { valid: false, value: null };
};

module.exports = { handleValidationErrors, parseRequiredJudges };
