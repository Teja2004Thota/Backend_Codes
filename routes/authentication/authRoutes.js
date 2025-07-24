import express from 'express';
import { loginController } from '../../controllers/authentication/authController.js';
import { resetUserPasswordController,resetSubadminPasswordController,resetAdminPasswordController } from '../../controllers/authentication/authController.js';
import { authMiddleware } from '../../middleware/authentication/authMiddleware.js';


const router = express.Router();

router.post('/login', loginController);
router.post('/user/reset-password', resetUserPasswordController);
router.post(
  '/subadmin/reset-password',
  authMiddleware(['admin']),  // ⬅ Only admins can reset subadmin passwords
  resetSubadminPasswordController
);
router.post(
  '/admin/reset-password',
  authMiddleware(['admin']), // Only an admin can reset other admin's password
  resetAdminPasswordController
);


export default router;