import express from 'express';
import multer from 'multer';
import {
  createUserController,
  getAdminDashboardSummaryController,
  importUsersController,
  getAllComplaintsForAdmin,
  getRepeatedComplaintsController,
  getAllSubadminsWithPerformanceController,
  getSubadminComplaintsByMainIssueController,
  getSubadmins,
  assignComplaintController,
  getTopRepeatComplainersController, // New controller
  getUserComplaintTimelineController, // New controller
  getAllUsersWithSummaryController,
    getHighPriorityComplaintsController,
} from '../../controllers/adminSide/adminController.js';
import * as adminController from '../../controllers/adminSide/adminController.js';
const router = express.Router();

// Set up multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Routes
router.post('/create-user', createUserController);
router.post('/import-users', upload.single('file'), importUsersController);
router.get('/dashboard/summary', getAdminDashboardSummaryController);
router.get('/dashboard/complaints', getAllComplaintsForAdmin);
router.get('/dashboard/repeated-complaints', getRepeatedComplaintsController);
router.get('/dashboard/subadmins', getAllSubadminsWithPerformanceController);
router.get('/subadmin/:subadminId/main-issue/:mainIssueId', getSubadminComplaintsByMainIssueController);
router.get('/subadmins', getSubadmins);
router.post('/assign/:complaintId', assignComplaintController);
router.get('/top-complainers', getTopRepeatComplainersController); // New route
router.get('/user-timeline/:userId', getUserComplaintTimelineController); // New route
router.get('/users/summary', getAllUsersWithSummaryController);
router.get('/dashboard/high-priority-complaints', getHighPriorityComplaintsController);


// --- Database Update Routes ---
router.post('/db-update/main-issue', adminController.createMainIssue);
router.post('/db-update/related-issue', adminController.createRelatedIssue);
router.post('/db-update/sub-related-issue', adminController.createSubRelatedIssue);
router.post('/db-update/description', adminController.createIssueDescription);
router.post('/db-update/solution', adminController.createIssueSolution);
router.post('/db-update/import', upload.single('file'), adminController.importFullIssueHierarchy);

router.get('/main-issues', adminController.getMainIssuesForAdmin);
router.get('/related-issues', adminController.getRelatedIssuesForAdmin);
router.get('/sub-related-issues', adminController.getSubRelatedIssuesForAdmin);
router.get('/descriptions',  adminController.getDescriptions);
router.get('/solutions', adminController.getSolutions);

// Main Issues
router.put('/db-update/main-issue/:id', adminController.updateMainIssue);
router.delete('/db-update/main-issue/:id', adminController.deleteMainIssue);

// Related Issues
router.put('/db-update/related-issue/:id', adminController.updateRelatedIssue);
router.delete('/db-update/related-issue/:id', adminController.deleteRelatedIssue);

// Sub-Related Issues
router.put('/db-update/sub-related-issue/:id', adminController.updateSubRelatedIssue);
router.delete('/db-update/sub-related-issue/:id', adminController.deleteSubRelatedIssue);

// Descriptions
router.put('/db-update/description/:id', adminController.updateIssueDescription);
router.delete('/db-update/description/:id', adminController.deleteIssueDescription);

router.put('/db-update/solution/:id', adminController.updateIssueSolution);
router.get('/admins', adminController.getAllAdminsWithProfile);
router.delete('/admins/:staffNo', adminController.deleteAdminByStaffNo);
router.delete('/users/:staffNo', adminController.deleteUserByStaffNo);


export default router;