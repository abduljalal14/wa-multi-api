const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const cron = require("node-cron"); // npm install node-cron

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Storage untuk multiple clients
const clients = new Map();
const clientConfigs = new Map();

// File untuk menyimpan konfigurasi global
const CONFIG_DIR = "./configs";
const SESSIONS_DIR = "./sessions";

// Pastikan direktori ada
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Global API Key
const GLOBAL_API_KEY = process.env.API_KEY || "YOUR_SUPER_SECRET_API_KEY";

// Utility functions untuk cleanup
class SessionCleaner {
  static async cleanupSessionFolder(sessionPath) {
    try {
      if (!fs.existsSync(sessionPath)) return;

      const foldersToClean = [
        'Default/Cache',
        'Default/Code Cache',
        'Default/GPUCache',
        'Default/Service Worker/CacheStorage',
        'Default/Service Worker/ScriptCache',
        'Default/blob_storage',
        'Default/File System',
        'Default/IndexedDB',
        'Default/Local Storage',
        'Default/Session Storage',
        'Default/WebStorage',
        'ShaderCache',
        'GraphiteDawnCache'
      ];

      for (const folder of foldersToClean) {
        const folderPath = path.join(sessionPath, folder);
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(`🧹 Cleaned: ${folder}`);
        }
      }

      // Clean log files
      const logFiles = fs.readdirSync(sessionPath).filter(file => 
        file.endsWith('.log') || file.endsWith('.tmp') || file.startsWith('debug')
      );
      
      for (const logFile of logFiles) {
        const logPath = path.join(sessionPath, logFile);
        fs.unlinkSync(logPath);
        console.log(`🧹 Removed log: ${logFile}`);
      }

      console.log(`✅ Session cleanup completed for: ${sessionPath}`);
    } catch (error) {
      console.error(`❌ Error cleaning session folder: ${error.message}`);
    }
  }

  static async getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += await this.getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static async cleanupOldSessions() {
    try {
      const sessionDirs = fs.readdirSync(SESSIONS_DIR);
      
      for (const sessionDir of sessionDirs) {
        const sessionPath = path.join(SESSIONS_DIR, sessionDir);
        const stats = fs.statSync(sessionPath);
        
        // Cleanup sessions older than 7 days that are not active
        const daysSinceModified = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceModified > 7) {
          const deviceId = sessionDir.replace('session-', '');
          const manager = clients.get(deviceId);
          
          // Only cleanup if device is not active
          if (!manager || !manager.isClientReady) {
            console.log(`🧹 Cleaning up old session: ${sessionDir}`);
            await this.cleanupSessionFolder(sessionPath);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during scheduled cleanup:', error.message);
    }
  }
}

// Class untuk mengelola WhatsApp Client
class WhatsAppManager {
  constructor(deviceId, config = {}) {
    this.deviceId = deviceId;
    this.config = {
      webhook_url: config.webhook_url || null,
      device_name: config.device_name || `Device-${deviceId}`,
      auto_reply: config.auto_reply || false,
      cleanup_interval: config.cleanup_interval || 24, // hours
      ...config
    };
    this.currentQR = null;
    this.isClientReady = false;
    this.client = null;
    this.configFile = path.join(CONFIG_DIR, `${deviceId}.json`);
    this.sessionPath = path.join(SESSIONS_DIR, `session-${deviceId}`);
    this.lastCleanup = null;

    this.loadConfig();
    this.initializeClient();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const savedConfig = JSON.parse(fs.readFileSync(this.configFile, "utf8"));
        this.config = { ...this.config, ...savedConfig };
        this.lastCleanup = savedConfig.last_cleanup || null;
        console.log(`📁 [${this.deviceId}] Konfigurasi dimuat dari file`);
      } else {
        this.saveConfig();
      }
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error loading config:`, error.message);
      this.saveConfig();
    }
  }

  saveConfig() {
    try {
      const configToSave = {
        ...this.config,
        last_updated: new Date().toISOString(),
        last_cleanup: this.lastCleanup,
        version: "2.0.0",
        device_id: this.deviceId
      };
      fs.writeFileSync(this.configFile, JSON.stringify(configToSave, null, 2));
      console.log(`💾 [${this.deviceId}] Konfigurasi disimpan`);
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error saving config:`, error.message);
    }
  }

  async cleanupSession() {
    try {
      if (this.isClientReady) {
        console.log(`⏳ [${this.deviceId}] Skipping cleanup - client is active`);
        return;
      }

      console.log(`🧹 [${this.deviceId}] Starting session cleanup...`);
      
      // Get size before cleanup
      const sizeBefore = await SessionCleaner.getDirectorySize(this.sessionPath);
      
      // Perform cleanup
      await SessionCleaner.cleanupSessionFolder(this.sessionPath);
      
      // Get size after cleanup
      const sizeAfter = await SessionCleaner.getDirectorySize(this.sessionPath);
      const savedSpace = sizeBefore - sizeAfter;
      
      this.lastCleanup = new Date().toISOString();
      this.saveConfig();
      
      console.log(`✅ [${this.deviceId}] Cleanup completed. Saved: ${SessionCleaner.formatBytes(savedSpace)}`);
      
      return {
        size_before: SessionCleaner.formatBytes(sizeBefore),
        size_after: SessionCleaner.formatBytes(sizeAfter),
        saved_space: SessionCleaner.formatBytes(savedSpace)
      };
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error during cleanup:`, error.message);
      throw error;
    }
  }

  async getSessionSize() {
    try {
      const size = await SessionCleaner.getDirectorySize(this.sessionPath);
      return SessionCleaner.formatBytes(size);
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error getting session size:`, error.message);
      return 'Unknown';
    }
  }

  async sendToWebhook(webhookData) {
    if (!this.config.webhook_url) return;

    try {
      const response = await axios.post(this.config.webhook_url, {
        device_id: this.deviceId,
        device_name: this.config.device_name,
        ...webhookData
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WhatsApp-Bot-Multi/2.0",
        },
        timeout: 30000,
      });
      console.log(`✅ [${this.deviceId}] Webhook berhasil dikirim`);
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error mengirim webhook:`, error.message);
    }
  }

  async sendMessage(chatId, message) {
    if (!this.isClientReady || !this.client) {
      throw new Error("Client tidak siap");
    }

    try {
      const formattedChatId = chatId.includes("@c.us") ? chatId : `${chatId}@c.us`;
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await this.client.sendMessage(formattedChatId, message);
      console.log(`✅ [${this.deviceId}] Pesan berhasil dikirim ke:`, formattedChatId);
      return result;
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Gagal mengirim pesan:`, error.message);
      throw error;
    }
  }

  initializeClient() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.deviceId,
        dataPath: SESSIONS_DIR,
      }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-extensions",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-client-side-phishing-detection",
          "--disable-component-update",
          "--disable-domain-reliability",
          "--disable-features=AudioServiceOutOfProcess",
          "--disable-ipc-flooding-protection",
          "--disable-notifications",
          "--disable-permissions-api",
          "--disable-site-isolation-trials",
          "--disable-software-rasterizer",
          "--disable-speech-api",
          "--disable-webgl",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          "--no-pings",
          "--password-store=basic",
          "--use-gl=swiftshader",
          "--use-fake-ui-for-media-stream",
          "--disable-blink-features=AutomationControlled",
          // Additional args for reduced cache
          "--disable-background-networking",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--disable-logging",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-media-stream",
          "--disable-remote-fonts",
          "--disable-shared-workers",
          "--disable-storage-reset",
          "--disable-webgl2",
          "--disable-webrtc",
          "--memory-pressure-off",
          "--no-crash-upload",
          "--no-default-browser-check",
          "--no-experiments",
          "--no-first-run",
          "--no-service-autorun",
          "--no-wifi",
          "--disable-features=VizDisplayCompositor,VizServiceDisplayCompositor",
          "--disk-cache-size=0",
          "--media-cache-size=0",
          "--aggressive-cache-discard",
          "--disable-application-cache",
          "--disable-offline-load-stale-cache",
          "--disable-disk-cache",
          "--disable-session-storage",
          "--disable-local-storage"
        ],
      },
    });

    this.setupClientEvents();
    this.client.initialize();
  }

  setupClientEvents() {
    this.client.on("qr", (qr) => {
      console.log(`=== [${this.deviceId}] SCAN QR CODE INI DI WHATSAPP ===`);
      qrcode.generate(qr, { small: true });
      this.currentQR = qr;
      this.isClientReady = false;
    });

    this.client.on("authenticated", () => {
      console.log(`✅ [${this.deviceId}] Autentikasi berhasil!`);
      this.currentQR = null;
    });

    this.client.on("ready", async () => {
      console.log(`🚀 [${this.deviceId}] WhatsApp Bot siap digunakan!`);
      console.log(`📱 [${this.deviceId}] Nomor bot:`, this.client.info.wid.user);
      this.isClientReady = true;
      
      // Auto cleanup after ready if needed
      if (this.shouldCleanup()) {
        setTimeout(() => {
          this.cleanupSession().catch(console.error);
        }, 5000); // Wait 5 seconds after ready
      }
    });

    this.client.on("disconnected", async (reason) => {
      console.log(`❌ [${this.deviceId}] WhatsApp terputus:`, reason);
      this.isClientReady = false;
      
      try {
        await this.client.destroy();
        console.log(`✅ [${this.deviceId}] Client destroyed successfully`);
      } catch (error) {
        console.error(`❌ [${this.deviceId}] Error destroying client:`, error.message);
      }

      if (reason === "LOGOUT") {
        console.log(`🗑️ [${this.deviceId}] Sesi dihapus karena logout manual`);
        // Cleanup session after logout
        setTimeout(() => {
          this.cleanupSession().catch(console.error);
        }, 2000);
      }

      setTimeout(() => {
        console.log(`🔄 [${this.deviceId}] Re-initializing client...`);
        this.client.initialize();
      }, 5000);
    });

    this.client.on("auth_failure", (msg) => {
      console.error(`❌ [${this.deviceId}] Gagal autentikasi:`, msg);
      this.isClientReady = false;
    });

    this.client.on("message", async (msg) => {
      if (msg.isStatus) return;

      console.log(`📨 [${this.deviceId}] Pesan diterima:`, msg.from, "=>", msg.body);

      // Kirim ke webhook
      if (this.config.webhook_url) {
        try {
          const contact = await msg.getContact();
          const chat = await msg.getChat();

          const hasMedia = msg.hasMedia;
          let mediaMime = "";
          let mediaName = "";

          if (hasMedia && msg.type !== "chat") {
            mediaMime = msg.type;
            mediaName = msg.type;
          }

          let locationAttached = { lat: null, lng: null };
          if (msg.location) {
            locationAttached = {
              lat: msg.location.latitude,
              lng: msg.location.longitude,
            };
          }

          const chat_id = msg.from.replace("@c.us", "");

          const webhookData = {
            type: "incoming_chat",
            data: {
              chat_id: chat_id,
              message_id: msg.id._serialized,
              name: contact.pushname || contact.name || "Unknown",
              profile_picture: await contact.getProfilePicUrl().catch(() => ""),
              timestamp: msg.timestamp,
              message_body: msg.body,
              message_ack: msg.ack || "PENDING",
              has_media: hasMedia,
              media_mime: mediaMime,
              media_name: mediaName,
              location_attached: locationAttached,
              is_forwarding: msg.isForwarded || false,
              is_from_me: false,
            },
          };

          await this.sendToWebhook(webhookData);
        } catch (error) {
          console.error(`❌ [${this.deviceId}] Error processing webhook:`, error.message);
        }
      }

      // Auto reply jika diaktifkan
      if (this.config.auto_reply && msg.body.toLowerCase().includes('ping')) {
        try {
          await msg.reply(`🤖 [${this.config.device_name}] Pong! Auto reply from device ${this.deviceId}`);
        } catch (error) {
          console.error(`❌ [${this.deviceId}] Error auto reply:`, error.message);
        }
      }

      // Bot commands
      await this.handleCommands(msg);
    });

    this.client.on("message_create", async (msg) => {
      if (msg.fromMe && this.config.webhook_url) {
        try {
          const contact = await msg.getContact();
          const chat_id = msg.to.replace("@c.us", "");

          const webhookData = {
            type: "outgoing_chat",
            data: {
              chat_id: chat_id,
              message_id: msg.id._serialized,
              name: contact.pushname || contact.name || "Unknown",
              timestamp: msg.timestamp,
              message_body: msg.body,
              message_ack: msg.ack || "PENDING",
              is_from_me: true,
            },
          };

          await this.sendToWebhook(webhookData);
        } catch (error) {
          console.error(`❌ [${this.deviceId}] Error processing outgoing webhook:`, error.message);
        }
      }
    });
  }

  shouldCleanup() {
    if (!this.lastCleanup) return true;
    
    const cleanupInterval = this.config.cleanup_interval || 24; // hours
    const lastCleanupTime = new Date(this.lastCleanup).getTime();
    const now = Date.now();
    const hoursSinceLastCleanup = (now - lastCleanupTime) / (1000 * 60 * 60);
    
    return hoursSinceLastCleanup >= cleanupInterval;
  }

  async handleCommands(msg) {
    try {
      const command = msg.body.toLowerCase();
      const chat = await msg.getChat();

      switch (command) {
        case "!info":
          const sessionSize = await this.getSessionSize();
          await chat.sendMessage(`🤖 Device Info:
📱 Device ID: ${this.deviceId}
📋 Device Name: ${this.config.device_name}
📞 Number: ${this.client.info.wid.user}
🔋 Battery: ${this.client.info.battery}%
📡 Status: Connected
🔗 Webhook: ${this.config.webhook_url ? "Active" : "Not Set"}
💾 Session Size: ${sessionSize}
🧹 Last Cleanup: ${this.lastCleanup || "Never"}`);
          break;

        case "!cleanup":
          await chat.sendMessage(`🧹 Starting session cleanup...`);
          try {
            const result = await this.cleanupSession();
            await chat.sendMessage(`✅ Cleanup completed!\n💾 Saved: ${result.saved_space}\n📊 Before: ${result.size_before} → After: ${result.size_after}`);
          } catch (error) {
            await chat.sendMessage(`❌ Cleanup failed: ${error.message}`);
          }
          break;

        case "!size":
          const size = await this.getSessionSize();
          await chat.sendMessage(`📊 Current session size: ${size}`);
          break;

        case "!test":
          await msg.reply(`🤖 [${this.config.device_name}] Test berhasil!`);
          break;

        case "!ping":
          await this.sendMessage(msg.from, `🏓 [${this.config.device_name}] Pong!`);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error handling commands:`, error.message);
    }
  }

  async logout() {
    try {
      this.isClientReady = false;
      if (this.client) {
        await this.client.destroy();
      }

      // Cleanup session before deleting
      await this.cleanupSession();

      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        console.log(`🗑️ [${this.deviceId}] Session folder deleted`);
      }

      setTimeout(() => {
        this.client.initialize();
      }, 1000);

      return true;
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error during logout:`, error.message);
      throw error;
    }
  }

  async getStatus() {
    const sessionSize = await this.getSessionSize();
    
    return {
      device_id: this.deviceId,
      device_name: this.config.device_name,
      is_ready: this.isClientReady,
      has_qr: !!this.currentQR,
      number: this.isClientReady && this.client.info ? this.client.info.wid.user : null,
      battery: this.isClientReady && this.client.info ? this.client.info.battery : null,
      webhook_url: this.config.webhook_url,
      session_size: sessionSize,
      last_cleanup: this.lastCleanup,
      cleanup_interval: this.config.cleanup_interval,
      config: this.config
    };
  }
}

// Helper functions
function getClient(deviceId) {
  return clients.get(deviceId);
}

async function getAllClients() {
  const result = [];
  for (const [deviceId, manager] of clients.entries()) {
    result.push(await manager.getStatus());
  }
  return result;
}

// Load existing devices saat startup
function loadExistingDevices() {
  try {
    const configFiles = fs.readdirSync(CONFIG_DIR).filter(file => file.endsWith('.json'));
    console.log(`📁 Ditemukan ${configFiles.length} device yang tersimpan`);

    configFiles.forEach(file => {
      const deviceId = file.replace('.json', '');
      const configPath = path.join(CONFIG_DIR, file);

      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`🔄 Loading device: ${deviceId}`);

        const manager = new WhatsAppManager(deviceId, config);
        clients.set(deviceId, manager);
      } catch (error) {
        console.error(`❌ Error loading device ${deviceId}:`, error.message);
      }
    });
  } catch (error) {
    console.error('❌ Error loading existing devices:', error.message);
  }
}

// Scheduled cleanup every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('🧹 Starting scheduled cleanup...');
  await SessionCleaner.cleanupOldSessions();
});

// Middleware untuk validasi device_id dan apikey
const validateRequest = (req, res, next) => {
  const { device_id, apikey } = req.body;

  if (!device_id) {
    return res.status(400).json({
      status: "error",
      message: "Parameter 'device_id' wajib disertakan dalam body request."
    });
  }

  if (!apikey) {
    return res.status(401).json({
      status: "error",
      message: "Parameter 'apikey' wajib disertakan dalam body request."
    });
  }

  if (apikey !== GLOBAL_API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "API Key tidak valid."
    });
  }

  req.params.deviceId = device_id;
  next();
};

// API Routes - keeping the same structure but adding cleanup endpoints

// Create new device
app.post("/api/devices", (req, res) => {
  const { device_name, webhook_url, auto_reply, cleanup_interval, apikey } = req.body;

  if (!apikey || apikey !== GLOBAL_API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "API Key tidak valid."
    });
  }

  const deviceId = uuidv4();

  try {
    const config = {
      device_name: device_name || `Device-${deviceId}`,
      webhook_url: webhook_url || null,
      auto_reply: auto_reply || false,
      cleanup_interval: cleanup_interval || 24 // hours
    };

    const manager = new WhatsAppManager(deviceId, config);
    clients.set(deviceId, manager);

    res.json({
      status: "success",
      message: "Device berhasil dibuat",
      device: manager.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal membuat device",
      error: error.message
    });
  }
});

// Get all devices
app.get("/api/devices", async (req, res) => {
  try {
    const devices = await getAllClients();
    res.json({
      status: "success",
      devices: devices,
      total: clients.size
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengambil daftar device",
      error: error.message
    });
  }
});

// NEW: Cleanup specific device session
app.post("/api/device/cleanup", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    const result = await manager.cleanupSession();
    res.json({
      status: "success",
      message: "Session cleanup berhasil",
      cleanup_result: result
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal melakukan cleanup",
      error: error.message
    });
  }
});

// NEW: Get session size for specific device
app.get("/api/device/size", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    const size = await manager.getSessionSize();
    res.json({
      status: "success",
      device_id: deviceId,
      session_size: size,
      last_cleanup: manager.lastCleanup
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengambil ukuran session",
      error: error.message
    });
  }
});

// NEW: Global cleanup for all sessions
app.post("/api/cleanup-all", async (req, res) => {
  const { apikey } = req.body;

  if (!apikey || apikey !== GLOBAL_API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "API Key tidak valid."
    });
  }

  try {
    await SessionCleaner.cleanupOldSessions();
    
    const results = [];
    for (const [deviceId, manager] of clients.entries()) {
      try {
        const result = await manager.cleanupSession();
        results.push({
          device_id: deviceId,
          ...result
        });
      } catch (error) {
        results.push({
          device_id: deviceId,
          error: error.message
        });
      }
    }

    res.json({
      status: "success",
      message: "Global cleanup completed",
      results: results
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal melakukan global cleanup",
      error: error.message
    });
  }
});

// NEW: Get total sessions directory size
app.get("/api/sessions/size", async (req, res) => {
  const { apikey } = req.query;

  if (!apikey || apikey !== GLOBAL_API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "API Key tidak valid."
    });
  }

  try {
    const totalSize = await SessionCleaner.getDirectorySize(SESSIONS_DIR);
    const sessionDirs = fs.readdirSync(SESSIONS_DIR);
    
    const sessionSizes = [];
    for (const sessionDir of sessionDirs) {
      const sessionPath = path.join(SESSIONS_DIR, sessionDir);
      const size = await SessionCleaner.getDirectorySize(sessionPath);
      sessionSizes.push({
        session: sessionDir,
        size: SessionCleaner.formatBytes(size),
        size_bytes: size
      });
    }

    res.json({
      status: "success",
      total_size: SessionCleaner.formatBytes(totalSize),
      total_size_bytes: totalSize,
      session_count: sessionDirs.length,
      sessions: sessionSizes
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengambil ukuran sessions",
      error: error.message
    });
  }
});

// Existing routes with minor updates...
app.get("/api/device", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    const deviceStatus = await manager.getStatus();
    res.json({
      status: "success",
      device: deviceStatus
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengambil status device",
      error: error.message
    });
  }
});

app.put("/api/device", validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    const { device_name, webhook_url, auto_reply, cleanup_interval } = req.body;

    if (device_name !== undefined) manager.config.device_name = device_name;
    if (webhook_url !== undefined) manager.config.webhook_url = webhook_url;
    if (auto_reply !== undefined) manager.config.auto_reply = auto_reply;
    if (cleanup_interval !== undefined) manager.config.cleanup_interval = cleanup_interval;

    manager.saveConfig();

    res.json({
      status: "success",
      message: "Konfigurasi device berhasil diupdate",
      device: manager.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengupdate device",
      error: error.message
    });
  }
});

app.delete("/api/device", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    await manager.logout();
    clients.delete(deviceId);

    // Hapus config file
    if (fs.existsSync(manager.configFile)) {
      fs.unlinkSync(manager.configFile);
    }

    res.json({
      status: "success",
      message: "Device berhasil dihapus"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal menghapus device",
      error: error.message
    });
  }
});

app.post("/api/device/qr", validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  if (!manager.currentQR) {
    return res.status(404).json({
      status: "error",
      message: "QR Code tidak tersedia. Device mungkin sudah terautentikasi."
    });
  }

  res.json({
    status: "success",
    qr_code: manager.currentQR,
    message: "Scan QR code ini di WhatsApp"
  });
});

app.post("/api/device/send-message", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const { number, message } = req.body;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  if (!manager.isClientReady) {
    return res.status(503).json({
      status: "error",
      message: "Device belum siap. Tunggu hingga status ready."
    });
  }

  if (!number || !message) {
    return res.status(400).json({
      status: "error",
      message: "Parameter 'number' dan 'message' wajib diisi"
    });
  }

  try {
    await manager.sendMessage(number, message);
    res.json({
      status: "success",
      message: "Pesan berhasil dikirim",
      to: number.includes("@c.us") ? number : `${number}@c.us`,
      device_id: deviceId
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengirim pesan",
      error: error.message
    });
  }
});

app.post("/api/device/logout", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    await manager.logout();
    res.json({
      status: "success",
      message: "Logout berhasil. Menunggu QR baru..."
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal logout",
      error: error.message
    });
  }
});

app.post("/api/device/test-webhook", validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  if (!manager.config.webhook_url) {
    return res.status(400).json({
      status: "error",
      message: "Webhook belum diset untuk device ini"
    });
  }

  const testData = {
    type: "test_webhook",
    data: {
      chat_id: "6282325339189",
      message_id: "TEST_MESSAGE_" + Date.now(),
      name: "Test User",
      profile_picture: "",
      timestamp: Math.floor(Date.now() / 1000),
      message_body: "Test message from " + manager.config.device_name,
      message_ack: "SENT",
      has_media: false,
      media_mime: "",
      media_name: "",
      location_attached: { lat: null, lng: null },
      is_forwarding: false,
      is_from_me: false,
    },
  };

  try {
    await manager.sendToWebhook(testData);
    res.json({
      status: "success",
      message: "Test webhook berhasil dikirim",
      webhook_url: manager.config.webhook_url,
      test_data: testData
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Test webhook gagal",
      error: error.message
    });
  }
});

// Global status and Health check
app.get("/api/status", async (req, res) => {
  try {
    const devices = await getAllClients();
    const readyDevices = devices.filter(d => d.is_ready).length;
    const totalSessionSize = await SessionCleaner.getDirectorySize(SESSIONS_DIR);

    res.json({
      status: "success",
      total_devices: devices.length,
      ready_devices: readyDevices,
      pending_devices: devices.length - readyDevices,
      total_session_size: SessionCleaner.formatBytes(totalSessionSize),
      devices: devices
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Gagal mengambil status",
      error: error.message
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const totalSessionSize = await SessionCleaner.getDirectorySize(SESSIONS_DIR);
    
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      session_size: SessionCleaner.formatBytes(totalSessionSize),
      active_devices: clients.size
    });
  } catch (error) {
    res.json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Backward compatibility endpoints
app.get("/get_qr", validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan. Buat device baru atau cek /api/devices"
    });
  }

  if (!manager.currentQR) {
    return res.status(404).json({
      status: "error",
      message: "QR Code tidak tersedia. Device mungkin sudah terautentikasi."
    });
  }

  res.json({
    status: "success",
    qr_code: manager.currentQR,
    message: "Scan QR code ini di WhatsApp (Compatibility mode)"
  });
});

app.post("/send-message", validateRequest, async (req, res) => {
  const { number, message } = req.body;
  const { deviceId } = req.params;
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan."
    });
  }

  if (!manager.isClientReady) {
    return res.status(503).json({
      status: "error",
      message: "Device belum siap"
    });
  }

  try {
    await manager.sendMessage(number, message);
    res.json({
      status: "success",
      message: "Pesan berhasil dikirim (Compatibility mode)"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    error: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint tidak ditemukan",
    available_endpoints: [
      "GET /api/devices - List all devices",
      "POST /api/devices - Create new device",
      "GET /api/device - Get device info",
      "PUT /api/device - Update device config",
      "DELETE /api/device - Delete device",
      "POST /api/device/qr - Get QR code",
      "POST /api/device/send-message - Send message",
      "POST /api/device/logout - Logout device",
      "POST /api/device/test-webhook - Test webhook",
      "POST /api/device/cleanup - Cleanup device session",
      "GET /api/device/size - Get device session size",
      "POST /api/cleanup-all - Global cleanup all sessions",
      "GET /api/sessions/size - Get total sessions size",
      "GET /api/status - Global status",
      "GET /api/health - Health check"
    ]
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  try {
    for (const [deviceId, manager] of clients) {
      console.log(`🛑 Shutting down device: ${deviceId}`);
      if (manager.client) {
        await manager.client.destroy();
      }
    }
  } catch (error) {
    console.error("Error during shutdown:", error.message);
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 4001;

// Load existing devices before starting
loadExistingDevices();

app.listen(PORT, () => {
  console.log(`🌐 Multi-Device WhatsApp Bot API berjalan di http://localhost:${PORT}`);
  console.log("📋 API Endpoints:");
  console.log("  GET  /api/devices              - List all devices");
  console.log("  POST /api/devices              - Create new device");
  console.log("  GET  /api/device               - Get device info");
  console.log("  PUT  /api/device               - Update device config");
  console.log("  DELETE /api/device             - Delete device");
  console.log("  POST /api/device/qr            - Get QR code");
  console.log("  POST /api/device/send-message  - Send message");
  console.log("  POST /api/device/logout        - Logout device");
  console.log("  POST /api/device/test-webhook  - Test webhook");
  console.log("  POST /api/device/cleanup       - Cleanup device session");
  console.log("  GET  /api/device/size          - Get device session size");
  console.log("  POST /api/cleanup-all          - Global cleanup all sessions");
  console.log("  GET  /api/sessions/size        - Get total sessions size");
  console.log("  GET  /api/status               - Global status");
  console.log("  GET  /api/health               - Health check");
  console.log("🧹 Scheduled cleanup: Every 6 hours");
  console.log("📁 Config directory: " + path.resolve(CONFIG_DIR));
  console.log("📁 Sessions directory: " + path.resolve(SESSIONS_DIR));
  console.log(`📱 Loaded ${clients.size} existing devices`);
  console.log(`🔑 Global API Key: ${GLOBAL_API_KEY} (CHANGE THIS IN PRODUCTION!)`);
  
  // Show initial session sizes
  setTimeout(async () => {
    try {
      const totalSize = await SessionCleaner.getDirectorySize(SESSIONS_DIR);
      console.log(`💾 Total sessions size: ${SessionCleaner.formatBytes(totalSize)}`);
    } catch (error) {
      console.error("Error getting initial session size:", error.message);
    }
  }, 2000);
});