const axios = require('axios');
const { MAX_FILE_SIZE, DOWNLOAD_TIMEOUT } = require('../config/environment');

class DownloadUtils {
  static async downloadImage(url) {
    try {
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        timeout: DOWNLOAD_TIMEOUT
      });
      
      const buffer = Buffer.from(response.data, 'binary');
      const mimeType = response.headers['content-type'];
      
      return { buffer, mimeType };
    } catch (error) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  static async downloadFile(url) {
    try {
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        maxContentLength: MAX_FILE_SIZE,
        timeout: DOWNLOAD_TIMEOUT
      });
      
      const buffer = Buffer.from(response.data, 'binary');
      const mimeType = response.headers['content-type'] || 'application/octet-stream';
      
      return { buffer, mimeType };
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  static getExtensionFromMime(mimeType) {
    const { MIME_TYPE_MAP } = require('../config/constants');
    return MIME_TYPE_MAP[mimeType] || 'bin';
  }

  static isValidURL(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  static isBase64(string) {
    return string.startsWith('data:');
  }

  static parseBase64(base64String) {
    const matches = base64String.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 format');
    }
    
    return {
      mimeType: matches[1],
      data: matches[2]
    };
  }
}

module.exports = DownloadUtils;