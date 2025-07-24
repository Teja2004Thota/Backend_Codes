import express from 'express';
import dotenv from 'dotenv';
import './config/db.js';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';

import authRoutes from './routes/authentication/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import profileRoutes from './routes/userSide/profileRoutes.js';
import complaintRoutes from './routes/userSide/complaintRoutes.js';
import subadminRoutes from './routes/subadminSide/subadminRoutes.js';
import adminRoutes from './routes/adminSide/adminRoutes.js';

dotenv.config();
const app = express();
app.set('trust proxy', 1);

// ✅ Allowed frontend origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://172.232.52.251:5173',
  'http://172.232.52.251:5180',
  'https://frontend-codes-alpha.vercel.app',
];

// ✅ Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_HTTPS) {
  app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ✅ Serve uploaded static files with headers
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
    if (filePath.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
  }
}));

// ✅ Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "*", "http://localhost:4000", "http://localhost:5173"],
        connectSrc: ["'self'", "http://localhost:4000", "http://localhost:5173"],
      },
    },
  })
);

// ✅ JSON parsing
app.use(express.json());

// ✅ Allow OPTIONS preflight requests globally
app.options(/^\/.*$/, cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ Allow CORS for actual requests
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ Log all incoming requests
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    origin: req.headers.origin,
  });
  next();
});

// ✅ Main API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/subadmin', subadminRoutes);
app.use('/api/admin', adminRoutes);

// ✅ Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    path: req.path,
    origin: req.headers.origin,
  });
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ success: false, message: 'An unexpected error occurred' });
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
