// constants.js
module.exports = {
  PUPPETEER_ARGS: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled", // Menghilangkan flag "navigator.webdriver"
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list",
    // User Agent Chrome versi terbaru di Windows 10
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ],

  MIME_TYPE_MAP: {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
    'text/plain': 'txt',
    'application/json': 'json',
  },

  BOT_COMMANDS: {
    INFO: '!info',
    TEST: '!test',
    PING: '!ping',
  },

  // Jeda antar pesan yang lebih aman (dalam milidetik)
  MIN_DELAY: 3000, // Minimal 3 detik
  MAX_DELAY: 7000, // Maksimal 7 detik
  RECONNECT_DELAY: 10000, 
  REINIT_DELAY: 5000,
};