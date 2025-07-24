import pool from '../config/db.js';
import logger from '../utils/logger.js';

const User = {
  findByStaffNo: async (staffNo) => {
    try {
      const normalizedStaffNo = staffNo.replace(/[\s-]/g, '');
      const [rows] = await pool.query('SELECT id, role, staffNo, hashedDob FROM users_details WHERE staffNo = ?', [normalizedStaffNo]);
      return rows[0];
    } catch (err) {
      logger.error('Error finding user by staffNo', { error: err.message, staffNo });
      throw err;
    }
  },
};

export default User;