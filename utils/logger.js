import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.metadata(),
    winston.format.printf(({ timestamp, level, message, metadata }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

export default logger;