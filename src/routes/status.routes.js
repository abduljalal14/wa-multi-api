// ============================================
// FILE: src/routes/status.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const deviceService = require('../services/device.service');

// Global status
router.get('/status', (req, res) => {
  const devices = deviceService.getAllDevices();
  const readyDevices = deviceService.getReadyDeviceCount();
  const totalDevices = deviceService.getDeviceCount();

  res.json({
    status: "success",
    total_devices: totalDevices,
    ready_devices: readyDevices,
    pending_devices: totalDevices - readyDevices,
    devices
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

module.exports = router;


