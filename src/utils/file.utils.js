const fs = require('fs');
const path = require('path');

class FileUtils {
  static ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static saveJSON(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      throw new Error(`Failed to save JSON: ${error.message}`);
    }
  }

  static loadJSON(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load JSON: ${error.message}`);
    }
  }

  static deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  static deleteDirectory(dirPath) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (error) {
      throw new Error(`Failed to delete directory: ${error.message}`);
    }
  }

  static listFiles(dirPath, extension = null) {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      let files = fs.readdirSync(dirPath);
      
      if (extension) {
        files = files.filter(file => file.endsWith(extension));
      }
      
      return files;
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }
}

module.exports = FileUtils;