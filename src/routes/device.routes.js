const express = require('express');
const router = express.Router();
const deviceService = require('../services/device.service');
const WhatsAppManager = require('../core/WhatsAppManager');
const { validateApiKey, validateRequest } = require('../middleware/validation');

// Create new device
router.post('/devices', validateApiKey, (req, res) => {
  const { device_name, webhook_url, auto_reply } = req.body;

  try {
    const config = {
      device_name,
      webhook_url,
      auto_reply
    };

    const { deviceId, manager } = deviceService.createDevice(WhatsAppManager, config);

    res.json({
      status: "success",
      message: "Device successfully created",
      device: manager.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to create device",
      error: error.message
    });
  }
});

// Get all devices
router.get('/devices', (req, res) => {
  const devices = deviceService.getAllDevices();
  
  res.json({
    status: "success",
    devices,
    total: deviceService.getDeviceCount()
  });
});

// Get specific device
router.get('/device', validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  res.json({
    status: "success",
    device: manager.getStatus()
  });
});

// Update device config
router.put('/device', validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  try {
    const { device_name, webhook_url, auto_reply } = req.body;
    const updates = {};

    if (device_name !== undefined) updates.device_name = device_name;
    if (webhook_url !== undefined) updates.webhook_url = webhook_url;
    if (auto_reply !== undefined) updates.auto_reply = auto_reply;

    manager.updateConfig(updates);

    res.json({
      status: "success",
      message: "Device configuration updated successfully",
      device: manager.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to update device",
      error: error.message
    });
  }
});

// Delete device - IMPROVED VERSION
router.delete('/device', validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  try {
    // Gunakan method destroy() yang baru untuk menghapus device secara permanen
    await manager.destroy();
    
    // Hapus dari deviceService
    deviceService.clients.delete(deviceId);

    res.json({
      status: "success",
      message: "Device deleted permanently. Client destroyed, session removed, and QR generation stopped.",
      device_id: deviceId
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to delete device",
      error: error.message
    });
  }
});

// Get QR code
router.post('/device/qr', validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  if (manager.isDeleted) {
    return res.status(410).json({
      status: "error",
      message: "Device has been deleted"
    });
  }

  if (!manager.currentQR) {
    return res.status(404).json({
      status: "error",
      message: "QR Code not available. Device may already be authenticated."
    });
  }

  res.json({
    status: "success",
    qr_code: manager.currentQR,
    message: "Scan this QR code in WhatsApp"
  });
});

// Logout device
router.post('/device/logout', validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  if (manager.isDeleted) {
    return res.status(410).json({
      status: "error",
      message: "Device has been deleted"
    });
  }

  try {
    await manager.logout();
    res.json({
      status: "success",
      message: "Logout successful. Waiting for new QR..."
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to logout",
      error: error.message
    });
  }
});

// Test webhook
router.post('/device/test-webhook', validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  if (manager.isDeleted) {
    return res.status(410).json({
      status: "error",
      message: "Device has been deleted"
    });
  }

  if (!manager.config.webhook_url) {
    return res.status(400).json({
      status: "error",
      message: "Webhook not set for this device"
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
      message: "Test webhook sent successfully",
      webhook_url: manager.config.webhook_url,
      test_data: testData
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Test webhook failed",
      error: error.message
    });
  }
});

module.exports = router;