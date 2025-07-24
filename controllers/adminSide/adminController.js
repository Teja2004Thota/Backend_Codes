import * as adminService from '../../services/adminSide/adminService.js';
import pool from '../../config/db.js';

export const createUserController = async (req, res) => {
  const { staffNo, password, role } = req.body;

  try {
    if (!staffNo || !role) {
      return res.status(400).json({ success: false, message: 'StaffNo and role are required' });
    }

    // ✅ Check: Users must have numeric-only staffNo
    if (role === 'user' && !/^\d+$/.test(staffNo)) {
      return res.status(400).json({ success: false, message: 'Users must use numeric staff numbers only' });
    }

    // ✅ Password is required for admin/subadmin
    if ((role === 'admin' || role === 'subadmin') && !password) {
      return res.status(400).json({ success: false, message: 'Password is required for admin and subadmin' });
    }

    await adminService.createUser(staffNo, password, role);

    res.status(201).json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const importUsersController = async (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    if (!fileBuffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const result = await adminService.importUsersFromFile(fileBuffer);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAdminDashboardSummaryController = async (req, res) => {
  try {
    const { month, year } = req.query;
    const summary = await adminService.getAdminDashboardSummary(month, year);
    res.status(200).json({ success: true, ...summary });
  } catch (error) {
    console.error('Error fetching admin dashboard summary:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllComplaintsForAdmin = async (req, res) => {
  try {
    const { onlyTopDepartment } = req.query;
    const complaints = await adminService.fetchAllComplaintsWithAIResolved({ onlyTopDepartment });
    res.status(200).json({ success: true, complaints });
  } catch (error) {
    console.error('Error fetching complaints:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints' });
  }
};


export const getRepeatedComplaintsController = async (req, res) => {
  try {
    const data = await adminService.getRepeatedComplaints();
    res.status(200).json({ success: true, repeated: data });
  } catch (err) {
    console.error('Error fetching repeated complaints:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch repeated complaints' });
  }
};

export const getAllSubadminsWithPerformanceController = async (req, res) => {
  try {
    const data = await adminService.getAllSubadminsWithPerformance();
    res.status(200).json({ success: true, subadmins: data });
  } catch (error) {
    console.error('Error fetching subadmin performance:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch subadmin performance' });
  }
};

export const getSubadminComplaintsByMainIssueController = async (req, res) => {
  try {
    const subadminId = parseInt(req.params.subadminId);
    const mainIssueId = parseInt(req.params.mainIssueId);

    if (isNaN(subadminId) || isNaN(mainIssueId)) {
      return res.status(400).json({ success: false, message: 'Invalid subadminId or mainIssueId' });
    }

    const complaints = await adminService.getComplaintsBySubadminAndMainIssue(subadminId, mainIssueId);

    return res.status(200).json({
      success: true,
      complaints
    });
  } catch (error) {
    console.error('Error in getSubadminComplaintsByMainIssueController:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching complaints'
    });
  }
};

export const getSubadmins = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sp.name
      FROM users_details ud
      JOIN subadmin_profiles sp ON ud.id = sp.subadmin_id
      WHERE ud.role = 'subadmin'
    `);

    res.status(200).json({ success: true, subadmins: rows });
  } catch (err) {
    console.error('Error fetching subadmins:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const assignComplaintController = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { assignedTo } = req.body;

    if (!complaintId || !assignedTo) {
      return res.status(400).json({ success: false, message: 'Complaint ID and subadmin name are required' });
    }

    const [[row]] = await pool.query(
      `SELECT ud.id AS subadminId
       FROM users_details ud
       JOIN subadmin_profiles sp ON ud.id = sp.subadmin_id
       WHERE sp.name = ? AND ud.role = 'subadmin'`,
      [assignedTo]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Subadmin not found' });
    }

    await pool.query(
      `UPDATE user_complaints
       SET assigned_to_id = ?, status = 'Assigned', updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [row.subadminId, complaintId]
    );

    res.status(200).json({ success: true, message: `Assigned to ${assignedTo}` });
  } catch (error) {
    console.error('❌ Error assigning complaint:', error.message);
    res.status(500).json({ success: false, message: 'Server error during assignment' });
  }
};

export const getTopRepeatComplainersController = async (req, res) => {
  try {
    const topComplainers = await adminService.getTopRepeatComplainers();
    res.status(200).json({ success: true, topComplainers });
  } catch (error) {
    console.error('Error fetching top complainers:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch top complainers' });
  }
};

export const getUserComplaintTimelineController = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }
    const timeline = await adminService.getUserComplaintTimeline(userId);
    res.status(200).json({ success: true, timeline });
  } catch (error) {
    console.error('Error fetching user complaint timeline:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch user complaint timeline' });
  }
};

export const getAllUsersWithSummaryController = async (req, res) => {
  try {
    const data = await adminService.getAllUsersWithComplaintSummary();
    res.status(200).json({ success: true, users: data });
  } catch (err) {
    console.error('Error in getAllUsersWithSummaryController:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getHighPriorityComplaintsController = async (req, res) => {
  try {
    const data = await adminService.getHighPriorityComplaintsDetailed();
    res.status(200).json({ success: true, complaints: data });
  } catch (err) {
    console.error('Error fetching high priority complaints:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch high priority complaints' });
  }
};

export const createMainIssue = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Main issue name required' });

    const [result] = await pool.query('INSERT INTO main_issues (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, id: result.insertId, message: 'Main issue added' });
  } catch (err) {
    console.error('Error creating main issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create main issue' });
  }
};

export const createRelatedIssue = async (req, res) => {
  try {
    const { main_issue_id, name } = req.body;
    if (!main_issue_id || !name) return res.status(400).json({ success: false, message: 'Main issue ID and name required' });

    const [result] = await pool.query('INSERT INTO related_issues (main_issue_id, name) VALUES (?, ?)', [main_issue_id, name]);
    res.status(201).json({ success: true, id: result.insertId, message: 'Related issue added' });
  } catch (err) {
    console.error('Error creating related issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create related issue' });
  }
};

export const createSubRelatedIssue = async (req, res) => {
  try {
    const { related_issue_id, name } = req.body;
    if (!related_issue_id || !name) return res.status(400).json({ success: false, message: 'Related issue ID and name required' });

    const [result] = await pool.query('INSERT INTO sub_related_issues (related_issue_id, name) VALUES (?, ?)', [related_issue_id, name]);
    res.status(201).json({ success: true, id: result.insertId, message: 'Sub-related issue added' });
  } catch (err) {
    console.error('Error creating sub-related issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create sub-related issue' });
  }
};

export const createIssueDescription = async (req, res) => {
  try {
    const { sub_related_issue_id, description } = req.body;
    if (!sub_related_issue_id || !description) return res.status(400).json({ success: false, message: 'Sub-related issue ID and description required' });

    const [result] = await pool.query('INSERT INTO issue_descriptions (sub_related_issue_id, description) VALUES (?, ?)', [sub_related_issue_id, description]);
    res.status(201).json({ success: true, id: result.insertId, message: 'Issue description added' });
  } catch (err) {
    console.error('Error creating description:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create description' });
  }
};

export const createIssueSolution = async (req, res) => {
  try {
    const { issue_description_id, step_number, step_instruction, sub_related_issue_id } = req.body;

    if (
      issue_description_id === undefined ||
      step_number === undefined ||
      step_instruction === undefined ||
      step_instruction.trim() === ''
    ) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    const [result] = await pool.query(`
      INSERT INTO issue_solutions (issue_description_id, step_number, step_instruction, sub_related_issue_id)
      VALUES (?, ?, ?, ?)
    `, [issue_description_id, step_number, step_instruction, sub_related_issue_id || null]);

    res.status(201).json({ success: true, id: result.insertId, message: 'Solution step added' });
  } catch (err) {
    console.error('❌ Error creating solution:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create solution' });
  }
};


// Optional: Future enhancement for bulk Excel import
export const importFullIssueHierarchy = async (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    if (!fileBuffer) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const result = await adminService.importFullHierarchyFromExcel(fileBuffer);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// READ main issues (for admin)
export const getMainIssuesForAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, name FROM main_issues ORDER BY id`);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Failed to fetch main issues:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch main issues' });
  }
};

// READ related issues (for admin)
export const getRelatedIssuesForAdmin = async (req, res) => {
  try {
    const { main_issue_id } = req.query;
    if (!main_issue_id) return res.status(400).json({ success: false, message: 'main_issue_id is required' });

    const [rows] = await pool.query(
      `SELECT id, name FROM related_issues WHERE main_issue_id = ? ORDER BY id`,
      [main_issue_id]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Failed to fetch related issues:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch related issues' });
  }
};

// READ sub-related issues (for admin)
export const getSubRelatedIssuesForAdmin = async (req, res) => {
  try {
    const { related_issue_id } = req.query;
    if (!related_issue_id) return res.status(400).json({ success: false, message: 'related_issue_id is required' });

    const [rows] = await pool.query(
      `SELECT id, name FROM sub_related_issues WHERE related_issue_id = ? ORDER BY id`,
      [related_issue_id]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Failed to fetch sub-related issues:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch sub-related issues' });
  }
};

// GET descriptions by sub-related issue ID
export const getDescriptions = async (req, res) => {
  const { sub_related_issue_id } = req.query;
  try {
    if (!sub_related_issue_id) {
      return res.status(400).json({ success: false, message: 'sub_related_issue_id is required' });
    }

    const [rows] = await pool.query(
      'SELECT id, description FROM issue_descriptions WHERE sub_related_issue_id = ?',
      [sub_related_issue_id]
    );
    res.status(200).json({ success: true, descriptions: rows });
  } catch (err) {
    console.error('Failed to fetch descriptions:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch descriptions', error: err.message });
  }
};


// GET solutions by description ID
export const getSolutions = async (req, res) => {
  const { issue_description_id } = req.query;

  try {
    if (!issue_description_id) {
      return res.status(400).json({ success: false, message: 'issue_description_id is required' });
    }

    const [rows] = await pool.query(
      'SELECT id, step_number, step_instruction FROM issue_solutions WHERE issue_description_id = ?',
      [issue_description_id]
    );

    res.status(200).json({ success: true, solutions: rows });
  } catch (err) {
    console.error('Failed to fetch solutions:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch solutions', error: err.message });
  }
};

export const updateMainIssue = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    await pool.query(`UPDATE main_issues SET name = ? WHERE id = ?`, [name, id]);
    res.status(200).json({ success: true, message: 'Main issue updated successfully' });
  } catch (err) {
    console.error('Error updating main issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update main issue' });
  }
};

export const deleteMainIssue = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM main_issues WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: 'Main issue deleted successfully' });
  } catch (err) {
    console.error('Error deleting main issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete main issue' });
  }
};

export const updateRelatedIssue = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    await pool.query(`UPDATE related_issues SET name = ? WHERE id = ?`, [name, id]);
    res.status(200).json({ success: true, message: 'Related issue updated successfully' });
  } catch (err) {
    console.error('Error updating related issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update related issue' });
  }
};

export const deleteRelatedIssue = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM related_issues WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: 'Related issue deleted successfully' });
  } catch (err) {
    console.error('Error deleting related issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete related issue' });
  }
};

export const updateSubRelatedIssue = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    await pool.query(`UPDATE sub_related_issues SET name = ? WHERE id = ?`, [name, id]);
    res.status(200).json({ success: true, message: 'Sub-related issue updated successfully' });
  } catch (err) {
    console.error('Error updating sub-related issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update sub-related issue' });
  }
};

export const deleteSubRelatedIssue = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM sub_related_issues WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: 'Sub-related issue deleted successfully' });
  } catch (err) {
    console.error('Error deleting sub-related issue:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete sub-related issue' });
  }
};

export const updateIssueDescription = async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  try {
    await pool.query(`UPDATE issue_descriptions SET description = ? WHERE id = ?`, [description, id]);
    res.status(200).json({ success: true, message: 'Description updated successfully' });
  } catch (err) {
    console.error('Error updating description:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update description' });
  }
};

export const deleteIssueDescription = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM issue_descriptions WHERE id = ?`, [id]);
    res.status(200).json({ success: true, message: 'Description deleted successfully' });
  } catch (err) {
    console.error('Error deleting description:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete description' });
  }
};

export const updateIssueSolution = async (req, res) => {
  const { id } = req.params;
  const { step_number, step_instruction } = req.body;

  try {
    await pool.query(
      `UPDATE issue_solutions SET step_number = ?, step_instruction = ? WHERE id = ?`,
      [step_number, step_instruction, id]
    );
    res.status(200).json({ success: true, message: 'Solution updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllAdminsWithProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ap.admin_id,
        ap.name,
        ap.department,
        ap.designation,
        ap.phone,
        ap.contacts,
        ud.staffNo
      FROM admin_profiles ap
      JOIN users_details ud ON ap.admin_id = ud.id
      WHERE ud.role = 'admin'
    `);

    const formatted = rows.map((admin) => ({
      ...admin,
      contacts: admin.contacts ? JSON.parse(admin.contacts) : [],
    }));

    res.status(200).json({ success: true, admins: formatted });
  } catch (err) {
    console.error('Error fetching admin profiles:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch admin profiles' });
  }
};
export const deleteAdminByStaffNo = async (req, res) => {
  const { staffNo } = req.params;

  try {
    const [user] = await pool.query(`SELECT id FROM users_details WHERE staffNo = ? AND role = 'admin'`, [staffNo]);

    if (user.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const userId = user[0].id;

    await pool.query(`DELETE FROM admin_profiles WHERE admin_id = ?`, [userId]);
    await pool.query(`DELETE FROM users_details WHERE id = ? AND role = 'admin'`, [userId]);

    res.status(200).json({ success: true, message: 'Admin deleted successfully' });
  } catch (err) {
    console.error('Error deleting admin:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete admin' });
  }
};

export const deleteUserByStaffNo = async (req, res) => {
  const { staffNo } = req.params;

  try {
    const [[user]] = await pool.query(
      `SELECT id FROM users_details WHERE staffNo = ? AND role = 'user'`,
      [staffNo]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userId = user.id;

    await pool.query(`DELETE FROM user_profiles WHERE user_id = ?`, [userId]);
    await pool.query(`DELETE FROM users_details WHERE id = ? AND role = 'user'`, [userId]);

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};



export default {
  createUserController,
  importUsersController,
  getAdminDashboardSummaryController,
  getAllComplaintsForAdmin,
  getRepeatedComplaintsController,
  getAllSubadminsWithPerformanceController,
  getSubadminComplaintsByMainIssueController,
  getSubadmins,
  assignComplaintController,
  getTopRepeatComplainersController,
  getUserComplaintTimelineController,
  getAllUsersWithSummaryController,
  getHighPriorityComplaintsController,


    createMainIssue,
  createRelatedIssue,
  createSubRelatedIssue,
  createIssueDescription,
  createIssueSolution,
  importFullIssueHierarchy,

  getMainIssuesForAdmin,
  getRelatedIssuesForAdmin,
  getSubRelatedIssuesForAdmin,
getDescriptions,
  getSolutions,

  updateMainIssue,
  deleteMainIssue,
  updateRelatedIssue,
  deleteRelatedIssue,
  updateSubRelatedIssue,
  deleteSubRelatedIssue,
  updateIssueDescription,
  deleteIssueDescription,
  updateIssueSolution,

  getAllAdminsWithProfile,
  deleteAdminByStaffNo,
  deleteUserByStaffNo,

};