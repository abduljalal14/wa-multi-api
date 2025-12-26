# 📱 WhatsApp Multi-Device Bot API - Dokumentasi Lengkap

## 📋 Daftar Isi
1. [Pengenalan](#pengenalan)
2. [Setup & Autentikasi](#setup--autentikasi)
3. [Device Management](#device-management)
4. [Messaging](#messaging)
5. [Status & Monitoring](#status--monitoring)
6. [Error Handling](#error-handling)
7. [Contoh Implementasi](#contoh-implementasi)

---

## Pengenalan

### Tentang API
**WhatsApp Multi-Device Bot API** adalah REST API yang memungkinkan Anda:
- ✅ Mengelola multiple WhatsApp devices secara bersamaan
- ✅ Mengirim pesan teks, gambar, dan dokumen
- ✅ Memantau status koneksi device
- ✅ Mengintegrasikan webhook untuk notifikasi real-time
- ✅ Konfigurasi otomatis dan persistent storage

### Base URL
```
http://localhost:3000/api
```
Ganti `localhost:3000` dengan host dan port server Anda.

### Response Format
Semua response menggunakan format JSON dengan struktur:
```json
{
  "status": "success" | "error",
  "message": "string",
  "data": {}
}
```

---

## Setup & Autentikasi

### Environment Variables
Buat file `.env` di root project:
```env
PORT=3000
API_KEY=your_secret_api_key_here
CONFIG_DIR=./configs
SESSIONS_DIR=./sessions
```

### API Key
Setiap request (kecuali tertentu) memerlukan:
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "device-uuid-here"
}
```

> ⚠️ **Penting**: API Key disimpan di environment variable dan divalidasi di setiap request

---

## Device Management

### 1. Create New Device
Membuat device WhatsApp baru.

**Endpoint**
```
POST /api/devices
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_name": "My First Device (optional)",
  "webhook_url": "https://your-webhook.com/webhook (optional)",
  "auto_reply": false
}
```

**Response**
```json
{
  "status": "success",
  "message": "Device successfully created",
  "device": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "device_name": "My First Device",
    "status": "initializing",
    "isReady": false,
    "webhook_url": "https://your-webhook.com/webhook"
  }
}
```

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_name": "Bot Device 1",
    "webhook_url": "https://example.com/webhook"
  }'
```

---

### 2. Get All Devices
Mengambil daftar semua device yang terdaftar.

**Endpoint**
```
GET /api/devices
```

**Response**
```json
{
  "status": "success",
  "devices": [
    {
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "device_name": "Bot Device 1",
      "status": "ready",
      "isReady": true,
      "webhook_url": "https://example.com/webhook",
      "auto_reply": false
    },
    {
      "deviceId": "660e8400-e29b-41d4-a716-446655440001",
      "device_name": "Bot Device 2",
      "status": "scanning_qr",
      "isReady": false,
      "webhook_url": null,
      "auto_reply": true
    }
  ],
  "total": 2
}
```

**cURL Example**
```bash
curl http://localhost:3000/api/devices
```

---

### 3. Get Specific Device
Mengambil informasi detail device tertentu.

**Endpoint**
```
GET /api/device
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**
```json
{
  "status": "success",
  "device": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "device_name": "Bot Device 1",
    "status": "ready",
    "isReady": true,
    "phone_number": "628123456789",
    "webhook_url": "https://example.com/webhook",
    "auto_reply": false
  }
}
```

---

### 4. Update Device Configuration
Mengubah konfigurasi device (nama, webhook, auto-reply).

**Endpoint**
```
PUT /api/device
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_name": "Updated Device Name (optional)",
  "webhook_url": "https://new-webhook.com/webhook (optional)",
  "auto_reply": true
}
```

**Response**
```json
{
  "status": "success",
  "message": "Device configuration updated successfully",
  "device": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "device_name": "Updated Device Name",
    "webhook_url": "https://new-webhook.com/webhook",
    "auto_reply": true
  }
}
```

**cURL Example**
```bash
curl -X PUT http://localhost:3000/api/device \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "device_name": "Updated Name",
    "auto_reply": true
  }'
```

---

### 5. Delete Device
Menghapus device secara permanen.

**Endpoint**
```
DELETE /api/device
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**
```json
{
  "status": "success",
  "message": "Device deleted permanently. Client destroyed, session removed.",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 6. Get QR Code
Mengambil QR code untuk scan WhatsApp.

**Endpoint**
```
POST /api/device/qr
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**
```json
{
  "status": "success",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CA...",
  "message": "Scan this QR code in WhatsApp"
}
```

**📱 Cara Menggunakan**
1. Buka WhatsApp di smartphone
2. Tap Menu → Linked Devices → Link a device
3. Scan QR code dari response

---

### 7. Logout Device
Logout device dan menampilkan QR code baru.

**Endpoint**
```
POST /api/device/logout
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**
```json
{
  "status": "success",
  "message": "Logout successful. Waiting for new QR..."
}
```

---

### 8. Test Webhook
Menguji webhook configuration dengan test data.

**Endpoint**
```
POST /api/device/test-webhook
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response**
```json
{
  "status": "success",
  "message": "Test webhook sent successfully",
  "webhook_url": "https://your-webhook.com/webhook",
  "test_data": {
    "type": "test_webhook",
    "data": {
      "chat_id": "6282325339189",
      "message_id": "TEST_MESSAGE_1234567890",
      "name": "Test User",
      "message_body": "Test message from Bot Device 1",
      "message_ack": "SENT",
      "timestamp": 1234567890
    }
  }
}
```

---

## Messaging

### 1. Send Text Message
Mengirim pesan teks ke nomor WhatsApp.

**Endpoint**
```
POST /api/device/send-message
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "number": "628123456789",
  "message": "Halo! Ini pesan dari bot"
}
```

**Response**
```json
{
  "status": "success",
  "message": "Message sent successfully",
  "to": "628123456789@c.us",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/device/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "number": "628123456789",
    "message": "Halo dari bot!"
  }'
```

**⚠️ Error Cases**
- `404 Not Found`: Device tidak ditemukan
- `503 Service Unavailable`: Device belum siap (belum scan QR)
- `400 Bad Request`: Parameter `number` atau `message` tidak ada

---

### 2. Send Image
Mengirim gambar dengan optional caption.

**Endpoint**
```
POST /api/device/send-image
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "number": "628123456789",
  "image": "https://example.com/image.jpg or base64_string",
  "caption": "Gambar contoh (optional)"
}
```

**Response**
```json
{
  "status": "success",
  "message": "Image sent successfully",
  "to": "628123456789@c.us",
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/device/send-image \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "number": "628123456789",
    "image": "https://example.com/photo.jpg",
    "caption": "Foto bagus!"
  }'
```

**📝 Format Gambar**
- URL: `https://example.com/image.jpg`
- Base64: `data:image/jpeg;base64,/9j/4AAQSkZJRg...`

---

### 3. Send Document
Mengirim dokumen (PDF, Excel, Word, dll).

**Endpoint**
```
POST /api/device/send-document
```

**Parameters (Body)**
```json
{
  "apikey": "your_secret_api_key_here",
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "number": "628123456789",
  "document": "https://example.com/file.pdf or base64_string",
  "filename": "document.pdf",
  "caption": "File penting (optional)"
}
```

**Response**
```json
{
  "status": "success",
  "message": "Document sent successfully",
  "to": "628123456789@c.us",
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "document.pdf"
}
```

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/device/send-document \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "number": "628123456789",
    "document": "https://example.com/invoice.pdf",
    "filename": "invoice.pdf",
    "caption": "Invoice Anda"
  }'
```

---

## Status & Monitoring

### 1. Global Status
Mengambil status keseluruhan sistem.

**Endpoint**
```
GET /api/status
```

**Response**
```json
{
  "status": "success",
  "total_devices": 3,
  "ready_devices": 2,
  "pending_devices": 1,
  "devices": [
    {
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "device_name": "Bot Device 1",
      "status": "ready",
      "isReady": true
    },
    {
      "deviceId": "660e8400-e29b-41d4-a716-446655440001",
      "device_name": "Bot Device 2",
      "status": "ready",
      "isReady": true
    },
    {
      "deviceId": "770e8400-e29b-41d4-a716-446655440002",
      "device_name": "Bot Device 3",
      "status": "initializing",
      "isReady": false
    }
  ]
}
```

---

### 2. Health Check
Cek kesehatan server.

**Endpoint**
```
GET /api/health
```

**Response**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "uptime": 3600.25,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 10485760,
    "external": 1024000
  }
}
```

---

## Error Handling

### Error Response Format
```json
{
  "status": "error",
  "message": "Error description",
  "error": "detailed_error_message"
}
```

### HTTP Status Codes

| Code | Meaning | Contoh |
|------|---------|--------|
| `200` | Success | Request berhasil diproses |
| `400` | Bad Request | Parameter tidak lengkap/salah |
| `401` | Unauthorized | API Key tidak diberikan |
| `403` | Forbidden | API Key salah |
| `404` | Not Found | Device/endpoint tidak ditemukan |
| `410` | Gone | Device sudah dihapus |
| `503` | Service Unavailable | Device belum siap |
| `500` | Internal Server Error | Server error |

### Contoh Error Response

**Missing API Key**
```json
{
  "status": "error",
  "message": "Parameter 'apikey' is required in the request body."
}
```

**Invalid API Key**
```json
{
  "status": "error",
  "message": "Invalid API Key."
}
```

**Device Not Found**
```json
{
  "status": "error",
  "message": "Device not found"
}
```

**Device Not Ready**
```json
{
  "status": "error",
  "message": "Device not ready. Wait until status is ready."
}
```

---

## Contoh Implementasi

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_KEY = 'your_secret_api_key_here';
const BASE_URL = 'http://localhost:3000/api';
const DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

// Create Device
async function createDevice() {
  try {
    const response = await axios.post(`${BASE_URL}/devices`, {
      apikey: API_KEY,
      device_name: 'My Bot Device',
      webhook_url: 'https://example.com/webhook'
    });
    console.log('Device created:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Send Message
async function sendMessage(number, message) {
  try {
    const response = await axios.post(`${BASE_URL}/device/send-message`, {
      apikey: API_KEY,
      device_id: DEVICE_ID,
      number: number,
      message: message
    });
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Send Image
async function sendImage(number, imageUrl, caption) {
  try {
    const response = await axios.post(`${BASE_URL}/device/send-image`, {
      apikey: API_KEY,
      device_id: DEVICE_ID,
      number: number,
      image: imageUrl,
      caption: caption
    });
    console.log('Image sent:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Get Status
async function getStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/status`);
    console.log('Status:', response.data);
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

// Usage
createDevice();
sendMessage('628123456789', 'Halo!');
sendImage('628123456789', 'https://example.com/photo.jpg', 'Foto');
getStatus();
```

### Python

```python
import requests
import json

API_KEY = 'your_secret_api_key_here'
BASE_URL = 'http://localhost:3000/api'
DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000'

def create_device(device_name, webhook_url=None):
    payload = {
        'apikey': API_KEY,
        'device_name': device_name,
        'webhook_url': webhook_url
    }
    response = requests.post(f'{BASE_URL}/devices', json=payload)
    return response.json()

def send_message(number, message):
    payload = {
        'apikey': API_KEY,
        'device_id': DEVICE_ID,
        'number': number,
        'message': message
    }
    response = requests.post(f'{BASE_URL}/device/send-message', json=payload)
    return response.json()

def send_image(number, image_url, caption=''):
    payload = {
        'apikey': API_KEY,
        'device_id': DEVICE_ID,
        'number': number,
        'image': image_url,
        'caption': caption
    }
    response = requests.post(f'{BASE_URL}/device/send-image', json=payload)
    return response.json()

def get_status():
    response = requests.get(f'{BASE_URL}/status')
    return response.json()

# Usage
print(create_device('My Bot Device'))
print(send_message('628123456789', 'Halo!'))
print(send_image('628123456789', 'https://example.com/photo.jpg', 'Foto'))
print(get_status())
```

### PHP

```php
<?php

class WhatsAppAPI {
    private $apiKey;
    private $baseUrl;
    private $deviceId;

    public function __construct($apiKey, $baseUrl, $deviceId) {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
        $this->deviceId = $deviceId;
    }

    private function request($method, $endpoint, $data = []) {
        $url = $this->baseUrl . $endpoint;
        $data['apikey'] = $this->apiKey;
        
        if ($this->deviceId) {
            $data['device_id'] = $this->deviceId;
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }

    public function sendMessage($number, $message) {
        return $this->request('POST', '/device/send-message', [
            'number' => $number,
            'message' => $message
        ]);
    }

    public function sendImage($number, $imageUrl, $caption = '') {
        return $this->request('POST', '/device/send-image', [
            'number' => $number,
            'image' => $imageUrl,
            'caption' => $caption
        ]);
    }

    public function getStatus() {
        return $this->request('GET', '/status', []);
    }
}

// Usage
$api = new WhatsAppAPI(
    'your_secret_api_key_here',
    'http://localhost:3000/api',
    '550e8400-e29b-41d4-a716-446655440000'
);

print_r($api->sendMessage('628123456789', 'Halo!'));
print_r($api->sendImage('628123456789', 'https://example.com/photo.jpg', 'Foto'));
print_r($api->getStatus());
?>
```

### cURL Examples

**Create Device**
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_name": "My Bot",
    "webhook_url": "https://example.com/webhook"
  }'
```

**Send Message**
```bash
curl -X POST http://localhost:3000/api/device/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_secret_api_key_here",
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "number": "628123456789",
    "message": "Halo dari bot!"
  }'
```

**Get Status**
```bash
curl http://localhost:3000/api/status
```

---

## 🔐 Security Best Practices

1. **Jangan expose API Key** - Simpan di environment variable
2. **Gunakan HTTPS** - Di production, gunakan HTTPS bukan HTTP
3. **Rate Limiting** - Implementasikan rate limiting untuk mencegah abuse
4. **Input Validation** - Validasi semua input dari client
5. **Webhook Security** - Validasi webhook request dari server
6. **Logging** - Log semua request untuk audit trail

---

## 📞 Support & Troubleshooting

### QR Code tidak muncul?
- Device sudah authenticated sebelumnya
- Cek status device dengan GET `/api/status`
- Logout device terlebih dahulu dengan POST `/api/device/logout`

### Pesan tidak terkirim?
- Pastikan `isClientReady` adalah `true`
- Check nomor WhatsApp (gunakan format `628123456789`)
- Pastikan device tidak di-logout

### Webhook tidak diterima?
- Test webhook dengan POST `/api/device/test-webhook`
- Cek logs di server
- Pastikan webhook URL dapat diakses dari server

---

## 📝 Changelog

### Version 2.0.0
- ✅ Multi-device support
- ✅ Webhook integration
- ✅ Persistent storage
- ✅ Auto reconnect
- ✅ Complete API documentation

---

**Terakhir diupdate**: Desember 2025
**Status**: ✅ Production Ready
