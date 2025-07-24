import stringSimilarity from 'string-similarity';
import pool from '../../config/db.js';
import logger from '../../utils/logger.js';
import NodeCache from 'node-cache';
import { sanitizeInput } from '../../utils/security.js';

const issueCache = new NodeCache({ stdTTL: 10 });

export const getUserComplaintSummary = async (userId) => {
  const [rows] = await pool.query(
    `SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS unresolved,
      SUM(CASE WHEN MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE()) THEN 1 ELSE 0 END) AS thisMonth
    FROM user_complaints 
    WHERE user_id = ? AND deleted_at IS NULL`,
    [userId]
  );
  return rows[0];
};

const fuzzyMatch = (input, options, threshold = 0.4) => {
  const inputTokens = input.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  let bestMatch = null;
  let bestScore = 0;

  for (const opt of options) {
    const optTokens = opt.toLowerCase().split(/\s+/);
    for (const inTok of inputTokens) {
      for (const optTok of optTokens) {
        const score = stringSimilarity.compareTwoStrings(inTok, optTok);
        if (score > bestScore && score >= threshold) {
          bestScore = score;
          bestMatch = opt;
        }
      }
    }
  }

  if (!bestMatch) {
    const matches = stringSimilarity.findBestMatch(input.toLowerCase(), options.map(opt => opt.toLowerCase()));
    const best = matches.bestMatch;
    if (best.rating >= threshold) bestMatch = best.target;
  }

  return bestMatch;
};

export const classifyComplaintFromDescription = async (description) => {
  const sanitizedDescription = sanitizeInput(description.toLowerCase());

  let mainIssue = 'Others';
  let mainIssueId = 1;
  let relatedIssue = 'Others';
  let relatedIssueId = 1;
  let subRelatedIssueId = null;
  let subRelatedIssues = [];

  try {
    let mainIssues = issueCache.get('mainIssues') || (await pool.query('SELECT id, name FROM main_issues'))[0];
    let relatedIssues = issueCache.get('relatedIssues') || (await pool.query('SELECT id, main_issue_id, name FROM related_issues'))[0];
    let subRelatedIssuesRaw = issueCache.get('subRelatedIssues') || (await pool.query('SELECT id, related_issue_id, name FROM sub_related_issues'))[0];

    issueCache.set('mainIssues', mainIssues);
    issueCache.set('relatedIssues', relatedIssues);
    issueCache.set('subRelatedIssues', subRelatedIssuesRaw);

    const mainIssueMap = new Map(mainIssues.map(issue => [issue.id, issue.name]));
    const relatedNames = relatedIssues.map(r => r.name);
    const matchedRelatedName = fuzzyMatch(sanitizedDescription, relatedNames, 0.4);
    const matchedRelated = relatedIssues.find(r => r.name.toLowerCase() === matchedRelatedName?.toLowerCase());

    let relatedSubIssues = [];

    if (matchedRelated) {
      relatedIssue = matchedRelated.name;
      relatedIssueId = matchedRelated.id;
      mainIssueId = matchedRelated.main_issue_id;
      mainIssue = mainIssueMap.get(mainIssueId) || 'Others';

      relatedSubIssues = subRelatedIssuesRaw.filter(sri => sri.related_issue_id === relatedIssueId);
      const subNames = relatedSubIssues.map(s => s.name);
      const matchedSubName = fuzzyMatch(sanitizedDescription, subNames, 0.4);
      const matchedSub = relatedSubIssues.find(s => s.name.toLowerCase() === matchedSubName?.toLowerCase());

      if (matchedSub) {
        subRelatedIssueId = matchedSub.id;
      } else if (sanitizedDescription.includes('keyboard')) {
        subRelatedIssueId = relatedSubIssues.find(s => s.name.toLowerCase() === 'key not working')?.id || null;
      }

      subRelatedIssues = relatedSubIssues;
    }

    if (!relatedIssueId || relatedIssueId === 1) {
      const [othersRelated] = await pool.query(
        'SELECT id, name FROM related_issues WHERE main_issue_id = ? AND name = ?',
        [1, 'Others']
      );
      relatedIssueId = othersRelated[0]?.id || 1;
      relatedIssue = othersRelated[0]?.name || 'Others';
      subRelatedIssueId = null;

      const [othersSubRelated] = await pool.query('SELECT id, name FROM sub_related_issues WHERE related_issue_id = ?', [
        relatedIssueId
      ]);
      subRelatedIssues = othersSubRelated.map(s => ({ id: s.id, name: s.name }));
    }

    if (relatedIssueId !== 1 && !subRelatedIssueId && relatedSubIssues.length === 1) {
      subRelatedIssueId = relatedSubIssues[0].id;
    }

    if (!subRelatedIssueId && relatedIssueId !== 1) {
      logger.warn('No sub-related issue match found', {
        description,
        relatedIssueId,
        relatedSubIssues,
      });
    }

    let issueDescription = null;
    let solutions = [];

    if (subRelatedIssueId) {
      const [descRows] = await pool.query(
        'SELECT id, description FROM issue_descriptions WHERE sub_related_issue_id = ?',
        [subRelatedIssueId]
      );
      issueDescription = descRows[0]?.description || null;

      const [solRows] = await pool.query(
        'SELECT id, step_number, step_instruction FROM issue_solutions WHERE issue_description_id = ?',
        [descRows[0]?.id]
      );
      solutions = solRows;
    }

    logger.info('Classification completed', {
      description: sanitizedDescription,
      mainIssueId,
      relatedIssueId,
      subRelatedIssueId: subRelatedIssueId || null
    });

    return {
      success: true,
      mainIssue,
      mainIssueId,
      relatedIssue,
      relatedIssueId,
      subRelatedIssueId,
      subRelatedIssues,
      issueDescription,
      solutions
    };
  } catch (err) {
    logger.error('Failed to classify description', { error: err.message });
    throw err;
  }
};

export const getSolutions = async (subRelatedIssueId) => {
  try {
    const [descRows] = await pool.query(
      'SELECT id, description FROM issue_descriptions WHERE sub_related_issue_id = ?',
      [subRelatedIssueId]
    );
    const [solRows] = await pool.query(
      'SELECT id, step_number, step_instruction FROM issue_solutions WHERE issue_description_id = ?',
      [descRows[0]?.id]
    );
    logger.info('Fetched solutions', { subRelatedIssueId });
    return {
      success: true,
      issueDescription: descRows[0]?.description || null,
      solutions: solRows
    };
  } catch (err) {
    logger.error('Failed to fetch solutions', { error: err.message, subRelatedIssueId });
    throw err;
  }
};

export const submitComplaint = async (userId, { description, mainIssueId, relatedIssueId, subRelatedIssueId, priority, isResolved, sessionId, issueDescription }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (mainIssueId) {
      const [mainIssue] = await connection.query('SELECT id FROM main_issues WHERE id = ?', [mainIssueId]);
      if (!mainIssue.length) throw new Error('Invalid main issue');
    }
    if (relatedIssueId) {
      const [relatedIssue] = await connection.query('SELECT id FROM related_issues WHERE id = ? AND main_issue_id = ?', [relatedIssueId, mainIssueId]);
      if (!relatedIssue.length) throw new Error('Invalid related issue');
    }
    if (subRelatedIssueId) {
      const [subRelatedIssue] = await connection.query('SELECT id FROM sub_related_issues WHERE id = ? AND related_issue_id = ?', [subRelatedIssueId, relatedIssueId]);
      if (!subRelatedIssue.length) throw new Error('Invalid sub-related issue');
    }

    let issueDescriptionId = null;
    if (subRelatedIssueId) {
      const [descRows] = await connection.query(
        'SELECT id FROM issue_descriptions WHERE sub_related_issue_id = ? LIMIT 1',
        [subRelatedIssueId]
      );
      if (descRows.length > 0) {
        issueDescriptionId = descRows[0].id;
        logger.info('Existing issue description found', { issueDescriptionId, subRelatedIssueId, userId });
      } else {
        logger.info('No issue description found for sub_related_issue_id', { subRelatedIssueId, userId });
      }
    } else {
      logger.info('No sub_related_issue_id provided, skipping issue description lookup', { userId });
    }

    const status = (mainIssueId === 1 && relatedIssueId === 1) ? 'Pending' : 'Open';
    if (mainIssueId === 1 && relatedIssueId === 1) {
      subRelatedIssueId = null;
      issueDescriptionId = null;
    }

    const finalDescription = description || issueDescription || 'No description provided'; // Fallback for manual mode
    const [complaintResult] = await connection.query(
      'INSERT INTO user_complaints (user_id, description, main_issue_id, related_issue_id, sub_related_issue_id, issue_description_id, priority, status, is_ai_resolved, original_main_issue_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, sanitizeInput(finalDescription), mainIssueId, relatedIssueId, subRelatedIssueId, issueDescriptionId, priority, status, isResolved, mainIssueId === 1 ? 1 : null]
    );

    const complaintId = complaintResult.insertId;

    if (mainIssueId === 1 && relatedIssueId === 1) {
      await connection.query(
        'INSERT INTO pending_complaint_issues (complaint_id, user_id, description, status) VALUES (?, ?, ?, ?)',
        [complaintId, userId, sanitizeInput(finalDescription), 'Pending']
      );
      logger.info('Inserted into pending_complaint_issues for Others complaint', { complaintId, userId });
    }

    await connection.query(
      'INSERT INTO ai_resolution_logs (user_id, is_resolved, session_id, action) VALUES (?, ?, ?, ?)',
      [userId, isResolved, sessionId, 'submit_complaint']
    );

    await connection.commit();
    logger.info('Complaint submitted', { complaintId, userId, issueDescriptionId, status, subRelatedIssueId: subRelatedIssueId || null });
    return {
      id: complaintId,
      userId,
      description: finalDescription,
      mainIssueId,
      relatedIssueId,
      subRelatedIssueId: subRelatedIssueId || null,
      issueDescriptionId,
      priority,
      status,
      isResolved
    };
  } catch (err) {
    await connection.rollback();
    logger.error('Failed to submit complaint', { error: err.message, userId });
    throw err;
  } finally {
    connection.release();
  }
};

/**-------------------------------------------------------------------------------- */
export const getAllComplaints = async (userId) => {
  try {
    const [complaints] = await pool.query(
      'SELECT uc.id, uc.description, ' +
      'CASE WHEN uc.original_main_issue_id = 1 THEN "Others" ELSE mi.name END AS main_issue_name, ' +
      'CASE WHEN uc.original_main_issue_id = 1 THEN "Others" ELSE ri.name END AS related_issue_name, ' +
      'CASE WHEN uc.original_main_issue_id = 1 THEN NULL ELSE sri.name END AS sub_related_issue_name, ' +
      'uc.priority, uc.status, uc.is_ai_resolved, uc.created_at, uc.updated_at ' +
      'FROM user_complaints uc ' +
      'LEFT JOIN main_issues mi ON uc.main_issue_id = mi.id ' +
      'LEFT JOIN related_issues ri ON uc.related_issue_id = ri.id ' +
      'LEFT JOIN sub_related_issues sri ON uc.sub_related_issue_id = sri.id ' +
      'WHERE uc.user_id = ? AND uc.deleted_at IS NULL ' +
      'ORDER BY uc.created_at DESC',
      [userId]
    );

    logger.info('Fetched all complaints', { 
      userId, 
      count: complaints.length, 
      subRelatedIssueNames: complaints.map(c => c.sub_related_issue_name) 
    });
    return complaints;
  } catch (err) {
    logger.error('Failed to fetch complaints', { error: err.message, userId });
    throw err;
  }
};

export const getTrackComplaints = async (userId) => {
  const [complaints] = await pool.query(
    `
    (
      SELECT 
        uc.id AS complaint_id,
        uc.description,
        uc.status,
        uc.created_at,
        uc.updated_at,
        uc.is_ai_resolved,
        MAX(mi.name) AS main_issue,
        MAX(ri.name) AS related_issue,
        MAX(sri.name) AS sub_related_issue,
        MAX(COALESCE(sp.name, up.name)) AS assigned_to_name,
        MAX(JSON_UNQUOTE(JSON_EXTRACT(sp.contacts, '$[0]'))) AS assigned_to_phone,
        MAX(COALESCE(done_by_ap.name, done_by_sp.name, up.name)) AS resolved_by_name,
        MAX(idesc.description) AS issue_description,
        GROUP_CONCAT(DISTINCT iso.step_instruction ORDER BY iso.step_number SEPARATOR '||') AS solution_steps,
        MAX(sds.solution_text) AS direct_solution,
        cf.label AS feedback_label,
        cf.comment AS feedback_comment,
        CASE WHEN cf.id IS NOT NULL THEN true ELSE false END AS has_feedback
      FROM user_complaints uc
      LEFT JOIN main_issues mi ON mi.id = uc.main_issue_id
      LEFT JOIN related_issues ri ON ri.id = uc.related_issue_id
      LEFT JOIN sub_related_issues sri ON sri.id = COALESCE(uc.final_sub_related_issue_id, uc.sub_related_issue_id)
      LEFT JOIN issue_descriptions idesc ON idesc.id = uc.issue_description_id
      LEFT JOIN issue_solutions iso ON iso.issue_description_id = idesc.id
      LEFT JOIN subadmin_direct_solutions sds ON sds.complaint_id = uc.id
      LEFT JOIN users_details ud ON uc.assigned_to_id = ud.id
      LEFT JOIN user_profiles up ON ud.id = up.user_id
      LEFT JOIN subadmin_profiles sp ON uc.assigned_to_id = sp.subadmin_id
      LEFT JOIN users_details dud ON uc.done_by_id = dud.id
      LEFT JOIN admin_profiles done_by_ap ON done_by_ap.admin_id = dud.id
      LEFT JOIN subadmin_profiles done_by_sp ON done_by_sp.subadmin_id = dud.id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = uc.id AND cf.user_id = ?
      WHERE uc.user_id = ? AND uc.deleted_at IS NULL AND uc.main_issue_id != 1
      GROUP BY uc.id
    )

    UNION ALL

    (
      SELECT 
        uc.id AS complaint_id,
        uc.description,
        uc.status,
        uc.created_at,
        uc.updated_at,
        uc.is_ai_resolved,
        MAX(mi.name) AS main_issue,
        MAX(ri.name) AS related_issue,
        MAX(sri.name) AS sub_related_issue,
        MAX(COALESCE(sp.name, up.name)) AS assigned_to_name,
        MAX(JSON_UNQUOTE(JSON_EXTRACT(sp.contacts, '$[0]'))) AS assigned_to_phone,
        MAX(COALESCE(done_by_ap.name, done_by_sp.name, up.name)) AS resolved_by_name,
        MAX(idesc.description) AS issue_description,
        GROUP_CONCAT(DISTINCT iso.step_instruction ORDER BY iso.step_number SEPARATOR '||') AS solution_steps,
        MAX(sds.solution_text) AS direct_solution,
        cf.label AS feedback_label,
        cf.comment AS feedback_comment,
        CASE WHEN cf.id IS NOT NULL THEN true ELSE false END AS has_feedback
      FROM user_complaints uc
      LEFT JOIN uncategorized_complaint_solutions ucs ON ucs.complaint_id = uc.id
      LEFT JOIN main_issues mi ON mi.id = ucs.main_issue_id
      LEFT JOIN related_issues ri ON ri.id = ucs.related_issue_id
      LEFT JOIN sub_related_issues sri ON sri.id = ucs.sub_related_issue_id
      LEFT JOIN issue_descriptions idesc ON idesc.id = ucs.issue_description_id
      LEFT JOIN issue_solutions iso ON iso.issue_description_id = idesc.id
      LEFT JOIN subadmin_direct_solutions sds ON sds.complaint_id = uc.id
      LEFT JOIN users_details ud ON uc.assigned_to_id = ud.id
      LEFT JOIN user_profiles up ON ud.id = up.user_id
      LEFT JOIN subadmin_profiles sp ON uc.assigned_to_id = sp.subadmin_id
      LEFT JOIN users_details dud ON uc.done_by_id = dud.id
      LEFT JOIN admin_profiles done_by_ap ON done_by_ap.admin_id = dud.id
      LEFT JOIN subadmin_profiles done_by_sp ON done_by_sp.subadmin_id = dud.id
      LEFT JOIN complaint_feedback cf ON cf.complaint_id = uc.id AND cf.user_id = ?
      WHERE uc.user_id = ? AND uc.deleted_at IS NULL AND uc.main_issue_id = 1
      GROUP BY uc.id
    )

    ORDER BY created_at DESC
    `,
    [userId, userId,userId,userId]
  );
  return complaints.map(c => ({
    id: c.complaint_id,
    description: c.description,
    status: c.status,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    isAIResolved: !!c.is_ai_resolved,
    mainIssue: c.main_issue,
    relatedIssue: c.related_issue,
    subRelatedIssue: c.sub_related_issue,
    assignedTo: c.assigned_to_name,
    assignedToPhone: c.assigned_to_phone || 'N/A',
    doneBy: c.resolved_by_name,
    issueDescription: c.issue_description,
    solutionSteps: c.solution_steps ? c.solution_steps.split('||') : [],
    directSolution: c.direct_solution,
      // ✅ Feedback fields
  hasFeedback: !!c.has_feedback,
  feedbackLabel: c.feedback_label || '',
  feedbackComment: c.feedback_comment || ''
  }));
};

/**-------------------------------------------------------------------------------- */

export const logResolution = async (userId, { isResolved, sessionId }) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let result;
    if (isResolved) {
      [result] = await connection.query(
        'INSERT INTO ai_resolution_logs (user_id, is_resolved, session_id) VALUES (?, ?, ?)',
        [userId, isResolved, sessionId]
      );
    }

    await connection.commit();
    logger.info('Resolution processed', { userId, isResolved, sessionId });
    return { id: result?.insertId || null, isResolved, sessionId };
  } catch (err) {
    await connection.rollback();
    logger.error('Failed to process resolution', { error: err.message, userId });
    throw err;
  } finally {
    connection.release();
  }
};

/**-------------------------------------------------------------------------------- */

export const getIssues = async () => {
  let mainIssues = issueCache.get('mainIssues');
  let relatedIssues = issueCache.get('relatedIssues');
  let subRelatedIssues = issueCache.get('subRelatedIssues');

  if (!mainIssues) {
    const [rows] = await pool.query('SELECT id, name FROM main_issues');
    mainIssues = rows;
    issueCache.set('mainIssues', mainIssues);
  }

  if (!relatedIssues) {
    const [rows] = await pool.query('SELECT id, main_issue_id, name FROM related_issues');
    relatedIssues = rows;
    issueCache.set('relatedIssues', relatedIssues);
  }

  if (!subRelatedIssues) {
    const [rows] = await pool.query('SELECT id, related_issue_id, name FROM sub_related_issues');
    subRelatedIssues = rows;
    issueCache.set('subRelatedIssues', subRelatedIssues);
  }

  return { mainIssues, relatedIssues, subRelatedIssues };
};

