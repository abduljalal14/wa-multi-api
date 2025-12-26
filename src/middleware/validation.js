// ============================================
// FILE: src/middleware/validation.js
// ============================================

const { API_KEY } = require('../config/environment');

const validateApiKey = (req, res, next) => {
  const { apikey } = req.body;

  if (!apikey) {
    return res.status(401).json({
      status: "error",
      message: "Parameter 'apikey' is required in the request body."
    });
  }

  if (apikey !== API_KEY) {
    return res.status(403).json({
      status: "error",
      message: "Invalid API Key."
    });
  }

  next();
};

const validateDeviceId = (req, res, next) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.status(400).json({
      status: "error",
      message: "Parameter 'device_id' is required in the request body."
    });
  }

  req.params.deviceId = device_id;
  next();
};

const validateRequest = (req, res, next) => {
  validateApiKey(req, res, (err) => {
    if (err) return;
    validateDeviceId(req, res, next);
  });
};

const errorHandler = (error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    error: error.message
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    status: "error",
    message: "Endpoint not found",
    available_endpoints: [
      "GET /api/devices - List all devices",
      "POST /api/devices - Create new device",
      "GET /api/device - Get device info",
      "PUT /api/device - Update device config",
      "DELETE /api/device - Delete device",
      "POST /api/device/qr - Get QR code",
      "POST /api/device/send-message - Send text message",
      "POST /api/device/send-image - Send image",
      "POST /api/device/send-document - Send document",
      "POST /api/device/logout - Logout device",
      "POST /api/device/test-webhook - Test webhook",
      "GET /api/status - Global status",
      "GET /api/health - Health check"
    ]
  });
};

module.exports = {
  validateApiKey,
  validateDeviceId,
  validateRequest,
  errorHandler,
  notFoundHandler
};


