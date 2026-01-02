const { MessageMedia } = require('whatsapp-web.js');
const DownloadUtils = require('../utils/download.utils');
const Logger = require('../utils/logger.utils');
const { MESSAGE_DELAY, MAX_DELAY, MIN_DELAY } = require('../config/constants');

class MessageService {
  static formatChatId(chatId) {
    // Check if chatId already has a valid format suffix
    if (chatId.includes("@c.us") || chatId.includes("@g.us") || chatId.includes("@lid") || chatId.includes("@")) {
      return chatId; // Already has correct format
    }
    // Add @c.us for single chat if no format exists
    return `${chatId}@c.us`;
  }

  static async sendTextMessage(client, deviceId, chatId, message, maxRetries = 2) {
    const MAX_RETRIES = maxRetries;
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const formattedChatId = this.formatChatId(chatId);
        
        // Sanitasi pesan untuk menghindari karakter yang bermasalah
        const sanitizedMessage = this.sanitizeMessage(message);
        
        Logger.info(deviceId, `Sending message attempt ${attempt + 1}/${MAX_RETRIES} to: ${formattedChatId}`);
        
        let result;
        
        // Coba dengan chat object untuk typing state, jika gagal langsung send
        try {
          const chat = await client.getChatById(formattedChatId);
          
          // Tampilkan status "Sedang Mengetik"
          try {
            await chat.sendStateTyping();
          } catch (typeErr) {
            Logger.warn(deviceId, 'Could not send typing state:', typeErr.message);
          }

          // Hitung delay manusiawi berdasarkan panjang pesan
          const typingSpeed = sanitizedMessage.length * 50; 
          const randomBase = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)) + MIN_DELAY;
          const totalDelay = Math.min(typingSpeed + randomBase, 10000);

          Logger.info(deviceId, `Typing simulation: ${totalDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, totalDelay));
          
          // Kirim pesan
          result = await client.sendMessage(formattedChatId, sanitizedMessage);
          
          // Hentikan status mengetik
          try {
            await chat.clearState();
          } catch (clearErr) {
            // Ignore
          }
          
          Logger.success(deviceId, `Message sent to: ${formattedChatId}`);
        } catch (chatError) {
          // Fallback: kirim langsung tanpa chat object
          Logger.warn(deviceId, 'Chat object failed, sending directly:', chatError.message);
          result = await client.sendMessage(formattedChatId, sanitizedMessage);
          Logger.success(deviceId, `Message sent (direct) to: ${formattedChatId}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        Logger.warn(deviceId, `Attempt ${attempt + 1} failed:`, error.message);
        
        // Jika bukan attempt terakhir, tunggu sebelum retry
        if (attempt < MAX_RETRIES - 1) {
          const backoffDelay = Math.pow(2, attempt) * 1000;
          Logger.info(deviceId, `Retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }
    
    // Semua attempt gagal
    Logger.error(deviceId, `Failed to send message after ${MAX_RETRIES} attempts:`, lastError.message);
    throw lastError;
  }

  static sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }
    
    // Remove potentially problematic characters but keep emojis and special formatting
    return message
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .trim();
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