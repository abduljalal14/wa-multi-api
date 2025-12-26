// ============================================
// FILE: src/routes/index.js
// ============================================

const express = require('express');
const router = express.Router();

const deviceRoutes = require('./device.routes');
const messageRoutes = require('./message.routes');
const statusRoutes = require('./status.routes');

// Mount routes
router.use('/api', deviceRoutes);
router.use('/api', messageRoutes);
router.use('/api', statusRoutes);

// Legacy compatibility routes
router.use('/', messageRoutes);

module.exports = router;