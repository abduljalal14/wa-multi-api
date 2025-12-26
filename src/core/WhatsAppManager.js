const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

const Logger = require('../utils/logger.utils');
const FileUtils = require('../utils/file.utils');
const MessageService = require('../services/message.service');
const WebhookService = require('../services/webhook.service');
const { PUPPETEER_ARGS, BOT_COMMANDS, RECONNECT_DELAY, REINIT_DELAY } = require('../config/constants');
const { CONFIG_DIR, SESSIONS_DIR } = require('../config/environment');

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
    this.isDeleted = false; // Flag untuk menandai device sudah dihapus
    this.reconnectTimeout = null; // Store timeout reference

    this.loadConfig();
    this.initializeClient();
  }

  loadConfig() {
    try {
      const savedConfig = FileUtils.loadJSON(this.configFile);
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
        Logger.info(this.deviceId, 'Configuration loaded from file');
      } else {
        this.saveConfig();
      }
    } catch (error) {
      Logger.error(this.deviceId, 'Error loading config:', error.message);
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
      FileUtils.saveJSON(this.configFile, configToSave);
      Logger.info(this.deviceId, 'Configuration saved');
    } catch (error) {
      Logger.error(this.deviceId, 'Error saving config:', error.message);
    }
  }

  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  async sendToWebhook(webhookData) {
    if (!this.config.webhook_url) return;

    try {
      await WebhookService.sendWebhook(
        this.deviceId,
        this.config.device_name,
        this.config.webhook_url,
        webhookData
      );
    } catch (error) {
      Logger.error(this.deviceId, 'Error sending webhook:', error.message);
    }
  }

  async sendMessage(chatId, message) {
    this.ensureClientReady();
    return MessageService.sendTextMessage(this.client, this.deviceId, chatId, message);
  }

  async sendImage(chatId, image, caption = '') {
    this.ensureClientReady();
    return MessageService.sendImageMessage(this.client, this.deviceId, chatId, image, caption);
  }

  async sendDocument(chatId, document, filename = '', caption = '') {
    this.ensureClientReady();
    return MessageService.sendDocumentMessage(this.client, this.deviceId, chatId, document, filename, caption);
  }

  ensureClientReady() {
    if (!this.isClientReady || !this.client) {
      throw new Error('Client is not ready');
    }
  }

  initializeClient() {
    // Jangan initialize jika device sudah dihapus
    if (this.isDeleted) {
      Logger.warn(this.deviceId, 'Device is deleted, skipping initialization');
      return;
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: this.deviceId,
        dataPath: SESSIONS_DIR,
      }),
      puppeteer: {
        headless: true,
        args: PUPPETEER_ARGS,
      },
    });

    this.setupClientEvents();
    this.client.initialize();
  }

  setupClientEvents() {
    this.client.on("qr", (qr) => {
      // Jangan tampilkan QR jika device sudah dihapus
      if (this.isDeleted) {
        Logger.warn(this.deviceId, 'Device is deleted, ignoring QR');
        return;
      }

      Logger.log(this.deviceId, '=== SCAN THIS QR CODE IN WHATSAPP ===');
      qrcode.generate(qr, { small: true });
      this.currentQR = qr;
      this.isClientReady = false;
    });

    this.client.on("authenticated", () => {
      if (this.isDeleted) return;
      
      Logger.success(this.deviceId, 'Authentication successful!');
      this.currentQR = null;
    });

    this.client.on("ready", () => {
      if (this.isDeleted) return;

      Logger.success(this.deviceId, 'WhatsApp Bot is ready!');
      Logger.info(this.deviceId, 'Bot number:', this.client.info.wid.user);
      this.isClientReady = true;
    });

    this.client.on("disconnected", async (reason) => {
      if (this.isDeleted) {
        Logger.info(this.deviceId, 'Device deleted, not reconnecting');
        return;
      }

      Logger.warn(this.deviceId, 'WhatsApp disconnected:', reason);
      this.isClientReady = false;
      
      try {
        await this.client.destroy();
        Logger.success(this.deviceId, 'Client destroyed successfully');
      } catch (error) {
        Logger.error(this.deviceId, 'Error destroying client:', error.message);
      }

      if (reason === "LOGOUT") {
        Logger.info(this.deviceId, 'Session deleted due to manual logout');
      }

      // Clear timeout lama jika ada
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      // Hanya reconnect jika device belum dihapus
      if (!this.isDeleted) {
        this.reconnectTimeout = setTimeout(() => {
          Logger.info(this.deviceId, 'Re-initializing client...');
          this.client.initialize();
        }, RECONNECT_DELAY);
      }
    });

    this.client.on("auth_failure", (msg) => {
      if (this.isDeleted) return;

      Logger.error(this.deviceId, 'Authentication failed:', msg);
      this.isClientReady = false;
    });

    this.client.on("message", async (msg) => {
      if (this.isDeleted) return;
      await this.handleIncomingMessage(msg);
    });

    this.client.on("message_create", async (msg) => {
      if (this.isDeleted) return;
      await this.handleOutgoingMessage(msg);
    });
  }

  async handleIncomingMessage(msg) {
    if (msg.isStatus) return;

    Logger.info(this.deviceId, `Message received: ${msg.from} => ${msg.body}`);

    if (this.config.webhook_url) {
      try {
        const { contactName, profilePicture } = await MessageService.extractContactInfo(msg, this.deviceId);
        const webhookData = WebhookService.buildIncomingMessagePayload(msg, contactName, profilePicture);
        await this.sendToWebhook(webhookData);
      } catch (error) {
        Logger.error(this.deviceId, 'Error processing webhook:', error.message);
      }
    }

    if (this.config.auto_reply && msg.body.toLowerCase().includes('ping')) {
      try {
        await msg.reply(`🤖 [${this.config.device_name}] Pong! Auto reply from device ${this.deviceId}`);
      } catch (error) {
        Logger.error(this.deviceId, 'Error auto reply:', error.message);
      }
    }

    await this.handleCommands(msg);
  }

  async handleOutgoingMessage(msg) {
    if (msg.fromMe && this.config.webhook_url) {
      try {
        let contactName = "Unknown";
        
        if (msg._data && msg._data.to) {
          contactName = msg._data.to.split('@')[0];
        }
        
        try {
          const contact = await msg.getContact();
          if (contact && (contact.pushname || contact.name)) {
            contactName = contact.pushname || contact.name;
          }
        } catch (err) {
          // Use fallback
        }

        const webhookData = WebhookService.buildOutgoingMessagePayload(msg, contactName);
        await this.sendToWebhook(webhookData);
      } catch (error) {
        Logger.error(this.deviceId, 'Error processing outgoing webhook:', error.message);
      }
    }
  }

  async handleCommands(msg) {
    try {
      const command = msg.body.toLowerCase();
      const chat = await msg.getChat();

      switch (command) {
        case BOT_COMMANDS.INFO:
          await chat.sendMessage(`🤖 Device Info:
📱 Device ID: ${this.deviceId}
📋 Device Name: ${this.config.device_name}
📞 Number: ${this.client.info.wid.user}
🔋 Battery: ${this.client.info.battery}%
📡 Status: Connected
🔗 Webhook: ${this.config.webhook_url ? "Active" : "Not Set"}`);
          break;

        case BOT_COMMANDS.TEST:
          await msg.reply(`🤖 [${this.config.device_name}] Test successful!`);
          break;

        case BOT_COMMANDS.PING:
          await this.sendMessage(msg.from, `🏓 [${this.config.device_name}] Pong!`);
          break;

        default:
          break;
      }
    } catch (error) {
      Logger.error(this.deviceId, 'Error handling commands:', error.message);
    }
  }

  async logout() {
    try {
      this.isClientReady = false;
      
      if (this.client) {
        await this.client.destroy();
      }

      const sessionPath = path.join(SESSIONS_DIR, `session-${this.deviceId}`);
      FileUtils.deleteDirectory(sessionPath);
      Logger.info(this.deviceId, 'Session folder deleted');

      // Clear timeout jika ada
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      setTimeout(() => {
        this.client.initialize();
      }, REINIT_DELAY);

      return true;
    } catch (error) {
      Logger.error(this.deviceId, 'Error during logout:', error.message);
      throw error;
    }
  }

  /**
   * Destroy device completely without re-initialization
   * Digunakan saat device dihapus melalui endpoint
   */
  async destroy() {
    try {
      Logger.info(this.deviceId, 'Destroying device permanently...');
      
      // Set flag bahwa device sudah dihapus
      this.isDeleted = true;
      this.isClientReady = false;
      this.currentQR = null;

      // Clear semua timeout yang ada
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Destroy client jika ada
      if (this.client) {
        try {
          await this.client.destroy();
          Logger.success(this.deviceId, 'Client destroyed successfully');
        } catch (error) {
          Logger.warn(this.deviceId, 'Error destroying client:', error.message);
        }
        this.client = null;
      }

      // Hapus session folder
      const sessionPath = path.join(SESSIONS_DIR, `session-${this.deviceId}`);
      FileUtils.deleteDirectory(sessionPath);
      Logger.success(this.deviceId, 'Session folder deleted');

      // Hapus config file
      if (FileUtils.deleteFile(this.configFile)) {
        Logger.success(this.deviceId, 'Config file deleted');
      }

      Logger.success(this.deviceId, 'Device destroyed permanently');
      return true;
    } catch (error) {
      Logger.error(this.deviceId, 'Error during destroy:', error.message);
      throw error;
    }
  }

  getStatus() {
    return {
      device_id: this.deviceId,
      device_name: this.config.device_name,
      is_ready: this.isClientReady,
      is_deleted: this.isDeleted,
      has_qr: !!this.currentQR && !this.isDeleted,
      number: this.isClientReady && this.client.info ? this.client.info.wid.user : null,
      battery: this.isClientReady && this.client.info ? this.client.info.battery : null,
      webhook_url: this.config.webhook_url,
      config: this.config
    };
  }
}

module.exports = WhatsAppManager;