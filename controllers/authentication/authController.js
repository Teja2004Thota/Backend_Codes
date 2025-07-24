import { body, validationResult } from 'express-validator';
import login from '../../services/authentication/authService.js';
import logger from '../../utils/logger.js';
import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { resetSubadminPassword } from '../../services/authentication/authService.js';
import { resetAdminPassword } from '../../services/authentication/authService.js';

export const loginController = [
  body('staffNo')
    .trim()
    .notEmpty()
    .withMessage('Username or staff number is required'),

  body('password')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Password is required'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors in login', { errors: errors.array().map(err => err.msg) });
      return res.status(400).json({ success: false, message: 'Invalid input data', errors: errors.array() });
    }

    const { staffNo, password } = req.body;

    try {
      const { token, role, userId } = await login(staffNo, password);

      // ✅ Role-based validation after login
      if (role === 'user' && !/^\d+$/.test(staffNo)) {
        return res.status(400).json({ success: false, message: 'Users must use numeric staff numbers only' });
      }

      res.json({ success: true, token, role, userId });
    } catch (err) {
      logger.error('Login failed', { error: err.message });
      res.status(401).json({ success: false, message: err.message });
    }
  },
];


export const resetUserPasswordController = async (req, res) => {
  const { staffNo, newPassword, confirmPassword } = req.body;

  if (!staffNo || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  const hashed = await bcrypt.hash(newPassword.trim(), 10);

  try {
    const [result] = await pool.query('UPDATE users_details SET hashedDob = ? WHERE staffNo = ? AND role = "user"', [hashed, staffNo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found or invalid role' });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal error' });
  }
};


export const resetSubadminPasswordController = [
  body('staffNo')
    .trim()
    .notEmpty()
    .withMessage('Staff number is required'),
  body('newPassword')
    .trim()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('confirmPassword')
    .trim()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors in subadmin password reset', {
        errors: errors.array().map(err => err.msg),
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array(),
      });
    }

    const { staffNo, newPassword } = req.body;

    try {
      const result = await resetSubadminPassword(staffNo, newPassword); // ✅
      res.json(result);
    } catch (err) {
      logger.error('Subadmin password reset failed', { error: err.message });
      res.status(500).json({ success: false, message: err.message });
    }
  },
];

export const resetAdminPasswordController = [
  body('staffNo')
    .trim()
    .notEmpty()
    .withMessage('Staff number is required'),
  body('newPassword')
    .trim()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('confirmPassword')
    .trim()
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors in admin password reset', {
        errors: errors.array().map(err => err.msg),
      });
      return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
    }

    const { staffNo, newPassword } = req.body;

    try {
      const result = await resetAdminPassword(staffNo, newPassword);
      res.json(result);
    } catch (err) {
      logger.error('Admin password reset failed', { error: err.message });
      res.status(500).json({ success: false, message: err.message });
    }
  },
];
