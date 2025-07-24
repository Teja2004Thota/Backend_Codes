import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { upsertProfile, getProfile } from '../../controllers/userSide/profileController.js';
import { authMiddleware } from '../../middleware/authentication/authMiddleware.js';

const router = express.Router();

const uploadDir = path.join('uploads', 'profile_photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png/;
    const isValid = types.test(file.mimetype.toLowerCase());
    cb(null, isValid);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.get('/', authMiddleware(['admin', 'subadmin', 'user']), getProfile);
router.post('/update', authMiddleware(['admin', 'subadmin', 'user']), upload.single('photo'), upsertProfile);

export default router;
