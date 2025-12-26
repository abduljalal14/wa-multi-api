const express = require('express');
const router = express.Router();
const deviceService = require('../services/device.service');
const { validateRequest } = require('../middleware/validation');

// Send text message
router.post('/device/send-message', validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const { number, message } = req.body;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  if (!manager.isClientReady) {
    return res.status(503).json({
      status: "error",
      message: "Device not ready. Wait until status is ready."
    });
  }

  if (!number || !message) {
    return res.status(400).json({
      status: "error",
      message: "Parameters 'number' and 'message' are required"
    });
  }

  try {
    await manager.sendMessage(number, message);
    res.json({
      status: "success",
      message: "Message sent successfully",
      to: number.includes("@c.us") ? number : `${number}@c.us`,
      device_id: deviceId
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to send message",
      error: error.message
    });
  }
});

// Send image
router.post('/device/send-image', validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const { number, image, caption } = req.body;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  if (!manager.isClientReady) {
    return res.status(503).json({
      status: "error",
      message: "Device not ready. Wait until status is ready."
    });
  }

  if (!number || !image) {
    return res.status(400).json({
      status: "error",
      message: "Parameters 'number' and 'image' are required"
    });
  }

  try {
    await manager.sendImage(number, image, caption || '');
    res.json({
      status: "success",
      message: "Image sent successfully",
      to: number.includes("@c.us") ? number : `${number}@c.us`,
      device_id: deviceId
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to send image",
      error: error.message
    });
  }
});

// Send document
router.post('/device/send-document', validateRequest, async (req, res) => {
  const { deviceId } = req.params;
  const { number, document, filename, caption } = req.body;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found"
    });
  }

  if (!manager.isClientReady) {
    return res.status(503).json({
      status: "error",
      message: "Device not ready. Wait until status is ready."
    });
  }

  if (!number || !document) {
    return res.status(400).json({
      status: "error",
      message: "Parameters 'number' and 'document' are required"
    });
  }

  try {
    await manager.sendDocument(number, document, filename || '', caption || '');
    res.json({
      status: "success",
      message: "Document sent successfully",
      to: number.includes("@c.us") ? number : `${number}@c.us`,
      device_id: deviceId,
      filename: filename || 'document'
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to send document",
      error: error.message
    });
  }
});

// Legacy compatibility routes
router.post('/send-message', validateRequest, async (req, res) => {
  const { number, message } = req.body;
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found."
    });
  }

  if (!manager.isClientReady) {
    return res.status(503).json({
      status: "error",
      message: "Device not ready"
    });
  }

  try {
    await manager.sendMessage(number, message);
    res.json({
      status: "success",
      message: "Message sent successfully (Compatibility mode)"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.post('/get_qr', validateRequest, (req, res) => {
  const { deviceId } = req.params;
  const manager = deviceService.getDevice(deviceId);

  if (!manager) {
    return res.status(404).json({
      status: "error",
      message: "Device not found. Create a new device or check /api/devices"
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
    message: "Scan this QR code in WhatsApp (Compatibility mode)"
  });
});

module.exports = router;