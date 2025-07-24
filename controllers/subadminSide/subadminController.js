import {
  getDashboardSummary,
  getGeneralComplaints,
  getPendingComplaints,
  takeComplaint,
  getSolvedComplaintsBySubadmin,
  rejectComplaint,
  updateGeneralComplaintSolution,
  getRelatedIssues,
  getMainIssues,
  getSubRelatedIssues,
  updateUncategorizedComplaint,
} from '../../services/subadminSide/subadminService.js';
import { getAssignedComplaintsBySubadmin } from '../../services/subadminSide/subadminService.js';
import logger from '../../utils/logger.js';
import { validationResult } from 'express-validator';
import pool from '../../config/db.js'; // adjust path as needed


export const getAssignedComplaintsController = async (req, res) => {
  try {
    const subadminId = req.user.id;
    const complaints = await getAssignedComplaintsBySubadmin(subadminId);
    res.status(200).json({ success: true, complaints });
  } catch (err) {
    logger.error('Error fetching assigned complaints', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch assigned complaints' });
  }
};



/**General complaints CONTROLLERS started */
export const getDashboardSummaryController = async (req, res) => {
  try {
    const subadminId = req.user.id;
    const summary = await getDashboardSummary(subadminId);
    res.status(200).json({ success: true, ...summary });
  } catch (err) {
    logger.error('Error fetching dashboard summary', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// General complaints controller
export const getGeneralComplaintsController = async (req, res) => {
  try {
    const complaints = await getGeneralComplaints();
    res.status(200).json({ success: true, complaints });
  } catch (error) {
    logger.error('Error fetching general complaints:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

// Solved complaints controller
export const getSolvedComplaintsController = async (req, res) => {
  try {
    const subadminId = req.user.id;
    const complaints = await getSolvedComplaintsBySubadmin(subadminId);
    res.status(200).json({ success: true, complaints });
  } catch (error) {
    logger.error('Error fetching solved complaints:', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};



export const updateGeneralComplaintSolutionController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in updateGeneralComplaintSolution', { errors: errors.array() });
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }

  const { complaintId } = req.params;
  const subadminId = req.user.id;

  try {
    const result = await updateGeneralComplaintSolution(complaintId, subadminId, req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('Error updating general complaint solution', { error: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
};
/**General complaints CONTROLLERS ended */


/**Uncategorized complaints CONTROLLERS started */
export const getPendingComplaintsController = async (req, res) => {
  try {
    const subadminId = req.user.id;
    const complaints = await getPendingComplaints(subadminId);
    res.status(200).json({ success: true, complaints });
  } catch (err) {
    logger.error('Error fetching pending complaints', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

export const takeComplaintController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in takeComplaint', { errors: errors.array() });
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }

  try {
    const subadminId = req.user.id;
    const { id: complaintId } = req.params;
    const result = await takeComplaint(subadminId, complaintId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('Error taking complaint', { error: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
};

export const rejectComplaintController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in rejectComplaint', { errors: errors.array() });
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }

  try {
    const subadminId = req.user.id;
    const { id: complaintId } = req.params;
    const result = await rejectComplaint(subadminId, complaintId);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('Error rejecting complaint', { error: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
};
export const updateUncategorizedComplaintController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in updateUncategorizedComplaint', { errors: errors.array() });
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }

  const { id: complaintId } = req.params;
  const subadminId = req.user.id;

  try {
    const result = await updateUncategorizedComplaint(complaintId, subadminId, req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('Error updating uncategorized complaint', { error: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
};

/**Uncategorized complaints CONTROLLERS ended */

export const getMainIssuesController = async (req, res) => {
  try {
    const mainIssues = await getMainIssues();
    res.status(200).json({ success: true, mainIssues });
  } catch (err) {
    logger.error('Error fetching main issues', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getRelatedIssuesController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in getRelatedIssues', { errors: errors.array() });
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }

  try {
    const { main_issue_id } = req.query;
    const relatedIssues = await getRelatedIssues(main_issue_id ? parseInt(main_issue_id) : undefined);
    res.status(200).json({ success: true, relatedIssues });
  } catch (err) {
    logger.error('Error fetching related issues', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getSubRelatedIssuesController = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors in getSubRelatedIssues', { errors: errors.array() });
    return res.status(400).json({ success: false, message: 'Invalid input', errors: errors.array() });
  }

  try {
    const { related_issue_id } = req.query;
    const subRelatedIssues = await getSubRelatedIssues(related_issue_id ? parseInt(related_issue_id) : undefined);
    res.status(200).json({ success: true, subRelatedIssues });
  } catch (err) {
    logger.error('Error fetching sub-related issues', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllAdminsController = async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, ap.name 
      FROM users_details u
      JOIN admin_profiles ap ON ap.admin_id = u.id
      WHERE u.role = 'admin'
    `);
    res.status(200).json({ success: true, users });
  } catch (error) {
    logger.error('Failed to fetch admins', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
};

export const getAllSubadminsController = async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, sp.name 
      FROM users_details u
      JOIN subadmin_profiles sp ON sp.subadmin_id = u.id
      WHERE u.role = 'subadmin'
    `);
    res.status(200).json({ success: true, users });
  } catch (error) {
    logger.error('Failed to fetch subadmins', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch subadmins' });
  }
};
