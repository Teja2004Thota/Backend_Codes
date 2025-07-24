import express from 'express';
import { authMiddleware } from '../../middleware/authentication/authMiddleware.js';
import {
  getGeneralComplaintsController,
  getPendingComplaintsController,
  takeComplaintController,
  rejectComplaintController,
  updateGeneralComplaintSolutionController,
  getDashboardSummaryController,
  getRelatedIssuesController,
  getMainIssuesController,
  getSubRelatedIssuesController,
  updateUncategorizedComplaintController,
  getAllAdminsController,
  getAllSubadminsController,
  getSolvedComplaintsController,
  getAssignedComplaintsController
} from '../../controllers/subadminSide/subadminController.js';
import { param, body, query } from 'express-validator';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

router.get(
  '/complaints/assigned',
  apiLimiter,
  authMiddleware(['subadmin']),
  getAssignedComplaintsController
);



/**General complaints ROUTES started */
router.get(
  '/dashboard/summary',
  apiLimiter,
  authMiddleware(['subadmin']),
  getDashboardSummaryController
);

router.get(
  '/complaints/solved',
  apiLimiter,
  authMiddleware(['subadmin']),
  getSolvedComplaintsController
);

router.get(
  '/complaints/general',
  apiLimiter,
  authMiddleware(['subadmin']),
  getGeneralComplaintsController
);

router.post(
  '/complaints/:complaintId/update-general-solution',
  apiLimiter,
  authMiddleware(['subadmin']),
  [
    param('complaintId').isInt({ min: 1 }).withMessage('Complaint ID must be a positive integer'),
    body('subRelatedIssue').optional().isObject().withMessage('Sub-related issue must be an object'),
    body('subRelatedIssue.name').optional().isString().trim().isLength({ max: 100 }).withMessage('Sub-related issue name must be a string, max 100 characters'),
    body('subRelatedIssue.related_issue_id').optional().isInt({ min: 1 }).withMessage('Related issue ID must be a positive integer'),
    body('issueDescription').optional().isString().trim().isLength({ max: 1000 }).withMessage('Issue description must be a string, max 1000 characters'),
    body('solutionSteps').optional().isArray().withMessage('Solution steps must be an array'),
    body('solutionSteps.*').optional().isString().trim().isLength({ max: 500 }).withMessage('Each solution step must be a string, max 500 characters'),
    body('directSolution').optional().isString().trim().isLength({ max: 1000 }).withMessage('Direct solution must be a string, max 1000 characters'),
    body('doneById').optional().isInt({ min: 1 }).withMessage('Done By ID must be a valid user'),

  ],
  updateGeneralComplaintSolutionController
);
/**General complaints ROUTES ended */


/**Uncategorized complaints ROUTES started */

router.get(
  '/complaints/pending',
  apiLimiter,
  authMiddleware(['subadmin']),
  getPendingComplaintsController
);

router.post(
  '/complaints/:id/take',
  apiLimiter,
  authMiddleware(['subadmin']),
  [param('id').isInt({ min: 1 }).withMessage('Complaint ID must be a positive integer')],
  takeComplaintController
);

router.post(
  '/complaints/:id/reject',
  apiLimiter,
  authMiddleware(['subadmin']),
  [param('id').isInt({ min: 1 }).withMessage('Complaint ID must be a positive integer')],
  rejectComplaintController
);

router.post(
  '/complaints/:id/update-uncategorized',
  apiLimiter,
  authMiddleware(['subadmin']),
  [
    param('id').isInt({ min: 1 }).withMessage('Complaint ID must be a positive integer'),
    body('mainIssue').isObject().withMessage('Main issue must be an object'),
    body('mainIssue.id').optional().isInt({ min: 1 }).withMessage('Main issue ID must be a positive integer'),
    body('mainIssue.name').optional().isString().trim().isLength({ max: 100 }).withMessage('Main issue name must be a string, max 100 characters'),
    body('relatedIssue').optional().isObject().withMessage('Related issue must be an object'),
    body('relatedIssue.id').optional().isInt({ min: 1 }).withMessage('Related issue ID must be a positive integer'),
    body('relatedIssue.name').optional().isString().trim().isLength({ max: 100 }).withMessage('Related issue name must be a string, max 100 characters'),
    body('subRelatedIssue').optional().isObject().withMessage('Sub-related issue must be an object'),
    body('subRelatedIssue.id').optional().isInt({ min: 1 }).withMessage('Sub-related issue ID must be a positive integer'),
    body('subRelatedIssue.name').optional().isString().trim().isLength({ max: 100 }).withMessage('Sub-related issue name must be a string, max 100 characters'),
    body('issueDescription').optional().isString().trim().isLength({ max: 1000 }).withMessage('Issue description must be a string, max 1000 characters'),
    body('solutionSteps').optional().isArray().withMessage('Solution steps must be an array'),
    body('solutionSteps.*').optional().isString().trim().isLength({ max: 500 }).withMessage('Each solution step must be a string, max 500 characters'),
    body('doneById').optional().isInt({ min: 1 }).withMessage('Done By must be a valid user ID'),

  ],
  updateUncategorizedComplaintController
);
/**Uncategorized complaints ROUTES ended */

router.get(
  '/related-issues',
  apiLimiter,
  authMiddleware(['subadmin']),
  [query('main_issue_id').optional().isInt({ min: 1 }).withMessage('Main issue ID must be a positive integer')],
  getRelatedIssuesController
);

router.get(
  '/main-issues',
  apiLimiter,
  authMiddleware(['subadmin']),
  getMainIssuesController
);

router.get(
  '/sub-related-issues',
  apiLimiter,
  authMiddleware(['subadmin']),
  [query('related_issue_id').optional().isInt({ min: 1 }).withMessage('Related issue ID must be a positive integer')],
  getSubRelatedIssuesController
);

router.get('/all-admins', authMiddleware(['subadmin']), getAllAdminsController);
router.get('/all-subadmins', authMiddleware(['subadmin']), getAllSubadminsController);



export default router;