import pool from '../../config/db.js';
import bcrypt from 'bcryptjs';
import logger from '../../utils/logger.js';

export const upsertUserProfile = async (userId, role, { name, department, photo, newPassword, phone, designation, contacts }) => {
  let profileTable, idField;
  switch (role) {
    case 'subadmin': profileTable = 'subadmin_profiles'; idField = 'subadmin_id'; break;
    case 'admin': profileTable = 'admin_profiles'; idField = 'admin_id'; break;
    case 'user': profileTable = 'user_profiles'; idField = 'user_id'; break;
    default: throw new Error('Invalid role');
  }

  const [existing] = await pool.query(`SELECT * FROM ${profileTable} WHERE ${idField} = ?`, [userId]);

  const contactsJson = JSON.stringify(contacts || []);

  if (existing.length > 0) {
    const updateQuery = `
      UPDATE ${profileTable}
      SET name = ?, department = ?, photo = ?, designation = ?, contacts = ?
      WHERE ${idField} = ?
    `;
    await pool.query(updateQuery, [name, department, photo, designation, contactsJson, userId]);
  } else {
    const insertQuery = `
      INSERT INTO ${profileTable}
      (${idField}, name, department, photo, designation, contacts)
VALUES (?, ?, ?, ?, ?, ?)

    `;
    await pool.query(insertQuery, [userId, name, department, photo, designation, contactsJson]);

  }

  if (newPassword?.trim().length >= 6) {
    const hashed = await bcrypt.hash(newPassword.trim(), 10);
    await pool.query(`UPDATE users_details SET hashedDob = ? WHERE id = ?`, [hashed, userId]);
  }

  const [updated] = await pool.query(`SELECT * FROM ${profileTable} WHERE ${idField} = ?`, [userId]);
  return updated[0];
};

export const getUserProfile = async (userId, role) => {
  let profileTable, idField;
  switch (role) {
    case 'user':
      profileTable = 'user_profiles';
      idField = 'user_id';
      break;
    case 'subadmin':
      profileTable = 'subadmin_profiles';
      idField = 'subadmin_id';
      break;
    case 'admin':
      profileTable = 'admin_profiles';
      idField = 'admin_id';
      break;
    default:
      throw new Error('Invalid role');
  }

  const [rows] = await pool.query(
    `SELECT p.*, u.staffNo 
     FROM ${profileTable} p
     JOIN users_details u ON u.id = p.${idField}
     WHERE p.${idField} = ?`,
    [userId]
  );

  return rows[0]; // includes staffNo now
};
