<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>README - WhatsApp Multi-Device Bot API</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    h1, h2, h3 {
      color: #333;
    }
    pre {
      background-color: #1e1e1e;
      color: #ffffff;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    code {
      font-family: Consolas, monospace;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 10px;
    }
    .note {
      background-color: #fff3cd;
      padding: 10px;
      border-left: 4px solid #ffca28;
      margin: 10px 0;
    }
    .endpoint-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .endpoint-table th, .endpoint-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .endpoint-table th {
      background-color: #4CAF50;
      color: white;
    }
  </style>
</head>
<body>
  <h1>WhatsApp Multi-Device Bot API</h1>
  <p>Selamat datang di dokumentasi untuk WhatsApp Multi-Device Bot API! Aplikasi ini memungkinkan Anda untuk mengelola beberapa instance WhatsApp, mengirim pesan teks dan gambar, serta mengatur webhook untuk notifikasi. Berikut adalah panduan lengkap untuk menginstal dan menggunakan aplikasi ini.</p>

  <h2>Prasyarat</h2>
  <ul>
    <li><strong>Node.js</strong>: Versi 16 atau lebih tinggi. Unduh dari <a href="https://nodejs.org">nodejs.org</a>.</li>
    <li><strong>NPM</strong>: Biasanya sudah terinstal bersama Node.js.</li>
    <li><strong>Git</strong>: Untuk mengkloning repositori (opsional).</li>
    <li><strong>WhatsApp</strong>: Akun WhatsApp aktif untuk autentikasi via QR code.</li>
    <li><strong>Server/Hosting</strong>: Pastikan server Anda memiliki akses internet untuk mengunduh dependensi dan mengirim pesan.</li>
  </ul>

  <h2>Instalasi</h2>
  <p>Ikuti langkah-langkah berikut untuk menginstal aplikasi:</p>
  <ol>
    <li><strong>Kloning Repositori (Opsional)</strong>
      <pre><code>git clone &lt;https://github.com/abduljalal14/wa-multi-api&gt;
cd &lt;wa-multi-api&gt;</code></pre>
      Atau, unduh kode sumber secara manual dan ekstrak ke direktori pilihan Anda.
    </li>
    <li><strong>Instal Dependensi</strong>
      <pre><code>npm install</code></pre>
      Ini akan menginstal semua dependensi yang diperlukan, termasuk <code>whatsapp-web.js</code>, <code>express</code>, <code>axios</code>, <code>qrcode-terminal</code>, dan lainnya.
    </li>
    <li><strong>Konfigurasi API Key</strong>
      <p>Edit file <code>index.js</code> atau setel variabel lingkungan untuk <code>API_KEY</code>:</p>
      <pre><code>export API_KEY="YOUR_SUPER_SECRET_API_KEY"</code></pre>
      <div class="note">
        <strong>Catatan:</strong> Ganti <code>YOUR_SUPER_SECRET_API_KEY</code> dengan kunci yang kuat di lingkungan produksi. Jangan gunakan kunci default!
      </div>
    </li>
    <li><strong>Jalankan Aplikasi</strong>
      <pre><code>node index.js</code></pre>
      Aplikasi akan berjalan pada port default <code>4001</code> (atau port lain yang ditentukan di variabel lingkungan <code>PORT</code>).
    </li>
  </ol>

  <h2>Autentikasi WhatsApp</h2>
  <p>Untuk menggunakan bot, Anda perlu mengautentikasi setiap perangkat dengan akun WhatsApp:</p>
  <ol>
    <li><strong>Buat Perangkat Baru</strong>
      <p>Kirim permintaan POST ke endpoint <code>/api/devices</code> untuk membuat perangkat baru:</p>
      <pre><code>curl -X POST http://localhost:4001/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "YOUR_SUPER_SECRET_API_KEY",
    "device_name": "MyBot",
    "webhook_url": "https://your-webhook-url.com",
    "auto_reply": false
  }'</code></pre>
      Ini akan mengembalikan <code>device_id</code> unik untuk perangkat.
    </li>
    <li><strong>Dapatkan QR Code</strong>
      <p>Gunakan endpoint <code>/api/device/qr</code> untuk mendapatkan QR code:</p>
      <pre><code>curl -X POST http://localhost:4001/api/device/qr \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "&lt;your-device-id&gt;",
    "apikey": "YOUR_SUPER_SECRET_API_KEY"
  }'</code></pre>
      <p>QR code akan ditampilkan di respons atau di konsol server. Buka WhatsApp di ponsel Anda, masuk ke <strong>Pengaturan > Perangkat Tertaut > Tautkan Perangkat</strong>, dan pindai QR code.</p>
    </li>
    <li><strong>Verifikasi Status Perangkat</strong>
      <p>Periksa status perangkat dengan endpoint <code>/api/device</code>:</p>
      <pre><code>curl -X POST http://localhost:4001/api/device \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "&lt;your-device-id&gt;",
    "apikey": "YOUR_SUPER_SECRET_API_KEY"
  }'</code></pre>
      Pastikan <code>is_ready: true</code> sebelum mengirim pesan.
    </li>
  </ol>

  <h2>Penggunaan API</h2>
  <p>Berikut adalah daftar endpoint utama yang tersedia:</p>
  <table class="endpoint-table">
    <tr>
      <th>Metode</th>
      <th>Endpoint</th>
      <th>Deskripsi</th>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/devices</td>
      <td>Menampilkan daftar semua perangkat</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/devices</td>
      <td>Membuat perangkat baru</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/device</td>
      <td>Mendapatkan informasi perangkat (membutuhkan <code>device_id</code>)</td>
    </tr>
    <tr>
      <td>PUT</td>
      <td>/api/device</td>
      <td>Mengupdate konfigurasi perangkat (membutuhkan <code>device_id</code>)</td>
    </tr>
    <tr>
      <td>DELETE</td>
      <td>/api/device</td>
      <td>Menghapus perangkat (membutuhkan <code>device_id</code>)</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/device/qr</td>
      <td>Mendapatkan QR code untuk autentikasi (membutuhkan <code>device_id</code>)</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/device/send-message</td>
      <td>Mengirim pesan teks (membutuhkan <code>device_id</code>, <code>number</code>, <code>message</code>)</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/device/send-image</td>
      <td>Mengirim gambar dengan caption (membutuhkan <code>device_id</code>, <code>number</code>, <code>image</code>, <code>caption</code>)</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/device/logout</td>
      <td>Logout perangkat (membutuhkan <code>device_id</code>)</td>
    </tr>
    <tr>
      <td>POST</td>
      <td>/api/device/test-webhook</td>
      <td>Menguji webhook (membutuhkan <code>device_id</code>)</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/status</td>
      <td>Menampilkan status global semua perangkat</td>
    </tr>
    <tr>
      <td>GET</td>
      <td>/api/health</td>
      <td>Menampilkan status kesehatan server</td>
    </tr>
  </table>

  <h3>Contoh Pengiriman Pesan Teks</h3>
  <pre><code>curl -X POST http://localhost:4001/api/device/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "&lt;your-device-id&gt;",
    "apikey": "YOUR_SUPER_SECRET_API_KEY",
    "number": "6281234567890",
    "message": "Halo, ini pesan dari bot!"
  }'</code></pre>

  <h3>Contoh Pengiriman Gambar</h3>
  <p>Mengirim gambar dari URL:</p>
  <pre><code>curl -X POST http://localhost:4001/api/device/send-image \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "&lt;your-device-id&gt;",
    "apikey": "YOUR_SUPER_SECRET_API_KEY",
    "number": "6281234567890",
    "image": "https://example.com/image.jpg",
    "caption": "Ini adalah gambar contoh"
  }'</code></pre>
  <p>Mengirim gambar dalam format base64:</p>
  <pre><code>curl -X POST http://localhost:4001/api/device/send-image \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "&lt;your-device-id&gt;",
    "apikey": "YOUR_SUPER_SECRET_API_KEY",
    "number": "6281234567890",
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE... (base64 string)",
    "caption": "Ini adalah gambar contoh"
  }'</code></pre>

  <h2>Catatan Penting</h2>
  <div class="note">
    <ul>
      <li><strong>Keamanan</strong>: Simpan <code>API_KEY</code> di variabel lingkungan dan jangan bagikan secara publik.</li>
      <li><strong>Batasan WhatsApp</strong>: Pastikan gambar tidak melebihi batas ukuran (~16MB) dan nomor tujuan valid.</li>
      <li><strong>Webhook</strong>: Jika menggunakan webhook, pastikan URL webhook Anda dapat menerima POST request dengan format JSON.</li>
      <li><strong>Penyimpanan Sesi</strong>: Sesi WhatsApp disimpan di direktori <code>sessions</code>. Jangan hapus direktori ini kecuali Anda ingin logout.</li>
    </ul>
  </div>

  <h2>Pemecahan Masalah</h2>
  <ul>
    <li><strong>QR Code Tidak Muncul</strong>: Pastikan perangkat belum terautentikasi. Gunakan endpoint <code>/api/device/logout</code> untuk mereset sesi.</li>
    <li><strong>Gagal Mengirim Pesan/Gambar</strong>: Periksa status perangkat (<code>is_ready: true</code>) dan pastikan nomor tujuan benar.</li>
    <li><strong>Error "MessageMedia is not a constructor"</strong>: Pastikan Anda menggunakan versi terbaru <code>whatsapp-web.js</code> (<code>npm install whatsapp-web.js@latest</code>).</li>
    <li><strong>Log Server</strong>: Periksa log di konsol server untuk detail error (misalnya, <code>console.error</code>).</li>
  </ul>

  <h2>Lisensi</h2>
  <p>Proyek ini dilisensikan di bawah [Masukkan Lisensi Anda, misalnya MIT License].</p>

  <h2>Kontribusi</h2>
  <p>Jika Anda ingin berkontribusi, silakan fork repositori ini, buat perubahan, dan ajukan pull request. Untuk pertanyaan, hubungi [Masukkan Kontak Anda].</p>

</body>
</html>