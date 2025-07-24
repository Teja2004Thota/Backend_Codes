import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const users_details = [
  { staffNo: '200410', password: 'Teja@admin', role: 'admin' },
  { staffNo: '200412', password: 'Teja@subadmin', role: 'subadmin' },
  { staffNo: '101204', password: 'Teja@user', role: 'user' },
];

const insertUsers = async () => {
  try {
    for (const user of users_details) {
      const normalizedStaffNo = user.staffNo.replace(/[\s-]/g, '');

      // Check if user already exists
      const [existing] = await pool.query(
        'SELECT * FROM users_details WHERE staffNo = ?',
        [normalizedStaffNo]
      );

      if (existing.length > 0) {
        logger.warn(`User with staffNo ${normalizedStaffNo} already exists`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);

      await pool.query(
        'INSERT INTO users_details (staffNo, hashedDob, role) VALUES (?, ?, ?)',
        [normalizedStaffNo, hashedPassword, user.role]
      );

      logger.info(`✅ Inserted ${user.role}`, { staffNo: normalizedStaffNo });
    }

    logger.info('✅ All predefined users inserted successfully');
  } catch (err) {
    logger.error('❌ Failed to insert users', { error: err.message });
  } finally {
    await pool.end();
  }
};

insertUsers();
