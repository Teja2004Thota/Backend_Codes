import { validationResult } from 'express-validator';
import logger from '../../utils/logger.js';
import {classifyComplaintFromDescription, submitComplaint, getAllComplaints, logResolution, getTrackComplaints, getSolutions } from '../../services/userSide/complaintService.js';
import { getUserComplaintSummary } from '../../services/userSide/complaintService.js';
import pool from '../../config/db.js'; // ✅ Ensure this is at the top

/**1. USER SIDE CONTROLLER FOR create A COMPLAINT STARTED */

export const getUserDashboardSummaryController = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getUserComplaintSummary(userId);
    res.status(200).json({ success: true, stats });
  } catch (err) {
    logger.error('Failed to fetch user dashboard summary', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary' });
  }
};



export const classifyDescriptionController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in classifyDescriptionController', { errors: errors.array().map(err => err.msg) });
    return res.status(400).json({ errors: errors.array() });
  }
  const { description } = req.body;
  try {
    const result = await classifyComplaintFromDescription(description);
    logger.info('Description classified', { description, mainIssue: result.mainIssue });

    const message = result.mainIssueId === 1 && result.relatedIssueId === 1
      ? 'Issue not found in database. It will be reviewed by a subadmin.'
      : 'Issue classified successfully. Please select a sub-related issue.';

    return res.status(200).json({
      success: true,
      ...result,
      message
    });
  } catch (err) {
    logger.error('Error classifying description', { error: err.message });
    return res.status(500).json({ error: 'Failed to classify description' });
  }
};



export const getSolutionsController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in getSolutionsController', { errors: errors.array().map(err => err.msg) });
    return res.status(400).json({ errors: errors.array() });
  }

  const { subRelatedIssueId } = req.query;

  try {
    const result = await getSolutions(subRelatedIssueId);
    logger.info('Solutions retrieved successfully', { subRelatedIssueId });
    return res.status(200).json({
      success: true,
      ...result,
      message: result.solutions.length ? 'Solutions retrieved successfully' : 'No solutions found'
    });
  } catch (err) {
    logger.error('Error retrieving solutions', { error: Err.message });
    return res.status(500).json({ error: 'Failed to retrieve solutions' });
  }
};



export const submitComplaintController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in submitComplaintController', {
      errors: errors.array().map(err => err.msg),
    });
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.user.id;
  const {
    description = '', // Allow empty description for manual mode
    mainIssueId = 1,
    relatedIssueId = 1,
    subRelatedIssueId,
    priority = 'Medium',
    isResolved = false,
    sessionId,
    issueDescription,
    contactNumber,
  } = req.body;

  try {
    // Determine contact from DB if not provided
    let finalContact = contactNumber;
    if (!finalContact) {
      const [[userRow]] = await pool.query('SELECT role FROM users_details WHERE id = ?', [userId]);
      const role = userRow?.role;
      if (role) {
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
        }
        const [existing] = await pool.query(`SELECT contacts FROM ${profileTable} WHERE ${idField} = ?`, [userId]);
        if (existing.length > 0) {
          try {
            const contactsArray = JSON.parse(existing[0].contacts || '[]');
            if (Array.isArray(contactsArray) && contactsArray.length > 0) {
              finalContact = contactsArray[contactsArray.length - 1];
            }
          } catch (e) {
            logger.warn('Failed to parse existing contacts fallback to none', { userId });
          }
        }
      }
    }

    // Submit complaint
    const complaint = await submitComplaint(userId, {
      description,
      mainIssueId,
      relatedIssueId,
      subRelatedIssueId: typeof subRelatedIssueId !== 'undefined' ? subRelatedIssueId : null,
      priority,
      isResolved,
      sessionId,
      issueDescription,
    });

    // Save contact number if provided
    if (contactNumber && typeof contactNumber === 'string') {
      const [[userRow]] = await pool.query('SELECT role FROM users_details WHERE id = ?', [userId]);
      const role = userRow?.role;
      if (role) {
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
        }
        await pool.query(`UPDATE ${profileTable} SET contacts = ? WHERE ${idField} = ?`, [JSON.stringify([contactNumber]), userId]);
        logger.info('📞 Contact number replaced in profile', { userId, contactNumber });
      }
    }

    logger.info('📌 Complaint submitted successfully', { complaintId: complaint.id, userId });
    const message =
      mainIssueId === 1 && relatedIssueId === 1
        ? 'Complaint raised with Others category, pending subadmin review.'
        : 'Complaint raised successfully.';
    return res.status(201).json({
      success: true,
      complaint,
      contactUsed: finalContact || null,
      message,
    });
  } catch (err) {
    logger.error('❌ Error submitting complaint', { error: err.message, userId });
    return res.status(500).json({ error: err.message || 'Failed to submit complaint' });
  }
};

/**1. USER SIDE CONTROLLER FOR create A COMPLAINT ENDED */



export const getAllComplaintsController = async (req, res) => {
  const userId = req.user.id;

  try {
    const complaints = await getAllComplaints(userId);
    logger.info('All complaints retrieved successfully', { userId, count: complaints.length });
    return res.status(200).json({
      success: true,
      complaints,
      message: complaints.length ? 'Complaints retrieved successfully' : 'No complaints found'
    });
  } catch (err) {
    logger.error('Error retrieving complaints', { error: err.message, userId });
    return res.status(500).json({ error: 'Failed to retrieve complaints' });
  }
};



export const logResolutionController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in logResolutionController', { errors: errors.array().map(err => err.msg) });
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.user.id;
  const { isResolved, sessionId } = req.body;

  try {
    const result = await logResolution(userId, { isResolved, sessionId });
    logger.info('Resolution processed successfully', { userId, isResolved, sessionId });

    const message = isResolved
      ? 'AI resolved, no complaint raised.'
      : 'AI not resolved, please proceed with complaint submission.';

    return res.status(200).json({
      success: true,
      data: result,
      message
    });
  } catch (err) {
    logger.error('Error processing resolution', { error: err.message, userId });
    return res.status(500).json({ error: err.message || 'Failed to process resolution' });
  }
};



export const getTrackComplaintsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const complaints = await getTrackComplaints(userId);
    res.status(200).json({ success: true, complaints });
  } catch (err) {
    logger.error('Failed to fetch track complaints', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch track complaints' });
  }
};



export const submitFeedback = async (req, res) => {
  const user_id = req.user.id;
  const { complaint_id, label, comment } = req.body;

  const allowedLabels = ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'];
  if (!allowedLabels.includes(label)) {
    return res.status(400).json({ success: false, message: 'Invalid feedback label.' });
  }

  try {
    // ✅ Get subadmin_id from the complaint record
    const [[complaint]] = await pool.query(
      'SELECT assigned_to_id FROM user_complaints WHERE id = ?',
      [complaint_id]
    );

    if (!complaint || !complaint.assigned_to_id) {
      return res.status(400).json({ success: false, message: 'Invalid complaint ID or complaint not assigned yet.' });
    }

    const subadmin_id = complaint.assigned_to_id;

    // ✅ Insert feedback
    const [result] = await pool.query(
      `INSERT INTO complaint_feedback (user_id, subadmin_id, complaint_id, label, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, subadmin_id, complaint_id, label, comment]
    );

    res.status(200).json({ success: true, message: 'Feedback submitted successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Feedback already submitted for this complaint.' });
    }

    console.error('[submitFeedback ERROR]', error);
    res.status(500).json({ success: false, message: 'Internal Server Error.' });
  }
};


export const getIssuesController = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name FROM main_issues');
    res.status(200).json({ success: true, mainIssues: rows });
  } catch (err) {
    logger.error('Failed to fetch main issues', { error: err.message });
    res.status(500).json({ success: false, message: 'Error fetching main issues' });
  }
};

export const getAllRelatedIssuesController = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        r.id, r.name, r.main_issue_id, m.name AS main_issue_name
      FROM 
        related_issues r
      JOIN 
        main_issues m ON r.main_issue_id = m.id
    `);
    res.status(200).json({ success: true, relatedIssues: rows });
  } catch (err) {
    logger.error('Failed to fetch all related issues', { error: err.message });
    res.status(500).json({ success: false, message: 'Error fetching related issues' });
  }
};


export const getSubRelatedIssuesController = async (req, res) => {
  const { related_issue_id } = req.query;
  if (!related_issue_id) return res.status(400).json({ success: false, message: 'related_issue_id is required' });

  try {
    const [rows] = await pool.query(
      'SELECT id, name, related_issue_id FROM sub_related_issues WHERE related_issue_id = ?',
      [related_issue_id]
    );
    res.status(200).json({ success: true, subRelatedIssues: rows });
  } catch (err) {
    logger.error('Failed to fetch sub-related issues', { error: err.message });
    res.status(500).json({ success: false, message: 'Error fetching sub-related issues' });
  }
};
