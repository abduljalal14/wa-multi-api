const axios = require('axios');
const Logger = require('../utils/logger.utils');
const { WEBHOOK_TIMEOUT } = require('../config/environment');

class WebhookService {
  static async sendWebhook(deviceId, deviceName, webhookUrl, webhookData) {
    if (!webhookUrl) {
      return;
    }

    try {
      const payload = {
        device_id: deviceId,
        device_name: deviceName,
        ...webhookData
      };

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "WhatsApp-Bot-Multi/2.0",
        },
        timeout: WEBHOOK_TIMEOUT,
      });

      Logger.success(deviceId, 'Webhook sent successfully');
      Logger.info(deviceId, 'Webhook response:', response.data);
      
      return response.data;
    } catch (error) {
      Logger.error(deviceId, 'Failed to send webhook:', error.message);
      throw error;
    }
  }

  static buildIncomingMessagePayload(msg, contactName, profilePicture) {
    const chatId = msg.from.replace("@c.us", "");
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

    return {
      type: "incoming_chat",
      data: {
        chat_id: chatId,
        message_id: msg.id._serialized,
        name: contactName,
        profile_picture: profilePicture,
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
  }

  static buildOutgoingMessagePayload(msg, contactName) {
    const chatId = msg.to.replace("@c.us", "");

    return {
      type: "outgoing_chat",
      data: {
        chat_id: chatId,
        message_id: msg.id._serialized,
        name: contactName,
        timestamp: msg.timestamp,
        message_body: msg.body,
        message_ack: msg.ack || "PENDING",
        is_from_me: true,
      },
    };
  }
}

module.exports = WebhookService;