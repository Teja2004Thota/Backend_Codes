import pool from '../../config/db.js';
import logger from '../../utils/logger.js';

export const restrictComplaintActions = async (req, res, next) => {
  const userId = req.user.id;
  const complaintId = parseInt(req.params.id);

  try {
    const [complaint] = await pool.query(
      'SELECT id, user_id, status, deleted_at FROM user_complaints WHERE id = ?',
      [complaintId]
    );

    if (!complaint.length) {
      logger.warn('Complaint not found', { complaintId, userId });
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint[0].user_id !== userId) {
      logger.warn('Unauthorized complaint access', { complaintId, userId });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (complaint[0].deleted_at) {
      logger.warn('Attempt to access deleted complaint', { complaintId, userId });
      return res.status(400).json({ error: 'Complaint already deleted' });
    }

    if (complaint[0].status !== 'Open') {
      logger.warn('Attempt to modify non-Open complaint', { complaintId, userId, status: complaint[0].status });
      return res.status(400).json({ error: 'Only Open complaints can be modified' });
    }

    req.complaint = complaint[0];
    next();
  } catch (err) {
    logger.error('Error in restrictComplaintActions', { error: err.message, userId, complaintId });
    return res.status(500).json({ error: 'Server error' });
  }
};