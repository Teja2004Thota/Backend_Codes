import bcrypt from 'bcryptjs';
import { generateToken } from '../../utils/jwt.js';
import logger from '../../utils/logger.js';
import pool from '../../config/db.js'; // ✅ Required for password update
import User from '../../models/userModel.js';

// 🔐 Login Function
const login = async (staffNo, password) => {
  const normalizedStaffNo = staffNo.replace(/[\s-]/g, '');
  const user = await User.findByStaffNo(normalizedStaffNo);

  if (!user) {
    logger.warn('User not found during login');
    throw new Error('User with this StaffNumber does not exist');
  }

  if (!password || !user.hashedDob) {
    throw new Error('Password is required for this account');
  }

  const isMatch = await bcrypt.compare(password, user.hashedDob);
  if (!isMatch) {
    throw new Error('Incorrect password provided');
  }

  const token = generateToken({ id: user.id, role: user.role, staffNo: user.staffNo });
  return { token, role: user.role, userId: user.id };
};

// 🔁 Reset Subadmin Password Function
export const resetSubadminPassword = async (staffNo, newPassword) => {
  try {
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    const [result] = await pool.query(
      'UPDATE users_details SET hashedDob = ? WHERE staffNo = ? AND role = "subadmin"',
      [hashedPassword, staffNo]
    );

    if (result.affectedRows === 0) {
      throw new Error('Subadmin not found or invalid role');
    }

    return { success: true, message: 'Subadmin password updated successfully' };
  } catch (error) {
    throw new Error(`Failed to reset subadmin password: ${error.message}`);
  }
};

export const resetAdminPassword = async (staffNo, newPassword) => {
  try {
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    const [result] = await pool.query(
      'UPDATE users_details SET hashedDob = ? WHERE staffNo = ? AND role = "admin"',
      [hashedPassword, staffNo]
    );

    if (result.affectedRows === 0) {
      throw new Error('Admin not found or invalid role');
    }

    return { success: true, message: 'Admin password updated successfully' };
  } catch (error) {
    throw new Error(`Failed to reset admin password: ${error.message}`);
  }
};


export default login;
