import express from 'express';
import { authMiddleware } from '../../middleware/authentication/authMiddleware.js';
import { restrictComplaintActions } from '../../middleware/userside/restrictComplaintActions.js';
import {classifyDescriptionController, submitComplaintController, getAllComplaintsController, logResolutionController, getTrackComplaintsController, getSolutionsController } from '../../controllers/userSide/complaintController.js';
import { getUserDashboardSummaryController } from '../../controllers/userSide/complaintController.js';
import { body, param, query } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { submitFeedback } from '../../controllers/userSide/complaintController.js';
import logger from '../../utils/logger.js';
import { getIssuesController, getAllRelatedIssuesController, getSubRelatedIssuesController } from '../../controllers/userSide/complaintController.js';

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

/*const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many delete requests, please try again later.'
});
*/
/**1. USER SIDE ROUTES FOR create A COMPLAINT STARTED */

router.get(
  '/dashboard/summary',
  authMiddleware(['user']),
  getUserDashboardSummaryController
);

router.post(
  '/classify-description',
  apiLimiter,
  authMiddleware(['user']),
  [body('description').isString().notEmpty().trim().withMessage('Description is required')],
  classifyDescriptionController
);

router.get(
  '/solutions',
  apiLimiter,
  authMiddleware(['user']),
  [
    query('subRelatedIssueId').isInt({ min: 1 }).withMessage('Sub-related issue ID must be a positive integer')
  ],
  getSolutionsController
);

router.post(
  '/submit',
  apiLimiter,
  authMiddleware(['user']),
  [
    body('description').isString().notEmpty().trim().withMessage('Description is required'),
    body('mainIssueId').optional().isInt({ min: 1 }).withMessage('Main issue ID must be a positive integer'),
    body('relatedIssueId').optional().isInt({ min: 1 }).withMessage('Related issue ID must be a positive integer'),
    body('subRelatedIssueId').optional().isInt({ min: 1 }).optional({ nullable: true }).withMessage('Sub-related issue ID must be a positive integer or null'),
    body('priority')
      .optional()
      .customSanitizer(value => value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value)
      .isIn(['Low', 'Medium', 'High']).withMessage('Invalid priority'),
    body('isResolved').optional().isBoolean().withMessage('isResolved must be a boolean'),
    body('sessionId').optional().isUUID().withMessage('Session ID must be a valid UUID'),
    body('issueDescription').optional().isString().trim().withMessage('Issue description must be a string')
  ],
  submitComplaintController
);

/**1. USER SIDE ROUTES FOR create A COMPLAINT ENDED */

router.get(
  '/allcomplaints',
  apiLimiter,
  authMiddleware(['user']),
  getAllComplaintsController
);

router.post(
  '/log-resolution',
  apiLimiter,
  authMiddleware(['user']),
  [
    body('isResolved').isBoolean().withMessage('isResolved must be a boolean'),
    body('sessionId').optional().isUUID().withMessage('Session ID must be a valid UUID')
  ],
  logResolutionController
);

router.get('/track-complaints', authMiddleware(['user']), getTrackComplaintsController);
router.post('/submit-feedback', authMiddleware(['user']), submitFeedback);

router.get('/main-issues', authMiddleware(['user']), getIssuesController);
// Add this NEW route above existing `/related-issues` route
router.get('/related-issues/all', authMiddleware(['user']), getAllRelatedIssuesController);

router.get('/sub-related-issues', authMiddleware(['user']), getSubRelatedIssuesController);

export default router;