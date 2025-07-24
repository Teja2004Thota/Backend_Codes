import pool from '../../config/db.js';
import logger from '../../utils/logger.js';
import { sanitizeInput } from '../../utils/security.js';


/**General complaints SERVICE started */
export const getDashboardSummary = async (subadminId) => {
  try {
    const [[solved]] = await pool.query(
      `SELECT COUNT(*) AS totalSolved 
       FROM user_complaints 
       WHERE status = 'Closed' AND done_by_id = ? AND deleted_at IS NULL`,
      [subadminId]
    );

const [[uncategorized]] = await pool.query(`
  SELECT COUNT(*) AS uncategorized 
  FROM user_complaints 
  WHERE (main_issue_id IS NULL OR main_issue_id = 1) 
    AND status NOT IN ('Closed', 'Rejected')
    AND deleted_at IS NULL
`);



    const [[assigned]] = await pool.query(
      `SELECT COUNT(*) AS totalAssigned 
       FROM user_complaints 
       WHERE assigned_to_id = ? AND deleted_at IS NULL`,
      [subadminId]
    );

    const [[totalGeneral]] = await pool.query(`
      SELECT COUNT(*) AS totalComplaints
      FROM user_complaints uc
      LEFT JOIN uncategorized_complaint_solutions ucs ON uc.id = ucs.complaint_id
      WHERE (uc.main_issue_id != 1 OR ucs.main_issue_id IS NOT NULL)
        AND uc.deleted_at IS NULL
    `);

    return {
      totalSolved: solved.totalSolved || 0,
      uncategorized: uncategorized.uncategorized || 0,
      totalAssigned: assigned.totalAssigned || 0,
      totalComplaints: totalGeneral.totalComplaints || 0, // ✅ new field
    };
  } catch (error) {
    logger.error('Error fetching dashboard summary', { error: error.message });
    throw new Error('Failed to fetch dashboard summary');
  }
};


export const getAssignedComplaintsBySubadmin = async (subadminId) => {
  try {
    const [complaints] = await pool.query(`
      SELECT 
        uc.id AS complaint_id,
        uc.description,
        uc.priority,
        uc.status,
        uc.created_at,
        uc.updated_at,
        COALESCE(up.name, 'Unknown User') AS user_name,
        ud.staffNo AS user_staffNo,
        uc.assigned_to_id,
        sap.name AS assigned_to_name,
        uc.done_by_id,
        COALESCE(ap.name, sp.name) AS done_by_name,
        COALESCE(ucs.main_issue_id, uc.main_issue_id) AS main_issue_id,
        COALESCE(mi.name, 'Others') AS main_issue_name,
        COALESCE(ri.name, 'Others') AS related_issue_name,
        sri.name AS sub_related_issue_name
      FROM user_complaints uc
      LEFT JOIN uncategorized_complaint_solutions ucs ON ucs.complaint_id = uc.id
      LEFT JOIN main_issues mi ON mi.id = COALESCE(ucs.main_issue_id, uc.main_issue_id)
      LEFT JOIN related_issues ri ON ri.id = COALESCE(ucs.related_issue_id, uc.related_issue_id)
      LEFT JOIN sub_related_issues sri ON sri.id = COALESCE(ucs.sub_related_issue_id, uc.sub_related_issue_id)
      LEFT JOIN user_profiles up ON uc.user_id = up.user_id
      LEFT JOIN users_details ud ON ud.id = uc.user_id
      LEFT JOIN admin_profiles ap ON ap.admin_id = uc.done_by_id
      LEFT JOIN subadmin_profiles sp ON sp.subadmin_id = uc.done_by_id
      LEFT JOIN subadmin_profiles sap ON sap.subadmin_id = uc.assigned_to_id
      WHERE uc.assigned_to_id = ?
        AND uc.deleted_at IS NULL
      ORDER BY uc.created_at DESC
    `, [subadminId]);

    logger.info('Fetched assigned complaints for subadmin', { subadminId, count: complaints.length });
    return complaints;
  } catch (err) {
    logger.error('Failed to fetch assigned complaints', { error: err.message, subadminId });
    throw err;
  }
};


// 🔹 Show only solved complaints by the subadmin (used in "Total Complaints Solved by You")
export const getSolvedComplaintsBySubadmin = async (subadminId) => {
  try {
    const [complaints] = await pool.query(`
      SELECT 
        uc.id AS complaint_id,
        uc.description,
        uc.priority,
        uc.status,
        uc.created_at,
        uc.updated_at,
        COALESCE(up.name, 'Unknown User') AS user_name,
        ud.staffNo AS user_staffNo,
        uc.assigned_to_id,
        sap.name AS assigned_to_name,
        uc.done_by_id,
        COALESCE(ap.name, sp.name) AS done_by_name,
        COALESCE(ucs.main_issue_id, uc.main_issue_id) AS main_issue_id,
        COALESCE(mi.name, 'Others') AS main_issue_name,
        COALESCE(ri.name, 'Others') AS related_issue_name,
        sri.name AS sub_related_issue_name
      FROM user_complaints uc
      LEFT JOIN uncategorized_complaint_solutions ucs ON ucs.complaint_id = uc.id
      LEFT JOIN main_issues mi ON mi.id = COALESCE(ucs.main_issue_id, uc.main_issue_id)
      LEFT JOIN related_issues ri ON ri.id = COALESCE(ucs.related_issue_id, uc.related_issue_id)
      LEFT JOIN sub_related_issues sri ON sri.id = COALESCE(ucs.sub_related_issue_id, uc.sub_related_issue_id)
      LEFT JOIN user_profiles up ON uc.user_id = up.user_id
      LEFT JOIN users_details ud ON ud.id = uc.user_id
      LEFT JOIN admin_profiles ap ON ap.admin_id = uc.done_by_id
      LEFT JOIN subadmin_profiles sp ON sp.subadmin_id = uc.done_by_id
      LEFT JOIN subadmin_profiles sap ON sap.subadmin_id = uc.assigned_to_id
      WHERE uc.status = 'Closed'
        AND uc.done_by_id = ?   -- ✅ Only where this subadmin resolved it
        AND uc.deleted_at IS NULL
      ORDER BY uc.created_at DESC
    `, [subadminId]);

    logger.info('Fetched only complaints resolved by subadmin', { subadminId, count: complaints.length });
    return complaints;
  } catch (err) {
    logger.error('Failed to fetch solved complaints', { error: err.message, subadminId });
    throw err;
  }
};


// 🔹 Show all general structured complaints (used in "General Complaints" view)
export const getGeneralComplaints = async () => {
  try {
    const [complaints] = await pool.query(`
      SELECT 
        uc.id AS complaint_id,
        uc.description,
        uc.priority,
        uc.status,
        uc.created_at,
        uc.updated_at,
        COALESCE(up.name, 'Unknown User') AS user_name,
ud.staffNo AS user_staffNo,
up.department,
up.designation,
up.photo,
up.contacts,
        uc.assigned_to_id,
        sap.name AS assigned_to_name,
        uc.done_by_id,
        COALESCE(ap.name, sp.name) AS done_by_name,
        COALESCE(ucs.main_issue_id, uc.main_issue_id) AS main_issue_id,
        COALESCE(mi.name, 'Others') AS main_issue_name,
        COALESCE(ri.name, 'Others') AS related_issue_name,
        sri.name AS sub_related_issue_name
      FROM user_complaints uc
      LEFT JOIN uncategorized_complaint_solutions ucs ON ucs.complaint_id = uc.id
      LEFT JOIN main_issues mi ON mi.id = COALESCE(ucs.main_issue_id, uc.main_issue_id)
      LEFT JOIN related_issues ri ON ri.id = COALESCE(ucs.related_issue_id, uc.related_issue_id)
      LEFT JOIN sub_related_issues sri ON sri.id = COALESCE(ucs.sub_related_issue_id, uc.sub_related_issue_id)
      LEFT JOIN user_profiles up ON uc.user_id = up.user_id
      LEFT JOIN users_details ud ON ud.id = uc.user_id
      LEFT JOIN admin_profiles ap ON ap.admin_id = uc.done_by_id
      LEFT JOIN subadmin_profiles sp ON sp.subadmin_id = uc.done_by_id
      LEFT JOIN subadmin_profiles sap ON sap.subadmin_id = uc.assigned_to_id
      WHERE (uc.main_issue_id != 1 OR ucs.main_issue_id IS NOT NULL)
        AND uc.deleted_at IS NULL
      ORDER BY uc.created_at DESC
    `);

    logger.info('Fetched general complaints (all structured)');
    return complaints;
  } catch (err) {
    logger.error('Failed to fetch general complaints', { error: err.message });
    throw err;
  }
};


export const updateGeneralComplaintSolution = async (
  complaintId,
  subadminId,
  { subRelatedIssue, issueDescription, solutionSteps, directSolution, doneById, severity }
) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [complaint] = await connection.query(
      'SELECT id, status, assigned_to_id FROM user_complaints WHERE id = ? AND deleted_at IS NULL',
      [complaintId]
    );
    if (!complaint.length) throw new Error('Complaint not found');
    if (complaint[0].status === 'Closed') {
      throw new Error('Complaint is already closed and cannot be updated');
    }

    // ✅ DIRECT SOLUTION CASE
    if (directSolution && !subRelatedIssue && !issueDescription && (!solutionSteps || solutionSteps.length === 0)) {
      await connection.query(
        'INSERT INTO subadmin_direct_solutions (complaint_id, subadmin_id, solution_text) VALUES (?, ?, ?)',
        [complaintId, subadminId, sanitizeInput(directSolution)]
      );

      const updateFields = [
        'status = "Closed"',
        'updated_at = NOW()',
        'done_by_id = ?'
      ];
      const updateValues = [doneById || subadminId];

      if (severity) {
        updateFields.push('severity = ?');
        updateValues.push(severity);
      }

      updateValues.push(complaintId);

      await connection.query(
        `UPDATE user_complaints SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      await connection.commit();
      return { message: 'Direct solution saved successfully' };
    }

    // ✅ VALIDATION
    if ((issueDescription || (solutionSteps && solutionSteps.length > 0)) && !subRelatedIssue) {
      throw new Error('Sub-related issue is required when providing description or solution steps.');
    }

    // ✅ SUB-RELATED ISSUE INSERT/GET
    let subRelatedIssueId = null;
    if (subRelatedIssue) {
      const [existing] = await connection.query(
        'SELECT id FROM sub_related_issues WHERE name = ? AND related_issue_id = ?',
        [sanitizeInput(subRelatedIssue.name), subRelatedIssue.related_issue_id]
      );

      if (existing.length > 0) {
        subRelatedIssueId = existing[0].id;
      } else {
        const [insertResult] = await connection.query(
          'INSERT INTO sub_related_issues (name, related_issue_id) VALUES (?, ?)',
          [sanitizeInput(subRelatedIssue.name), subRelatedIssue.related_issue_id]
        );
        subRelatedIssueId = insertResult.insertId;
      }
    }

    // ✅ ISSUE DESCRIPTION & STEPS
    let issueDescriptionId = null;
    if (issueDescription && subRelatedIssueId) {
      const [descInsert] = await connection.query(
        'INSERT INTO issue_descriptions (sub_related_issue_id, description) VALUES (?, ?)',
        [subRelatedIssueId, sanitizeInput(issueDescription)]
      );
      issueDescriptionId = descInsert.insertId;

      if (solutionSteps && solutionSteps.length > 0) {
        for (let i = 0; i < solutionSteps.length; i++) {
          await connection.query(
            'INSERT INTO issue_solutions (issue_description_id, step_number, step_instruction, sub_related_issue_id) VALUES (?, ?, ?, ?)',
            [issueDescriptionId, i + 1, sanitizeInput(solutionSteps[i]), subRelatedIssueId]
          );
        }
      }
    }

    // ✅ UPDATE COMPLAINT RECORD (no default severity)
    const updateFields = [
      'status = "Closed"',
      'updated_at = NOW()',
      'done_by_id = ?',
      'issue_description_id = ?',
      'final_sub_related_issue_id = ?'
    ];
    const updateValues = [doneById || subadminId, issueDescriptionId, subRelatedIssueId];

    if (severity) {
      updateFields.push('severity = ?');
      updateValues.push(severity);
    }

    updateValues.push(complaintId);

    await connection.query(
      `UPDATE user_complaints SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    await connection.commit();
    return { message: 'Complaint updated successfully with full structured solution.' };
  } catch (err) {
    await connection.rollback();
    logger.error('Error updating complaint solution', { error: err.message, complaintId, subadminId });
    throw new Error('Failed to update complaint solution');
  } finally {
    connection.release();
  }
};

/**General complaints SERVICE ended */


/**Uncategorized complaints SERVICE started */
export const getPendingComplaints = async (subadminId) => {
  try {
    logger.info('Fetching pending and open uncategorized complaints', { subadminId });
    const [complaints] = await pool.query(
      `SELECT 
         uc.id AS complaint_id, 
         uc.description, 
         uc.status, 
         uc.priority, 
         uc.created_at, 
         uc.is_ai_resolved,
         COALESCE(up.name, 'Unknown User') AS user_name, 
         ud.staffNo AS user_staffNo,
         up.department,
         up.designation,
         up.photo,
         up.contacts,
         uc.assigned_to_id, 
         sap.name AS assigned_to_name,
         uc.main_issue_id, 
         uc.related_issue_id, 
         uc.sub_related_issue_id
       FROM user_complaints uc
       LEFT JOIN subadmin_profiles sap ON uc.assigned_to_id = sap.subadmin_id
       LEFT JOIN pending_complaint_issues pci ON uc.id = pci.complaint_id
       LEFT JOIN user_profiles up ON uc.user_id = up.user_id
       LEFT JOIN users_details ud ON ud.id = uc.user_id
       WHERE 
         uc.status IN ('Pending', 'Open') 
         AND (uc.main_issue_id IS NULL OR uc.main_issue_id = 1)
         AND uc.deleted_at IS NULL`,
      [subadminId]
    );

    logger.info('Fetched pending and open uncategorized complaints', { count: complaints.length, subadminId });
    return complaints;
  } catch (err) {
    logger.error('Failed to fetch complaints', { error: err.message, subadminId });
    throw err;
  }
};

export const takeComplaint = async (subadminId, complaintId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    logger.info('Taking complaint', { subadminId, complaintId });

    const [complaintRows] = await connection.query(
      'SELECT id, status, assigned_to_id, main_issue_id FROM user_complaints WHERE id = ? AND deleted_at IS NULL',
      [complaintId]
    );

    if (!complaintRows.length) throw new Error('Complaint not found');

    const complaint = complaintRows[0];

    if (complaint.assigned_to_id) throw new Error('Complaint is already assigned');

    let updateStatus = complaint.status;
    if (complaint.status === 'Pending') {
      updateStatus = 'Open';
      await connection.query(
        'UPDATE pending_complaint_issues SET status = ? WHERE complaint_id = ?',
        ['Approved', complaintId]
      );
    }

    await connection.query(
      'UPDATE user_complaints SET status = ?, assigned_to_id = ?, updated_at = NOW() WHERE id = ?',
      [updateStatus, subadminId, complaintId]
    );

    const [subadmin] = await connection.query(
      'SELECT sp.name FROM subadmin_profiles sp WHERE sp.subadmin_id = ?',
      [subadminId]
    );

    await connection.query(
      'INSERT INTO ai_resolution_logs (user_id, is_resolved, session_id, action) VALUES (?, ?, ?, ?)',
      [subadminId, false, null, 'take_complaint']
    );

    await connection.commit();

    logger.info('Complaint taken', {
      complaintId,
      status: updateStatus,
      assigned_to_id: subadminId,
    });

    return {
      complaintId,
      status: updateStatus,
      assigned_to_id: subadminId,
      assignedTo: subadmin[0]?.name || 'Unknown Subadmin',
    };
  } catch (err) {
    await connection.rollback();
    logger.error('Failed to take complaint', { error: err.message, complaintId, subadminId });
    throw err;
  } finally {
    connection.release();
  }
};

export const rejectComplaint = async (subadminId, complaintId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [complaint] = await connection.query(
      'SELECT id, status, main_issue_id FROM user_complaints WHERE id = ? AND deleted_at IS NULL',
      [complaintId]
    );
    if (!complaint.length) throw new Error('Complaint not found');
    if (complaint[0].status !== 'Pending') throw new Error('Complaint is not pending');
    if (complaint[0].main_issue_id !== null && complaint[0].main_issue_id !== 1) throw new Error('Categorized complaints cannot be rejected');

    await connection.query(
      'UPDATE user_complaints SET status = ?, updated_at = NOW() WHERE id = ?',
      ['Rejected', complaintId]
    );

    await connection.query(
      'UPDATE pending_complaint_issues SET status = ? WHERE complaint_id = ?',
      ['Rejected', complaintId]
    );

    await connection.query(
      'INSERT INTO ai_resolution_logs (user_id, is_resolved, session_id, action) VALUES (?, ?, ?, ?)',
      [subadminId, false, null, 'reject_complaint']
    );

    await connection.commit();
    logger.info('Uncategorized complaint rejected', { complaintId, subadminId });
    return { complaintId, status: 'Rejected' };
  } catch (err) {
    await connection.rollback();
    logger.error('Failed to reject complaint', { error: err.message, complaintId, subadminId });
    throw err;
  } finally {
    connection.release();
  }
};

export const updateUncategorizedComplaint = async (
  complaintId,
  subadminId,
  { mainIssue, relatedIssue, subRelatedIssue, issueDescription, solutionSteps, doneById, assignedToId, severity } // 🔥 added severity
) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    logger.info('Updating uncategorized complaint', { complaintId, subadminId });

    const [complaint] = await connection.query(
      'SELECT id, status, assigned_to_id, main_issue_id FROM user_complaints WHERE id = ? AND deleted_at IS NULL',
      [complaintId]
    );
    if (!complaint.length) throw new Error('Complaint not found');
    if (complaint[0].status !== 'Open') throw new Error('Complaint is not open');
    if (complaint[0].main_issue_id && complaint[0].main_issue_id !== 1)
      throw new Error('Complaint is already categorized');

    // ✅ MAIN ISSUE
    let mainIssueId;
    if (mainIssue.id) {
      const [existing] = await connection.query('SELECT id FROM main_issues WHERE id = ?', [mainIssue.id]);
      if (!existing.length) throw new Error('Invalid main issue ID');
      mainIssueId = mainIssue.id;
    } else if (mainIssue.name) {
      const [existing] = await connection.query('SELECT id FROM main_issues WHERE name = ?', [sanitizeInput(mainIssue.name)]);
      if (existing.length > 0) {
        mainIssueId = existing[0].id;
      } else {
        const [insertResult] = await connection.query('INSERT INTO main_issues (name) VALUES (?)', [sanitizeInput(mainIssue.name)]);
        mainIssueId = insertResult.insertId;
      }
    } else {
      throw new Error('Main issue is required');
    }

    // ✅ RELATED ISSUE
    let relatedIssueId = null;
    if (relatedIssue) {
      if (relatedIssue.id) {
        const [existing] = await connection.query(
          'SELECT id FROM related_issues WHERE id = ? AND main_issue_id = ?',
          [relatedIssue.id, mainIssueId]
        );
        if (!existing.length) throw new Error('Invalid related issue ID');
        relatedIssueId = relatedIssue.id;
      } else if (relatedIssue.name) {
        const [existing] = await connection.query(
          'SELECT id FROM related_issues WHERE name = ? AND main_issue_id = ?',
          [sanitizeInput(relatedIssue.name), mainIssueId]
        );
        if (existing.length > 0) {
          relatedIssueId = existing[0].id;
        } else {
          const [insertResult] = await connection.query(
            'INSERT INTO related_issues (name, main_issue_id) VALUES (?, ?)',
            [sanitizeInput(relatedIssue.name), mainIssueId]
          );
          relatedIssueId = insertResult.insertId;
        }
      }
    }

    // ✅ SUB-RELATED ISSUE
    let subRelatedIssueId = null;
    if (subRelatedIssue) {
      if (!relatedIssueId) throw new Error('Related issue is required for sub-related issue');
      if (subRelatedIssue.id) {
        const [existing] = await connection.query(
          'SELECT id FROM sub_related_issues WHERE id = ? AND related_issue_id = ?',
          [subRelatedIssue.id, relatedIssueId]
        );
        if (!existing.length) throw new Error('Invalid sub-related issue ID');
        subRelatedIssueId = subRelatedIssue.id;
      } else if (subRelatedIssue.name) {
        const [existing] = await connection.query(
          'SELECT id FROM sub_related_issues WHERE name = ? AND related_issue_id = ?',
          [sanitizeInput(subRelatedIssue.name), relatedIssueId]
        );
        if (existing.length > 0) {
          subRelatedIssueId = existing[0].id;
        } else {
          const [insertResult] = await connection.query(
            'INSERT INTO sub_related_issues (name, related_issue_id) VALUES (?, ?)',
            [sanitizeInput(subRelatedIssue.name), relatedIssueId]
          );
          subRelatedIssueId = insertResult.insertId;
        }
      }
    }

    // ✅ ISSUE DESCRIPTION & STEPS
    let issueDescriptionId = null;
    if (issueDescription || (solutionSteps && solutionSteps.length > 0)) {
      if (!subRelatedIssueId) throw new Error('Sub-related issue is required for issue description or solution steps');

      if (issueDescription) {
        const [descInsert] = await connection.query(
          'INSERT INTO issue_descriptions (sub_related_issue_id, description) VALUES (?, ?)',
          [subRelatedIssueId, sanitizeInput(issueDescription)]
        );
        issueDescriptionId = descInsert.insertId;
      }

      if (solutionSteps && solutionSteps.length > 0) {
        for (let i = 0; i < solutionSteps.length; i++) {
          await connection.query(
            'INSERT INTO issue_solutions (issue_description_id, step_number, step_instruction, sub_related_issue_id) VALUES (?, ?, ?, ?)',
            [issueDescriptionId || null, i + 1, sanitizeInput(solutionSteps[i]), subRelatedIssueId]
          );
        }
      }
    }

    // ✅ INSERT into uncategorized_complaint_solutions
    await connection.query(
      'INSERT INTO uncategorized_complaint_solutions (complaint_id, subadmin_id, main_issue_id, related_issue_id, sub_related_issue_id, issue_description_id) VALUES (?, ?, ?, ?, ?, ?)',
      [complaintId, subadminId, mainIssueId, relatedIssueId, subRelatedIssueId, issueDescriptionId]
    );

    // ✅ DYNAMICALLY BUILD update query for user_complaints
    const updateFields = [
      'main_issue_id = ?',
      'related_issue_id = ?',
      'sub_related_issue_id = ?',
      'final_sub_related_issue_id = ?',
      'issue_description_id = ?',
      'status = "Closed"',
      'updated_at = NOW()',
      'done_by_id = ?'
    ];
    const updateValues = [
      mainIssueId,
      relatedIssueId,
      subRelatedIssueId,
      subRelatedIssueId,
      issueDescriptionId,
      doneById || subadminId
    ];

    if (severity) {
      updateFields.push('severity = ?');
      updateValues.push(severity);
    }

    updateValues.push(complaintId);

    await connection.query(
      `UPDATE user_complaints SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    await connection.commit();
    logger.info('Uncategorized complaint updated', {
      complaintId,
      subadminId,
      mainIssueId,
      relatedIssueId,
      subRelatedIssueId,
      issueDescriptionId,
      severity
    });

    return { message: 'Uncategorized complaint updated successfully' };
  } catch (err) {
    await connection.rollback();
    logger.error('Error updating uncategorized complaint', { error: err.message, complaintId, subadminId });
    throw new Error('Failed to update uncategorized complaint');
  } finally {
    connection.release();
  }
};
/**Uncategorized complaints SERVICE ended */

export const getMainIssues = async () => {
  try {
    logger.info('Fetching main issues');
    const [mainIssues] = await pool.query(
      `SELECT id, name FROM main_issues WHERE name != 'Others'`
    );
    logger.info('Fetched main issues', { count: mainIssues.length });
    return mainIssues;
  } catch (error) {
    logger.error('Error fetching main issues:', { error: error.message });
    throw new Error('Failed to fetch main issues');
  }
};


export const getRelatedIssues = async (mainIssueId) => {
  try {
    logger.info('Fetching related issues', { mainIssueId });
    const query = mainIssueId
      ? 'SELECT id, name, main_issue_id FROM related_issues WHERE main_issue_id = ?'
      : 'SELECT id, name, main_issue_id FROM related_issues';
    const [relatedIssues] = await pool.query(query, mainIssueId ? [mainIssueId] : []);
    logger.info('Fetched related issues', { count: relatedIssues.length, mainIssueId });
    return relatedIssues;
  } catch (error) {
    logger.error('Error fetching related issues:', { error: error.message });
    throw new Error('Failed to fetch related issues');
  }
};

export const getSubRelatedIssues = async (relatedIssueId) => {
  try {
    logger.info('Fetching sub-related issues', { relatedIssueId });
    const query = relatedIssueId
      ? 'SELECT id, name, related_issue_id FROM sub_related_issues WHERE related_issue_id = ?'
      : 'SELECT id, name, related_issue_id FROM sub_related_issues';
    const [subRelatedIssues] = await pool.query(query, relatedIssueId ? [relatedIssueId] : []);
    logger.info('Fetched sub-related issues', { count: subRelatedIssues.length, relatedIssueId });
    return subRelatedIssues;
  } catch (error) {
    logger.error('Error fetching sub-related issues:', { error: error.message });
    throw new Error('Failed to fetch sub-related issues');
  }
};
