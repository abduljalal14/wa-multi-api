const { MessageMedia } = require('whatsapp-web.js');
const DownloadUtils = require('../utils/download.utils');
const Logger = require('../utils/logger.utils');
const { MESSAGE_DELAY } = require('../config/constants');

class MessageService {
  static formatChatId(chatId) {
    return chatId.includes("@c.us") ? chatId : `${chatId}@c.us`;
  }

  static async sendTextMessage(client, deviceId, chatId, message) {
    try {
      const formattedChatId = this.formatChatId(chatId);
      
      // Hitung delay berdasarkan panjang pesan (typing speed simulation)
      // Misal: tiap karakter butuh 50ms, ditambah jeda acak dasar
      const typingSpeed = message.length * 50; 
      const randomBase = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)) + MIN_DELAY;
      
      // Total delay tidak boleh terlalu ekstrem, kita batasi maksimal 12 detik
      const totalDelay = Math.min(typingSpeed + randomBase, 12000);

      Logger.info(deviceId, `Simulating human delay: ${totalDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
      
      const result = await client.sendMessage(formattedChatId, message);
      
      Logger.success(deviceId, `Message sent to: ${formattedChatId}`);
      return result;
    } catch (error) {
      Logger.error(deviceId, `Failed to send message to ${chatId}:`, error.message);
      throw error;
    }
  }

  static async sendImageMessage(client, deviceId, chatId, image, caption = '') {
    try {
      const formattedChatId = this.formatChatId(chatId);
      const media = await this.prepareImageMedia(image);

      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));
      
      const result = await client.sendMessage(formattedChatId, media, { caption });
      
      Logger.success(deviceId, `Image sent to: ${formattedChatId}`);
      
      return result;
    } catch (error) {
      Logger.error(deviceId, 'Failed to send image:', error.message);
      throw error;
    }
  }

  static async sendDocumentMessage(client, deviceId, chatId, document, filename = '', caption = '') {
    try {
      const formattedChatId = this.formatChatId(chatId);
      const media = await this.prepareDocumentMedia(document, filename);

      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY));
      
      const result = await client.sendMessage(formattedChatId, media, { 
        caption,
        sendMediaAsDocument: true 
      });
      
      Logger.success(deviceId, `Document sent to: ${formattedChatId}`);
      
      return result;
    } catch (error) {
      Logger.error(deviceId, 'Failed to send document:', error.message);
      throw error;
    }
  }

  static async prepareImageMedia(image) {
    if (DownloadUtils.isValidURL(image)) {
      const { buffer, mimeType } = await DownloadUtils.downloadImage(image);
      return new MessageMedia(mimeType, buffer.toString('base64'), `image-${Date.now()}`);
    }
    
    if (DownloadUtils.isBase64(image)) {
      const { mimeType, data } = DownloadUtils.parseBase64(image);
      return new MessageMedia(mimeType, data, `image-${Date.now()}`);
    }
    
    throw new Error('Invalid image format. Use URL or base64.');
  }

  static async prepareDocumentMedia(document, filename) {
    let mimeType, buffer;

    if (DownloadUtils.isValidURL(document)) {
      const downloaded = await DownloadUtils.downloadFile(document);
      buffer = downloaded.buffer;
      mimeType = downloaded.mimeType;
    } else if (DownloadUtils.isBase64(document)) {
      const parsed = DownloadUtils.parseBase64(document);
      mimeType = parsed.mimeType;
      buffer = Buffer.from(parsed.data, 'base64');
    } else {
      throw new Error('Invalid document format. Use URL or base64.');
    }

    const docFilename = filename || `document-${Date.now()}.${DownloadUtils.getExtensionFromMime(mimeType)}`;
    return new MessageMedia(mimeType, buffer.toString('base64'), docFilename);
  }

  static async extractContactInfo(msg, deviceId) {
    let contactName = "Unknown";
    let profilePicture = "";

    // Extract name from message data
    if (msg._data && msg._data.notifyName) {
      contactName = msg._data.notifyName;
    } else if (msg._data && msg._data.from) {
      contactName = msg._data.from.split('@')[0];
    }

    // Try to get contact info
    try {
      const contact = await msg.getContact();
      if (contact) {
        if (contact.pushname) contactName = contact.pushname;
        else if (contact.name) contactName = contact.name;

        try {
          profilePicture = await contact.getProfilePicUrl();
        } catch (picErr) {
          // Ignore profile picture error
        }
      }
    } catch (err) {
      Logger.warn(deviceId, 'Using fallback data for contact');
    }

    return { contactName, profilePicture };
  }
}

module.exports = MessageService;