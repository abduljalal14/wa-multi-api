require('dotenv').config();

module.exports = {
  API_KEY: process.env.API_KEY,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  
  // Paths
  CONFIG_DIR: process.env.CONFIG_DIR,
  SESSIONS_DIR: process.env.SESSIONS_DIR,
  
  // Webhook settings
  WEBHOOK_TIMEOUT: parseInt(process.env.WEBHOOK_TIMEOUT),
  
  // File upload limits
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE), // 50MB
  DOWNLOAD_TIMEOUT: parseInt(process.env.DOWNLOAD_TIMEOUT),
};