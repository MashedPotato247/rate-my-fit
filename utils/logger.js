const fs = require('fs');
const path = require('path');
const config = require('../config');

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const getDateString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getTimeString = () => {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const shouldLogDebug = config.NODE_ENV !== 'production';

const log = (level, message, data = null) => {
  if (level === LOG_LEVELS.DEBUG && !shouldLogDebug) {
    return;
  }
  
  const timestamp = `${getDateString()} ${getTimeString()}`;
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(logMessage);
      if (data) console.error(data);
      break;
    case LOG_LEVELS.WARN:
      console.warn(logMessage);
      if (data) console.warn(data);
      break;
    case LOG_LEVELS.DEBUG:
    case LOG_LEVELS.INFO:
    default:
      console.log(logMessage);
      if (data) console.log(data);
      break;
  }
  
  const logFile = path.join(logsDir, `${getDateString()}.log`);
  const logEntry = `${logMessage}${data ? ' ' + JSON.stringify(data, null, 2) : ''}\n`;
  
  fs.appendFile(logFile, logEntry, (err) => {
    if (err) {
      console.error(`Failed to write to log file: ${err.message}`);
    }
  });
};

module.exports = {
  error: (message, data) => log(LOG_LEVELS.ERROR, message, data),
  warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
  info: (message, data) => log(LOG_LEVELS.INFO, message, data),
  debug: (message, data) => log(LOG_LEVELS.DEBUG, message, data),
  LOG_LEVELS
};
