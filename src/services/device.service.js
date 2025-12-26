const { v4: uuidv4 } = require('uuid');

class DeviceService {
  constructor() {
    this.clients = new Map();
  }

  createDevice(WhatsAppManager, config = {}) {
    const deviceId = uuidv4();
    
    const deviceConfig = {
      device_name: config.device_name || `Device-${deviceId}`,
      webhook_url: config.webhook_url || null,
      auto_reply: config.auto_reply || false,
      ...config
    };

    const manager = new WhatsAppManager(deviceId, deviceConfig);
    this.clients.set(deviceId, manager);

    return {
      deviceId,
      manager
    };
  }

  getDevice(deviceId) {
    return this.clients.get(deviceId);
  }

  getAllDevices() {
    const devices = [];
    for (const [deviceId, manager] of this.clients.entries()) {
      devices.push(manager.getStatus());
    }
    return devices;
  }

  hasDevice(deviceId) {
    return this.clients.has(deviceId);
  }

  async deleteDevice(deviceId) {
    const manager = this.clients.get(deviceId);
    if (!manager) {
      throw new Error('Device not found');
    }

    await manager.logout();
    this.clients.delete(deviceId);

    return true;
  }

  getDeviceCount() {
    return this.clients.size;
  }

  getReadyDeviceCount() {
    let count = 0;
    for (const manager of this.clients.values()) {
      if (manager.isClientReady) {
        count++;
      }
    }
    return count;
  }

  async shutdownAllDevices() {
    const promises = [];
    for (const [deviceId, manager] of this.clients) {
      if (manager.client) {
        promises.push(manager.client.destroy().catch(err => 
          console.error(`Error shutting down ${deviceId}:`, err.message)
        ));
      }
    }
    await Promise.all(promises);
  }
}

module.exports = new DeviceService();