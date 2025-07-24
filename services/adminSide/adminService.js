import pool from '../../config/db.js';
import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import { parse, isValid, format } from 'date-fns';
import { getUserComplaintSummary } from '../../services/userSide/complaintService.js';



export const createUser = async (staffNo, password, role) => {
  const [existingUser] = await pool.query(
    'SELECT id FROM users_details WHERE staffNo = ?',
    [staffNo]
  );

  if (existingUser.length > 0) {
    throw new Error('User already exists with this staff number');
  }

  let hashedDob;

  // ✅ If password not provided (only allowed for user), fallback to staffNo as password
  if (!password) {
    if (role === 'user') {
      hashedDob = await bcrypt.hash(staffNo.trim(), 10);  // hash staffNo as password
    } else {
      throw new Error('Password is required for admin and subadmin');
    }
  } else {
    hashedDob = await bcrypt.hash(password.trim(), 10);
  }

  await pool.query(
    'INSERT INTO users_details (staffNo, hashedDob, role) VALUES (?, ?, ?)',
    [staffNo.trim(), hashedDob, role]
  );
};

export const importUsersFromFile = async (fileBuffer) => {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const users = xlsx.utils.sheet_to_json(sheet);

  let created = 0;
  let updated = 0;
  let failed = [];

  for (const user of users) {
    const staffNo = String(user.staffNo).trim();
    const role = String(user.role).toLowerCase();
    let rawPassword = user.password;

    // ✅ Basic validation
    if (!staffNo || !['admin', 'subadmin', 'user'].includes(role)) {
      failed.push({ staffNo, reason: 'Invalid or missing fields' });
      continue;
    }

    // ✅ Enforce numeric staffNo for users only
    if (role === 'user' && !/^\d+$/.test(staffNo)) {
      failed.push({ staffNo, reason: 'Users must have numeric staff numbers only' });
      continue;
    }

    // ✅ Admin/Subadmin must have password
    if ((role === 'admin' || role === 'subadmin') && (!rawPassword && rawPassword !== 0)) {
      failed.push({ staffNo, reason: 'Password is required for admin and subadmin' });
      continue;
    }

    // ✅ Default user password to staffNo if not provided
    if (role === 'user' && (!rawPassword && rawPassword !== 0)) {
      rawPassword = staffNo;
    }

    // ✅ Hash password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(String(rawPassword).trim(), 10);
    } catch (err) {
      failed.push({ staffNo, reason: 'Password hash error' });
      continue;
    }

    try {
      let userId;
      const [existingUser] = await pool.query(
        'SELECT id FROM users_details WHERE staffNo = ?',
        [staffNo]
      );

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        await pool.query(
          'UPDATE users_details SET hashedDob = ?, role = ? WHERE staffNo = ?',
          [hashedPassword, role, staffNo]
        );
        updated++;
      } else {
        const [result] = await pool.query(
          'INSERT INTO users_details (staffNo, hashedDob, role) VALUES (?, ?, ?)',
          [staffNo, hashedPassword, role]
        );
        userId = result.insertId;
        created++;
      }

      const name = user.name?.trim() || '';
      const department = user.department?.trim() || '';
      const designation = user.designation?.trim() || '';
      const photo = user.photo?.trim() || null;

      let contacts = '[]';
      if (user.contacts !== undefined && user.contacts !== null) {
        if (Array.isArray(user.contacts)) {
          contacts = JSON.stringify(user.contacts);
        } else if (!isNaN(user.contacts)) {
          contacts = JSON.stringify([String(user.contacts)]);
        } else if (typeof user.contacts === 'string') {
          try {
            const parsed = JSON.parse(user.contacts);
            contacts = Array.isArray(parsed) ? JSON.stringify(parsed) : JSON.stringify([parsed]);
          } catch (e) {
            contacts = JSON.stringify([user.contacts.trim()]);
          }
        }
      }

      let profileTable = '';
      let idField = '';
      if (role === 'user') {
        profileTable = 'user_profiles';
        idField = 'user_id';
      } else if (role === 'admin') {
        profileTable = 'admin_profiles';
        idField = 'admin_id';
      } else if (role === 'subadmin') {
        profileTable = 'subadmin_profiles';
        idField = 'subadmin_id';
      }

      const [existingProfile] = await pool.query(
        `SELECT * FROM ${profileTable} WHERE ${idField} = ?`,
        [userId]
      );

      if (existingProfile.length > 0) {
        await pool.query(
          `UPDATE ${profileTable} SET name = ?, department = ?, designation = ?, contacts = ?, photo = ? WHERE ${idField} = ?`,
          [name, department, designation, contacts, photo, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO ${profileTable} (${idField}, name, department, designation, contacts, photo) VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, name, department, designation, contacts, photo]
        );
      }
    } catch (err) {
      failed.push({ staffNo, reason: err.message });
    }
  }

  return { created, updated, failed };
};

export const getAdminsAndSubadmins = async () => {
  const [admins] = await pool.query(`
    SELECT 
      ud.id,
      ud.staffNo,
      ud.role,
      ap.name,
      ap.department,
      ap.email,
      ud.createdAt AS lastActive,
      'active' AS status
    FROM users_details ud
    LEFT JOIN admin_profiles ap ON ap.admin_id = ud.id
    WHERE ud.role = 'admin'
    UNION
    SELECT 
      ud.id,
      ud.staffNo,
      ud.role,
      sp.name,
      sp.department,
      sp.email,
      ud.createdAt AS lastActive,
      'active' AS status
    FROM users_details ud
    LEFT JOIN subadmin_profiles sp ON sp.subadmin_id = ud.id
    WHERE ud.role = 'subadmin'
  `);

  return admins;
};

export const fetchAllComplaintsWithAIResolved = async () => {
  const [rows] = await pool.query(`
    SELECT 
      uc.*,
      up.name AS userName,
      mi.name AS mainIssue,
      ri.name AS relatedIssue,
      sri.name AS subRelatedIssue,
      sp.name AS assignedTo
    FROM user_complaints uc
    JOIN users_details u ON uc.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN main_issues mi ON mi.id = uc.main_issue_id
    LEFT JOIN related_issues ri ON ri.id = uc.related_issue_id
    LEFT JOIN sub_related_issues sri ON sri.id = uc.sub_related_issue_id
    LEFT JOIN subadmin_profiles sp ON sp.subadmin_id = uc.assigned_to_id
    WHERE uc.deleted_at IS NULL
    ORDER BY uc.created_at DESC
  `);

  return rows;
};

export const getAdminDashboardSummary = async (month = null, year = null) => {
  try {
    let monthCondition = '';
    let params = [];
    if (month && year) {
      const monthNum = new Date(`${month}-01-${year}`).getMonth() + 1;
      monthCondition = 'AND MONTH(uc.created_at) = ? AND YEAR(uc.created_at) = ?';
      params = [monthNum, year];
    }

    const [[totalComplaints]] = await pool.query(`
      SELECT COUNT(*) AS total FROM user_complaints uc
      WHERE uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const [[pendingComplaints]] = await pool.query(`
      SELECT COUNT(*) AS pending FROM user_complaints uc
      WHERE (uc.status = 'Open' OR uc.status = 'Assigned' OR uc.status = 'Pending') AND uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const [[totalResolved]] = await pool.query(`
      SELECT COUNT(*) AS totalResolved FROM user_complaints uc
      WHERE uc.status = 'Closed' AND uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const [[aiResolved]] = await pool.query(`
      SELECT COUNT(*) AS aiResolved FROM ai_resolution_logs
      WHERE is_resolved = 1 ${month ? 'AND MONTH(created_at) = ? AND YEAR(created_at) = ?' : ''}
    `, month ? [new Date(`${month}-01-${year}`).getMonth() + 1, year] : []);

    const [[resolvedBySubAdmin]] = await pool.query(`
      SELECT COUNT(*) AS resolvedBySubAdmin
      FROM user_complaints uc
      JOIN users_details ud ON uc.done_by_id = ud.id
      WHERE uc.status = 'Closed' AND ud.role = 'subadmin' AND uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const totalResolvedCount = totalResolved.totalResolved || 0;
    const aiResolvedCount = aiResolved.aiResolved || 0;
    const humanResolvedCount = totalResolvedCount - aiResolvedCount;
    const aiVsHuman = totalResolvedCount > 0
      ? `${Math.round((aiResolvedCount / totalResolvedCount) * 100)}% AI, ${Math.round((humanResolvedCount / totalResolvedCount) * 100)}% Human`
      : '0% AI, 0% Human';

const [[highPriority]] = await pool.query(`
  SELECT COUNT(*) AS highPriority
  FROM user_complaints uc
  LEFT JOIN user_profiles up ON uc.user_id = up.user_id
  WHERE uc.deleted_at IS NULL
    AND (
      uc.priority = 'High' OR
      up.department IN ('SENIOR DEPUTY GENERAL MANAGER', 'ADDITIONAL GENERAL MANAGER', 'GENERAL MANAGER')
    )
    ${monthCondition}
`, params);


    const [[totalUsers]] = await pool.query(`
      SELECT COUNT(*) AS totalUsers FROM users_details
      WHERE role = 'user'
    `);

    const [[totalSubAdmins]] = await pool.query(`
      SELECT COUNT(*) AS totalSubAdmins FROM users_details
      WHERE role = 'subadmin'
    `);

    const [categories] = await pool.query(`
      SELECT 
        mi.name AS name, 
        COUNT(uc.id) AS value
      FROM main_issues mi
      LEFT JOIN user_complaints uc ON uc.main_issue_id = mi.id AND uc.deleted_at IS NULL ${monthCondition}
      GROUP BY mi.id, mi.name
      ORDER BY mi.id
    `, params);

    const [monthlyStats] = await pool.query(`
      SELECT 
        MONTH(uc.created_at) AS monthNum,
        DATE_FORMAT(MIN(uc.created_at), '%b') AS month,
        COUNT(*) AS raised,
        SUM(CASE WHEN uc.status = 'Closed' THEN 1 ELSE 0 END) AS resolved
      FROM user_complaints uc
      WHERE uc.deleted_at IS NULL AND YEAR(uc.created_at) = ?
      GROUP BY MONTH(uc.created_at)
      ORDER BY MONTH(uc.created_at)
    `, [year || new Date().getFullYear()]);

    const [[avgTime]] = await pool.query(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, uc.created_at, uc.updated_at)) AS avgResolutionHours
      FROM user_complaints uc
      WHERE uc.status = 'Closed' AND uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const [[minorCount]] = await pool.query(`
      SELECT COUNT(*) AS count FROM user_complaints uc
      WHERE uc.severity = 'Minor' AND uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const [[majorCount]] = await pool.query(`
      SELECT COUNT(*) AS count FROM user_complaints uc
      WHERE uc.severity = 'Major' AND uc.deleted_at IS NULL ${monthCondition}
    `, params);

    const [yearlyStats] = await pool.query(`
      SELECT 
        YEAR(uc.created_at) AS year,
        COUNT(*) AS complaints,
        SUM(CASE WHEN uc.status = 'Closed' THEN 1 ELSE 0 END) AS resolved
      FROM user_complaints uc
      WHERE uc.deleted_at IS NULL
      GROUP BY YEAR(uc.created_at)
      ORDER BY YEAR(uc.created_at)
    `);

    const [[totalAdmins]] = await pool.query(`
      SELECT COUNT(*) AS totalAdmins FROM users_details
      WHERE role = 'admin'
    `);


    const [feedbackStats] = await pool.query(`
  SELECT 
    label,
    COUNT(*) AS count
  FROM complaint_feedback
  GROUP BY label
`);

const [feedbackBySubadmin] = await pool.query(`
  SELECT
    sa.name AS subadminName,
    f.label,
    COUNT(*) AS count
  FROM complaint_feedback f
  JOIN subadmin_profiles sa ON f.subadmin_id = sa.subadmin_id
  WHERE f.label IN ('Good', 'Excellent') -- optional filter
  GROUP BY sa.name, f.label
  ORDER BY count DESC
`);

return {
  totalComplaints: totalComplaints.total || 0,
  pendingComplaints: pendingComplaints.pending || 0,
  totalResolved: totalResolved.totalResolved || 0,
  aiResolved: aiResolved.aiResolved || 0,
  resolvedBySubAdmin: resolvedBySubAdmin.resolvedBySubAdmin || 0,
  aiVsHuman,
  highPriority: highPriority.highPriority || 0,
  totalUsers: totalUsers.totalUsers || 0,
  totalSubAdmins: totalSubAdmins.totalSubAdmins || 0,
  totalAdmins: totalAdmins.totalAdmins || 0,
  minorComplaints: minorCount.count || 0,
  majorComplaints: majorCount.count || 0,

  categories: categories.map(cat => ({
    ...cat,
    color: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'][categories.indexOf(cat) % 5]
  })),

  feedbackStats: feedbackStats.map(row => ({
    label: row.label,
    count: row.count
  })),

  feedbackBySubadmin: feedbackBySubadmin.map(row => ({
    subadminName: row.subadminName,
    label: row.label,
    count: row.count
  })),

  monthlyStats,
  yearlyStats,
  avgResolutionTime: avgTime.avgResolutionHours
    ? parseFloat((avgTime.avgResolutionHours / 24).toFixed(1))
    : null
};


  } catch (error) {
    console.error('Error in getAdminDashboardSummary:', error.message);
    throw new Error('Failed to fetch dashboard summary');
  }
};

export const getHighPriorityComplaintsDetailed = async () => {
  const [rows] = await pool.query(`
    SELECT 
      uc.id AS complaint_id,
      uc.description,
      uc.status,
      uc.priority,
      uc.created_at,
      up.name AS user_name,
      up.department,
      mi.name AS main_issue,
      ri.name AS related_issue,
      sri.name AS sub_related_issue,
      sa.name AS assigned_to
    FROM user_complaints uc
    LEFT JOIN user_profiles up ON uc.user_id = up.user_id
    LEFT JOIN main_issues mi ON uc.main_issue_id = mi.id
    LEFT JOIN related_issues ri ON uc.related_issue_id = ri.id
    LEFT JOIN sub_related_issues sri ON uc.sub_related_issue_id = sri.id
    LEFT JOIN users_details sa_det ON uc.assigned_to_id = sa_det.id
    LEFT JOIN subadmin_profiles sa ON sa_det.id = sa.subadmin_id
    WHERE uc.deleted_at IS NULL
      AND (
        uc.priority = 'High' OR
        up.department IN ('SENIOR DEPUTY GENERAL MANAGER', 'ADDITIONAL GENERAL MANAGER', 'GENERAL MANAGER')
      )
    ORDER BY uc.created_at DESC
  `);
  return rows;
};


export const getRepeatedComplaints = async () => {
  const [rows] = await pool.query(`
    SELECT 
      ud.staffNo,
      up.name AS userName,
      mi.name AS mainIssue,
      ri.name AS relatedIssue,
      sri.name AS subRelatedIssue,
      COUNT(*) AS repeatCount
    FROM user_complaints uc
    JOIN users_details ud ON ud.id = uc.user_id
    LEFT JOIN user_profiles up ON up.user_id = ud.id
    LEFT JOIN main_issues mi ON mi.id = uc.main_issue_id
    LEFT JOIN related_issues ri ON ri.id = uc.related_issue_id
    LEFT JOIN sub_related_issues sri ON sri.id = uc.sub_related_issue_id
    WHERE uc.deleted_at IS NULL
    GROUP BY ud.staffNo, up.name, mi.name, ri.name, sri.name
    HAVING COUNT(*) > 1
    ORDER BY repeatCount DESC
  `);

  return rows;
};

export const getAllSubadminsWithPerformance = async () => {
  const [subadmins] = await pool.query(`
    SELECT 
      ud.id AS subadminId,
      ud.staffNo,
      ud.role,
      sp.name,
      sp.department
    FROM users_details ud
    JOIN subadmin_profiles sp ON ud.id = sp.subadmin_id
    WHERE ud.role = 'subadmin'
  `);

  const results = [];

  for (const sa of subadmins) {
    const [[{ totalSolved }]] = await pool.query(`
      SELECT COUNT(*) AS totalSolved
      FROM user_complaints
      WHERE done_by_id = ? AND status = 'Closed' AND deleted_at IS NULL
    `, [sa.subadminId]);

    const [[{ avgHours }]] = await pool.query(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) AS avgHours
      FROM user_complaints
      WHERE done_by_id = ? AND status = 'Closed' AND deleted_at IS NULL
    `, [sa.subadminId]);

    const [mainIssueStats] = await pool.query(`
      SELECT 
        mi.id AS issueId,
        mi.name AS issue,
        COUNT(*) AS count
      FROM user_complaints uc
      JOIN main_issues mi ON mi.id = uc.main_issue_id
      WHERE uc.done_by_id = ?
        AND uc.status = 'Closed'
        AND uc.deleted_at IS NULL
      GROUP BY mi.id
      ORDER BY count DESC
    `, [sa.subadminId]);

    results.push({
      subadminId: sa.subadminId,
      name: sa.name,
      staffNo: sa.staffNo,
      role: sa.role,
      department: sa.department,
      totalSolved: totalSolved || 0,
      avgResolutionDays: avgHours ? parseFloat((avgHours / 24).toFixed(1)) : null,
      mainIssueStats: mainIssueStats || []
    });
  }

  return results;
};

export const getComplaintsBySubadminAndMainIssue = async (subadminId, mainIssueId) => {
  let complaints = [];

  if (mainIssueId === 1) {
    [complaints] = await pool.query(`
      SELECT 
        uc.id,
        uc.description,
        uc.status,
        uc.created_at,
        uc.updated_at,
        up.name AS userName,
        mi.name AS mainIssue,
        ri.name AS relatedIssue,
        sri.name AS subRelatedIssue,
        uc.issue_description_id,
        idesc.description AS issueDescription,
        sds.solution_text AS directSolution
      FROM user_complaints uc
      LEFT JOIN main_issues mi ON mi.id = uc.main_issue_id
      LEFT JOIN related_issues ri ON ri.id = uc.related_issue_id
      LEFT JOIN sub_related_issues sri ON sri.id = uc.sub_related_issue_id
      LEFT JOIN user_profiles up ON up.user_id = uc.user_id
      LEFT JOIN issue_descriptions idesc ON idesc.id = uc.issue_description_id
      LEFT JOIN subadmin_direct_solutions sds ON sds.complaint_id = uc.id AND sds.subadmin_id = uc.done_by_id
      WHERE uc.done_by_id = ?
        AND uc.original_main_issue_id = 1
        AND uc.main_issue_id = 1
        AND uc.status = 'Closed'
        AND uc.deleted_at IS NULL
      ORDER BY uc.updated_at DESC
    `, [subadminId]);
  } else {
    [complaints] = await pool.query(`
      SELECT 
        uc.id,
        uc.description,
        uc.status,
        uc.created_at,
        uc.updated_at,
        up.name AS userName,
        mi.name AS mainIssue,
        ri.name AS relatedIssue,
        sri.name AS subRelatedIssue,
        uc.issue_description_id,
        idesc.description AS issueDescription,
        sds.solution_text AS directSolution
      FROM user_complaints uc
      LEFT JOIN main_issues mi ON mi.id = uc.main_issue_id
      LEFT JOIN related_issues ri ON ri.id = uc.related_issue_id
      LEFT JOIN sub_related_issues sri ON sri.id = uc.sub_related_issue_id
      LEFT JOIN user_profiles up ON up.user_id = uc.user_id
      LEFT JOIN issue_descriptions idesc ON idesc.id = uc.issue_description_id
      LEFT JOIN subadmin_direct_solutions sds ON sds.complaint_id = uc.id AND sds.subadmin_id = uc.done_by_id
      WHERE uc.done_by_id = ?
        AND uc.main_issue_id = ?
        AND uc.status = 'Closed'
        AND uc.deleted_at IS NULL
      ORDER BY uc.updated_at DESC
    `, [subadminId, mainIssueId]);
  }

  for (const complaint of complaints) {
    if (complaint.issue_description_id) {
      const [steps] = await pool.query(`
        SELECT step_instruction
        FROM issue_solutions
        WHERE issue_description_id = ?
        ORDER BY step_number ASC
      `, [complaint.issue_description_id]);

      complaint.solutionSteps = steps.map(s => s.step_instruction);
    } else {
      complaint.solutionSteps = [];
    }
  }

  return complaints;
};

export const getTopRepeatComplainers = async () => {
  const [topUsers] = await pool.query(`
    SELECT 
      uc.user_id,
      up.name AS userName,
      COUNT(*) AS totalComplaints,
      COUNT(DISTINCT DATE(uc.created_at)) AS activeDays,
      ROUND(COUNT(*) / COUNT(DISTINCT DATE(uc.created_at)), 2) AS avgPerDay,
      DATE(MIN(uc.created_at)) AS firstComplaint,
      DATE(MAX(uc.created_at)) AS lastComplaint
    FROM user_complaints uc
    JOIN user_profiles up ON up.user_id = uc.user_id
    WHERE uc.deleted_at IS NULL
    GROUP BY uc.user_id, up.name
    HAVING totalComplaints >= 5
    ORDER BY avgPerDay DESC
    LIMIT 10
  `);

  return topUsers;
};

export const getUserComplaintTimeline = async (userId) => {
  const [timeline] = await pool.query(`
    SELECT 
      DATE(uc.created_at) AS day,
      COUNT(*) AS complaintCount
    FROM user_complaints uc
    WHERE uc.user_id = ? AND uc.deleted_at IS NULL
    GROUP BY DATE(uc.created_at)
    ORDER BY day DESC
  `, [userId]);

  return timeline;
};

export const getAllUsersWithComplaintSummary = async () => {
  const [users] = await pool.query(`
    SELECT 
      ud.id AS userId,
      ud.staffNo,
      ud.createdAt,
      up.name,
      up.department
    FROM users_details ud
    JOIN user_profiles up ON up.user_id = ud.id
    WHERE ud.role = 'user'
  `);

  const results = [];

  for (const user of users) {
    const summary = await getUserComplaintSummary(user.userId);

    results.push({
      id: user.userId,
      name: user.name || 'N/A',
      staffNo: user.staffNo || 'N/A',
      totalComplaints: summary.total || 0,
      resolved: summary.resolved || 0,
      pending: summary.unresolved || 0,
      lastComplaintAt: user.createdAt
        ? new Date(user.createdAt).toISOString().split('T')[0]
        : 'N/A'
    });
  }

  return results;
};

export const importFullHierarchyFromExcel = async (fileBuffer) => {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' }); // ensures empty cells are returned as empty strings

  let insertedMain = 0, insertedRelated = 0, insertedSubRelated = 0, insertedDescriptions = 0, insertedSolutions = 0;

  // Keep track of last seen values
  let lastMainIssue = '';
  let lastRelatedIssue = '';
  let lastSubRelatedIssue = '';
  let lastDescription = '';
  let lastMainIssueId = null;
  let lastRelatedIssueId = null;
  let lastSubRelatedIssueId = null;
  let lastDescriptionId = null;

  for (const row of rows) {
    let {
      mainIssue,
      relatedIssue,
      subRelatedIssue,
      description,
      step_number,
      step_instruction
    } = row;

    // Fallback to last seen if current cell is empty
    mainIssue = mainIssue?.trim() || lastMainIssue;
    relatedIssue = relatedIssue?.trim() || lastRelatedIssue;
    subRelatedIssue = subRelatedIssue?.trim() || lastSubRelatedIssue;
    description = description?.trim() || lastDescription;

    if (!mainIssue || !relatedIssue || !subRelatedIssue || !description || !step_number || !step_instruction) {
      console.log('⛔ Skipping incomplete row:', row);
      continue;
    }

    // Lookup or insert Main Issue
    if (mainIssue !== lastMainIssue) {
      const [[mainRow]] = await pool.query(`SELECT id FROM main_issues WHERE name = ?`, [mainIssue]);
      lastMainIssueId = mainRow?.id || (
        await pool.query(`INSERT INTO main_issues (name) VALUES (?)`, [mainIssue])
      )[0].insertId;
      if (!mainRow) insertedMain++;
      lastMainIssue = mainIssue;
    }

    // Lookup or insert Related Issue
    if (relatedIssue !== lastRelatedIssue) {
      const [[relatedRow]] = await pool.query(`SELECT id FROM related_issues WHERE name = ? AND main_issue_id = ?`, [relatedIssue, lastMainIssueId]);
      lastRelatedIssueId = relatedRow?.id || (
        await pool.query(`INSERT INTO related_issues (main_issue_id, name) VALUES (?, ?)`, [lastMainIssueId, relatedIssue])
      )[0].insertId;
      if (!relatedRow) insertedRelated++;
      lastRelatedIssue = relatedIssue;
    }

    // Lookup or insert Sub-Related Issue
    if (subRelatedIssue !== lastSubRelatedIssue) {
      const [[subRow]] = await pool.query(`SELECT id FROM sub_related_issues WHERE name = ? AND related_issue_id = ?`, [subRelatedIssue, lastRelatedIssueId]);
      lastSubRelatedIssueId = subRow?.id || (
        await pool.query(`INSERT INTO sub_related_issues (related_issue_id, name) VALUES (?, ?)`, [lastRelatedIssueId, subRelatedIssue])
      )[0].insertId;
      if (!subRow) insertedSubRelated++;
      lastSubRelatedIssue = subRelatedIssue;
    }

    // Lookup or insert Description
    if (description !== lastDescription) {
      const [[descRow]] = await pool.query(`SELECT id FROM issue_descriptions WHERE description = ? AND sub_related_issue_id = ?`, [description, lastSubRelatedIssueId]);
      lastDescriptionId = descRow?.id || (
        await pool.query(`INSERT INTO issue_descriptions (sub_related_issue_id, description) VALUES (?, ?)`, [lastSubRelatedIssueId, description])
      )[0].insertId;
      if (!descRow) insertedDescriptions++;
      lastDescription = description;
    }

    // Insert Solution Step
    await pool.query(
      `INSERT INTO issue_solutions (issue_description_id, step_number, step_instruction, sub_related_issue_id)
       VALUES (?, ?, ?, ?)`,
      [lastDescriptionId, step_number, step_instruction, lastSubRelatedIssueId]
    );
    insertedSolutions++;
  }

  return {
    insertedMain,
    insertedRelated,
    insertedSubRelated,
    insertedDescriptions,
    insertedSolutions,
    message: 'Hierarchy Excel import completed'
  };
};


