import jwt from 'jsonwebtoken';
import config from '../config/config.js';

export const generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessTokenExpiry });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw new Error('Token verification failed');
  }
};