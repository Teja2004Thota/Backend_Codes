import express from 'express';
import { authMiddleware } from '../middleware/authentication/authMiddleware.js';

const router = express.Router();

// User dashboard access - protected
router.get('/user', authMiddleware(['user']), (req, res) => {
  res.status(200).json({ message: 'User dashboard accessed successfully' });
});

// Subadmin dashboard access - protected
router.get('/subadmin', authMiddleware(['subadmin']), (req, res) => {
  res.status(200).json({ message: 'Subadmin dashboard accessed successfully' });
});

// Admin dashboard access - protected
router.get('/admin', authMiddleware(['admin']), (req, res) => {
  res.status(200).json({ message: 'Admin dashboard accessed successfully' });
});

export default router;