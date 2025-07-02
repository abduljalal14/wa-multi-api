const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Ini juga izinkan semua origin
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

// Global API Key (gunakan environment variable di produksi)
const GLOBAL_API_KEY = process.env.API_KEY || "YOUR_SUPER_SECRET_API_KEY"; // GANTI INI DENGAN KEY YANG LEBIH KUAT DAN GUNAKAN ENV VAR!

// Class untuk mengelola WhatsApp Client
class WhatsAppManager {
  constructor(deviceId, config = {}) {
    this.deviceId = deviceId;
    this.config = {
      webhook_url: config.webhook_url || null,
      device_name: config.device_name || `Device-${deviceId}`,
      auto_reply: config.auto_reply || false,
      ...config
    };
    this.currentQR = null;
    this.isClientReady = false;
    this.client = null;
    this.configFile = path.join(CONFIG_DIR, `${deviceId}.json`);

    this.loadConfig();
    this.initializeClient();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const savedConfig = JSON.parse(fs.readFileSync(this.configFile, "utf8"));
        this.config = { ...this.config, ...savedConfig };
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
        version: "2.0.0",
        device_id: this.deviceId
      };
      fs.writeFileSync(this.configFile, JSON.stringify(configToSave, null, 2));
      console.log(`💾 [${this.deviceId}] Konfigurasi disimpan`);
    } catch (error) {
      console.error(`❌ [${this.deviceId}] Error saving config:`, error.message);
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
      console.log(`📡 Response:`, response.data);
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

    this.client.on("ready", () => {
      console.log(`🚀 [${this.deviceId}] WhatsApp Bot siap digunakan!`);
      console.log(`📱 [${this.deviceId}] Nomor bot:`, this.client.info.wid.user);
      this.isClientReady = true;
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

  async handleCommands(msg) {
    try {
      const command = msg.body.toLowerCase();
      const chat = await msg.getChat();

      switch (command) {
        case "!info":
          await chat.sendMessage(`🤖 Device Info:
📱 Device ID: ${this.deviceId}
📋 Device Name: ${this.config.device_name}
📞 Number: ${this.client.info.wid.user}
🔋 Battery: ${this.client.info.battery}%
📡 Status: Connected
🔗 Webhook: ${this.config.webhook_url ? "Active" : "Not Set"}`);
          break;

        case "!test":
          await msg.reply(`🤖 [${this.config.device_name}] Test berhasil!`);
          break;

        case "!ping":
          await this.sendMessage(msg.from, `🏓 [${this.config.device_name}] Pong!`);
          break;

        default:
          // Handle other commands if needed
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

      const sessionPath = path.join(SESSIONS_DIR, `session-${this.deviceId}`);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
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

  getStatus() {
    return {
      device_id: this.deviceId,
      device_name: this.config.device_name,
      is_ready: this.isClientReady,
      has_qr: !!this.currentQR,
      number: this.isClientReady && this.client.info ? this.client.info.wid.user : null,
      battery: this.isClientReady && this.client.info ? this.client.info.battery : null,
      webhook_url: this.config.webhook_url,
      config: this.config
    };
  }
}

// Helper functions
function getClient(deviceId) {
  return clients.get(deviceId);
}

function getAllClients() {
  const result = [];
  for (const [deviceId, manager] of clients.entries()) {
    result.push(manager.getStatus());
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

  // Set deviceId dari body ke params untuk konsistensi di handler route
  // Ini penting karena handler route masih mungkin mengakses req.params.deviceId
  req.params.deviceId = device_id;

  next(); // Lanjutkan ke handler route
};

// API Routes

// Create new device (no device_id in body required, it's generated) - ONLY check apikey
app.post("/api/devices", (req, res) => {
  const { device_name, webhook_url, auto_reply, apikey } = req.body;

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
      auto_reply: auto_reply || false
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

// Get all devices (No specific device_id required, but an apikey might be desired for security)
app.get("/api/devices", (req, res) => {
  // You might want to add an API key check here too, but it's not tied to a specific device.
  // For simplicity, I'm omitting a body-based API key check for GET /api/devices
  // If you want it, you'd add a separate middleware for global API key validation.
  res.json({
    status: "success",
    devices: getAllClients(),
    total: clients.size
  });
});

// Routes now solely rely on device_id from body
app.get("/api/device", validateRequest, (req, res) => {
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  res.json({
    status: "success",
    device: manager.getStatus()
  });
});

app.put("/api/device", validateRequest, (req, res) => {
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
  const manager = getClient(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device tidak ditemukan"
    });
  }

  try {
    const { device_name, webhook_url, auto_reply } = req.body;

    if (device_name !== undefined) manager.config.device_name = device_name;
    if (webhook_url !== undefined) manager.config.webhook_url = webhook_url;
    if (auto_reply !== undefined) manager.config.auto_reply = auto_reply;

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
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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

app.get("/api/device/qr", validateRequest, (req, res) => {
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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

// Global status and Health check - These typically don't require device_id or apikey in the body,
// but you might enforce a global API key for them if desired.
// For now, they remain open for ease of monitoring.
app.get("/api/status", (req, res) => {
  const devices = getAllClients();
  const readyDevices = devices.filter(d => d.is_ready).length;

  res.json({
    status: "success",
    total_devices: devices.length,
    ready_devices: readyDevices,
    pending_devices: devices.length - readyDevices,
    devices: devices
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Backward compatibility endpoints (untuk compatibility dengan kode lama)
// These will also now require device_id and apikey in the body for consistency.
app.get("/get_qr", validateRequest, (req, res) => {
  const { deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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
  const { number, message, deviceId } = req.params; // deviceId is set from req.body.device_id by validateRequest
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
      "GET /api/device - Get device info (using device_id in body)",
      "PUT /api/device - Update device config (using device_id in body)",
      "DELETE /api/device - Delete device (using device_id in body)",
      "GET /api/device/qr - Get QR code (using device_id in body)",
      "POST /api/device/send-message - Send message (using device_id in body)",
      "POST /api/device/logout - Logout device (using device_id in body)",
      "POST /api/device/test-webhook - Test webhook (using device_id in body)",
      "GET /api/status - Global status",
      "GET /api/health - Health check",
      "GET /get_qr - Backward compatibility for QR (using device_id in body)",
      "POST /send-message - Backward compatibility for send message (using device_id in body)"
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
  console.log("📋 New API Endpoints:");
  console.log("  GET  /api/devices           - List all devices");
  console.log("  POST /api/devices           - Create new device");
  console.log("  GET  /api/device            - Get device info (requires device_id in body)");
  console.log("  PUT  /api/device            - Update device config (requires device_id in body)");
  console.log("  DELETE /api/device          - Delete device (requires device_id in body)");
  console.log("  GET  /api/device/qr         - Get QR code (requires device_id in body)");
  console.log("  POST /api/device/send-message - Send message (requires device_id in body)");
  console.log("  POST /api/device/logout     - Logout device (requires device_id in body)");
  console.log("  POST /api/device/test-webhook - Test webhook (requires device_id in body)");
  console.log("  GET  /api/status            - Global status");
  console.log("  GET  /api/health            - Health check");
  console.log("📁 Config directory: " + path.resolve(CONFIG_DIR));
  console.log("📁 Sessions directory: " + path.resolve(SESSIONS_DIR));
  console.log(`📱 Loaded ${clients.size} existing devices`);
  console.log(`🔑 Global API Key (for testing): ${GLOBAL_API_KEY} (CHANGE THIS IN PRODUCTION!)`);
});