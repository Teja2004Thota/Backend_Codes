import mysql from 'mysql2/promise';
import config from './config.js';
import logger from '../utils/logger.js';

const pool = mysql.createPool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
});

// Test DB connection with retry
(async () => {
  const maxRetries = 3;
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const connection = await pool.getConnection();
      logger.info('Database connection successful');
      connection.release();
      break;
    } catch (error) {
      retries++;
      logger.error(`Database connection attempt ${retries} failed`, { error: error.message });
      if (retries === maxRetries) {
        logger.error('Max retries reached. Exiting process.');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
})();

export default pool;