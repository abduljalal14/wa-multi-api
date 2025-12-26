const app = require('./src/app');
const path = require('path');
const FileUtils = require('./src/utils/file.utils');
const deviceService = require('./src/services/device.service');
const WhatsAppManager = require('./src/core/WhatsAppManager');
const { PORT, API_KEY, CONFIG_DIR, SESSIONS_DIR } = require('./src/config/environment');

// Ensure directories exist
FileUtils.ensureDirectoryExists(CONFIG_DIR);
FileUtils.ensureDirectoryExists(SESSIONS_DIR);

// Load existing devices from config files
function loadExistingDevices() {
  try {
    const configFiles = FileUtils.listFiles(CONFIG_DIR, '.json');
    console.log(`📂 Found ${configFiles.length} saved devices`);

    configFiles.forEach(file => {
      const deviceId = file.replace('.json', '');
      const configPath = path.join(CONFIG_DIR, file);

      try {
        const config = FileUtils.loadJSON(configPath);
        console.log(`🔄 Loading device: ${deviceId}`);

        const manager = new WhatsAppManager(deviceId, config);
        deviceService.clients.set(deviceId, manager);
      } catch (error) {
        console.error(`❌ Error loading device ${deviceId}:`, error.message);
      }
    });
  } catch (error) {
    console.error('❌ Error loading existing devices:', error.message);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  try {
    await deviceService.shutdownAllDevices();
    console.log("✅ All devices shut down successfully");
  } catch (error) {
    console.error("❌ Error during shutdown:", error.message);
  }
  process.exit(0);
});

// Start server
loadExistingDevices();

app.listen(PORT, () => {
  console.log(`\n🌐 Multi-Device WhatsApp Bot API running on http://localhost:${PORT}`);
  console.log(`\n📋 API Endpoints:`);
  console.log(`  GET  /api/devices           - List all devices`);
  console.log(`  POST /api/devices           - Create new device`);
  console.log(`  GET  /api/device            - Get device info`);
  console.log(`  PUT  /api/device            - Update device config`);
  console.log(`  DELETE /api/device          - Delete device`);
  console.log(`  POST /api/device/qr         - Get QR code`);
  console.log(`  POST /api/device/send-message - Send text message`);
  console.log(`  POST /api/device/send-image - Send image`);
  console.log(`  POST /api/device/send-document - Send document`);
  console.log(`  POST /api/device/logout     - Logout device`);
  console.log(`  POST /api/device/test-webhook - Test webhook`);
  console.log(`  GET  /api/status            - Global status`);
  console.log(`  GET  /api/health            - Health check`);
  console.log(`\n📂 Config directory: ${path.resolve(CONFIG_DIR)}`);
  console.log(`📂 Sessions directory: ${path.resolve(SESSIONS_DIR)}`);
  console.log(`📱 Loaded ${deviceService.getDeviceCount()} existing devices`);
  console.log(`🔑 Global API Key: ${API_KEY} (CHANGE THIS IN PRODUCTION!)\n`);
});