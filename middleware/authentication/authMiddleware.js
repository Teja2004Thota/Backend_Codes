import { verifyToken } from '../../utils/jwt.js';
import logger from '../../utils/logger.js';

const authMiddleware = (allowedRoles = []) => {
  const allowed = allowedRoles.map(role => role.toLowerCase());

  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('No token provided in request');
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      req.user = { id: decoded.id, role: decoded.role, staffNo: decoded.staffNo };

      if (allowed.length && !allowed.includes(decoded.role.toLowerCase())) {
        logger.warn('Access denied: Role not authorized', { role: decoded.role, staffNo: decoded.staffNo });
        return res.status(403).json({ message: `Access denied for role: ${decoded.role}` });
      }

      next();
    } catch (err) {
      logger.error('Token verification failed', { error: err.message });

      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expired. Please log in again.' });
      }

      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
};

export { authMiddleware };
