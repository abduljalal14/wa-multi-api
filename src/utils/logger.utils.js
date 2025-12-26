class Logger {
  static log(deviceId, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${deviceId}] ${message}`, data || '');
  }

  static error(deviceId, message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${deviceId}] ERROR: ${message}`, error || '');
  }

  static warn(deviceId, message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${deviceId}] WARN: ${message}`, data || '');
  }

  static info(deviceId, message, data = null) {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] [${deviceId}] INFO: ${message}`, data || '');
  }

  static success(deviceId, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${deviceId}] ✅ ${message}`, data || '');
  }
}

module.exports = Logger;