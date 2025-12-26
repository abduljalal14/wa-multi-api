# WhatsApp Multi-Device Bot API

Modular, scalable, and maintainable WhatsApp bot API with multi-device support.

## 📁 Project Structure

```
whatsapp-bot/
├── src/
│   ├── config/
│   │   ├── constants.js          # Global constants & configurations
│   │   └── environment.js        # Environment variables loader
│   ├── core/
│   │   └── WhatsAppManager.js    # WhatsApp client manager
│   ├── middleware/
│   │   └── validation.js         # Request validation middleware
│   ├── routes/
│   │   ├── index.js              # Route aggregator
│   │   ├── device.routes.js      # Device management routes
│   │   ├── message.routes.js     # Message sending routes
│   │   └── status.routes.js      # Status & health routes
│   ├── services/
│   │   ├── device.service.js     # Device business logic
│   │   ├── message.service.js    # Message handling logic
│   │   └── webhook.service.js    # Webhook management
│   ├── utils/
│   │   ├── file.utils.js         # File operations
│   │   ├── download.utils.js     # Download helpers
│   │   └── logger.utils.js       # Logging utilities
│   └── app.js                    # Express app setup
├── configs/                       # Device configs (auto-generated)
├── sessions/                      # WhatsApp sessions (auto-generated)
├── index.js                       # Entry point
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or create project directory
mkdir whatsapp-bot && cd whatsapp-bot

# Install dependencies
npm install
```

### 2. Configuration

Create `.env` file from example:

```bash
cp .env.example .env
```

Edit `.env` and set your API key:

```env
API_KEY=your_secret_api_key_here
PORT=4001
```

### 3. Run

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## 📡 API Endpoints

### Device Management

#### Create New Device
```http
POST /api/devices
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_name": "My Device",
  "webhook_url": "https://your-webhook.com/endpoint",
  "auto_reply": false
}
```

#### List All Devices
```http
GET /api/devices
```

#### Get Device Info
```http
GET /api/device
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid"
}
```

#### Update Device Config
```http
PUT /api/device
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid",
  "device_name": "Updated Name",
  "webhook_url": "https://new-webhook.com",
  "auto_reply": true
}
```

#### Delete Device
```http
DELETE /api/device
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid"
}
```

#### Get QR Code
```http
POST /api/device/qr
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid"
}
```

#### Logout Device
```http
POST /api/device/logout
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid"
}
```

### Messaging

#### Send Text Message
```http
POST /api/device/send-message
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid",
  "number": "6281234567890",
  "message": "Hello World!"
}
```

#### Send Image
```http
POST /api/device/send-image
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid",
  "number": "6281234567890",
  "image": "https://example.com/image.jpg",
  "caption": "Check this out!"
}
```

Or with base64:
```json
{
  "apikey": "your_api_key",
  "device_id": "device-uuid",
  "number": "6281234567890",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "caption": "Base64 image"
}
```

#### Send Document
```http
POST /api/device/send-document
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid",
  "number": "6281234567890",
  "document": "https://example.com/document.pdf",
  "filename": "report.pdf",
  "caption": "Here's the report"
}
```

### Status & Health

#### Global Status
```http
GET /api/status
```

#### Health Check
```http
GET /api/health
```

#### Test Webhook
```http
POST /api/device/test-webhook
Content-Type: application/json

{
  "apikey": "your_api_key",
  "device_id": "device-uuid"
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | Global API key for authentication | `YOUR_SUPER_SECRET_API_KEY` |
| `PORT` | Server port | `4001` |
| `NODE_ENV` | Environment mode | `development` |
| `CONFIG_DIR` | Device configs directory | `./configs` |
| `SESSIONS_DIR` | WhatsApp sessions directory | `./sessions` |
| `WEBHOOK_TIMEOUT` | Webhook request timeout (ms) | `30000` |
| `MAX_FILE_SIZE` | Max file upload size (bytes) | `52428800` (50MB) |
| `DOWNLOAD_TIMEOUT` | Download timeout (ms) | `60000` |

## 🎯 Features

### ✅ Multi-Device Support
- Manage multiple WhatsApp devices simultaneously
- Each device has independent session and configuration
- Auto-load existing devices on startup

### ✅ Webhook Integration
- Send incoming messages to your webhook
- Send outgoing messages to your webhook
- Configurable per device
- Includes contact info and metadata

### ✅ Rich Messaging
- Text messages
- Images (URL or base64)
- Documents (URL or base64)
- Captions and filenames support

### ✅ Auto Reply
- Configurable auto-reply per device
- Custom reply messages

### ✅ Bot Commands
- `!info` - Show device information
- `!test` - Test bot response
- `!ping` - Ping bot

### ✅ Robust Architecture
- Modular code structure
- Separation of concerns
- Easy to maintain and extend
- Comprehensive error handling

## 📊 Webhook Payload

### Incoming Message
```json
{
  "device_id": "device-uuid",
  "device_name": "My Device",
  "type": "incoming_chat",
  "data": {
    "chat_id": "6281234567890",
    "message_id": "message_id",
    "name": "John Doe",
    "profile_picture": "https://...",
    "timestamp": 1234567890,
    "message_body": "Hello!",
    "message_ack": "PENDING",
    "has_media": false,
    "media_mime": "",
    "media_name": "",
    "location_attached": {
      "lat": null,
      "lng": null
    },
    "is_forwarding": false,
    "is_from_me": false
  }
}
```

### Outgoing Message
```json
{
  "device_id": "device-uuid",
  "device_name": "My Device",
  "type": "outgoing_chat",
  "data": {
    "chat_id": "6281234567890",
    "message_id": "message_id",
    "name": "Contact Name",
    "timestamp": 1234567890,
    "message_body": "Reply message",
    "message_ack": "SENT",
    "is_from_me": true
  }
}
```

## 🔒 Security

- API key authentication on all endpoints
- Input validation middleware
- Rate limiting recommended for production
- Environment variables for sensitive data

## 🛠️ Development

### Code Structure

- **config/** - Configuration and constants
- **core/** - Core business logic (WhatsApp client)
- **middleware/** - Express middleware
- **routes/** - API route handlers
- **services/** - Business logic layer
- **utils/** - Helper utilities

### Adding New Features

1. Add configuration in `src/config/`
2. Add business logic in `src/services/`
3. Add routes in `src/routes/`
4. Add utilities in `src/utils/` if needed

### Logging

Use the Logger utility for consistent logging:

```javascript
const Logger = require('./utils/logger.utils');

Logger.log(deviceId, 'Message', data);
Logger.error(deviceId, 'Error message', error);
Logger.success(deviceId, 'Success message');
Logger.warn(deviceId, 'Warning message');
Logger.info(deviceId, 'Info message');
```

## 🐛 Troubleshooting

### QR Code Not Showing
- Check if device already authenticated
- Try logout and re-initialize

### Client Not Ready
- Wait for "WhatsApp Bot is ready!" message
- Check session directory permissions

### Webhook Not Working
- Verify webhook URL is accessible
- Check webhook endpoint logs
- Test with `/api/device/test-webhook`

## 📄 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on GitHub.