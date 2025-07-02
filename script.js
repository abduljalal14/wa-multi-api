const API_BASE = "http://localhost:4001/api";
// Define your API Key here. IMPORTANT: This must match the GLOBAL_API_KEY in index.js
const API_KEY = "YOUR_SUPER_SECRET_API_KEY"; // Change this to your actual key!
let currentDeviceId = null;
let qrInterval = null;

// Initialize the app
document.addEventListener("DOMContentLoaded", function () {
  refreshDevices();
  updateStats();
  setInterval(updateStats, 30000); // Update stats every 30 seconds
});

// API Functions
async function apiCall(endpoint, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      // The x-api-key header is removed as the backend expects apikey in the request body
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: headers,
      ...options,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${
          errorData.message || response.statusText
        }`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    showAlert("Error: " + error.message, "error");
    throw error;
  }
}

// Device Management
async function refreshDevices() {
  try {
    const response = await apiCall("/devices"); // No apikey needed for GET /api/devices
    displayDevices(response.devices);
    updateBulkDeviceSelect(response.devices);
  } catch (error) {
    console.error("Error refreshing devices:", error);
  }
}

async function createDevice(deviceData) {
  try {
    // Add apikey to the body for POST /api/devices
    const dataToSend = { ...deviceData, apikey: API_KEY };
    const response = await apiCall("/devices", {
      method: "POST",
      body: JSON.stringify(dataToSend),
    });

    showAlert("Device created successfully!", "success");
    closeModal("createDeviceModal");
    refreshDevices();
    return response.device;
  } catch (error) {
    console.error("Error creating device:", error);
  }
}

async function deleteDevice(deviceId) {
  if (!confirm("Are you sure you want to delete this device?")) return;

  try {
    // Add apikey and device_id to the body for DELETE /api/device
    const dataToSend = { device_id: deviceId, apikey: API_KEY };
    await apiCall(`/device`, {
      // Corrected endpoint: removed /:deviceId from URL
      method: "DELETE",
      body: JSON.stringify(dataToSend),
    });

    showAlert("Device deleted successfully!", "success");
    refreshDevices();
  } catch (error) {
    console.error("Error deleting device:", error);
  }
}

async function logoutDevice(deviceId) {
  if (!confirm("Are you sure you want to logout this device?")) return;

  try {
    // Add apikey and device_id to the body for POST /api/device/logout
    const dataToSend = { device_id: deviceId, apikey: API_KEY };
    await apiCall(`/device/logout`, {
      // Corrected endpoint: removed /:deviceId from URL
      method: "POST",
      body: JSON.stringify(dataToSend),
    });

    showAlert("Device logged out successfully!", "success");
    refreshDevices();
  } catch (error) {
    console.error("Error logging out device:", error);
  }
}

async function sendMessage(deviceId, number, message) {
  try {
    // Add apikey and device_id to the body for POST /api/device/send-message
    const dataToSend = {
      number,
      message,
      device_id: deviceId,
      apikey: API_KEY,
    };
    const response = await apiCall(`/device/send-message`, {
      // Corrected endpoint: removed /:deviceId from URL
      method: "POST",
      body: JSON.stringify(dataToSend),
    });

    showAlert("Message sent successfully!", "success");
    return response;
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

async function testWebhook(deviceId) {
  try {
    // Add apikey and device_id to the body for POST /api/device/test-webhook
    const dataToSend = { device_id: deviceId, apikey: API_KEY };
    const response = await apiCall(`/device/test-webhook`, {
      // Corrected endpoint: removed /:deviceId from URL
      method: "POST",
      body: JSON.stringify(dataToSend),
    });

    showAlert("Webhook test sent successfully!", "success");
    return response;
  } catch (error) {
    console.error("Error testing webhook:", error);
  }
}

// QR Code Management
async function showQRCode(deviceId) {
  currentDeviceId = deviceId;
  document.getElementById("qrModal").style.display = "block";
  await loadQRCode(deviceId);

  // Auto refresh QR code every 30 seconds
  qrInterval = setInterval(() => {
    loadQRCode(deviceId);
  }, 30000);
}

async function loadQRCode(deviceId) {
  try {
    // Backend expects body for GET /api/device/qr, so include it.
    // Note: Sending a body with GET requests is unconventional and might be stripped by some servers.
    // If this causes issues, consider changing the backend /api/device/qr to a POST endpoint.
    const dataToSend = { device_id: deviceId, apikey: API_KEY };
    const response = await apiCall(`/device/qr`, {
      // Corrected endpoint: removed /:deviceId from URL
      method: "GET", // Keep as GET to match the backend's current route definition
      body: JSON.stringify(dataToSend),
    });

    if (response.qr_code) {
      const qrContainer = document.getElementById("qrCodeContainer");
      qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
        response.qr_code
      )}" alt="QR Code" class="qr-code">`;
    } else {
      document.getElementById("qrCodeContainer").innerHTML =
        "<p>QR Code not available. Device might be already authenticated.</p>";
    }
  } catch (error) {
    document.getElementById("qrCodeContainer").innerHTML =
      "<p>Error loading QR Code. Device might be ready or there was an error.</p>";
  }
}

// UI Functions
function displayDevices(devices) {
  const grid = document.getElementById("devicesGrid");

  if (devices.length === 0) {
    grid.innerHTML =
      '<div style="text-align: center; padding: 40px; color: #666;"><h3>No devices found</h3><p>Create your first device to get started!</p></div>';
    return;
  }

  grid.innerHTML = devices
    .map(
      (device) => `
                <div class="device-card">
                    <div class="device-header">
                        <div class="device-name">${device.device_name}</div>
                        <div class="status-badge ${
                          device.is_ready
                            ? "status-ready"
                            : device.has_qr
                            ? "status-pending"
                            : "status-error"
                        }">
                            ${
                              device.is_ready
                                ? "Ready"
                                : device.has_qr
                                ? "Pending"
                                : "Error"
                            }
                        </div>
                    </div>
                    <div class="device-info">
                        <div><strong>Device ID:</strong> ${
                          device.device_id
                        }</div>
                        <div><strong>Number:</strong> ${
                          device.number || "Not connected"
                        }</div>
                        <div><strong>Battery:</strong> ${
                          device.battery ? device.battery + "%" : "N/A"
                        }</div>
                        <div><strong>Webhook:</strong> ${
                          device.webhook_url ? "✅ Active" : "❌ Not set"
                        }</div>
                        <div><strong>Auto Reply:</strong> ${
                          device.config.auto_reply
                            ? "✅ Enabled"
                            : "❌ Disabled"
                        }</div>
                    </div>
                    <div class="device-actions">
                        ${
                          !device.is_ready && device.has_qr
                            ? `<button class="btn btn-primary btn-sm" onclick="showQRCode('${device.device_id}')">📱 Show QR</button>`
                            : ""
                        }
                        ${
                          device.is_ready
                            ? `<button class="btn btn-info btn-sm" onclick="showSendMessageModal('${device.device_id}')">💬 Send Message</button>`
                            : ""
                        }
                        ${
                          device.webhook_url
                            ? `<button class="btn btn-secondary btn-sm" onclick="testWebhook('${device.device_id}')">🔗 Test Webhook</button>`
                            : ""
                        }
                        <button class="btn btn-secondary btn-sm" onclick="logoutDevice('${
                          device.device_id
                        }')">🚪 Logout</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteDevice('${
                          device.device_id
                        }')">🗑️ Delete</button>
                    </div>
                </div>
            `
    )
    .join("");
}

function updateBulkDeviceSelect(devices) {
  const select = document.getElementById("bulkDevice");
  const readyDevices = devices.filter((d) => d.is_ready);

  select.innerHTML =
    '<option value="">Select a device...</option>' +
    readyDevices
      .map(
        (device) =>
          `<option value="${device.device_id}">${device.device_name} (${device.number})</option>`
      )
      .join("");
}

async function updateStats() {
  try {
    const [statusResponse, healthResponse] = await Promise.all([
      apiCall("/status"),
      apiCall("/health"),
    ]);

    document.getElementById("totalDevices").textContent =
      statusResponse.total_devices;
    document.getElementById("readyDevices").textContent =
      statusResponse.ready_devices;
    document.getElementById("pendingDevices").textContent =
      statusResponse.pending_devices;
    document.getElementById("uptime").textContent = formatUptime(
      healthResponse.uptime
    );
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Modal Functions
function showCreateDeviceModal() {
  document.getElementById("createDeviceModal").style.display = "block";
}

function showSendMessageModal(deviceId) {
  currentDeviceId = deviceId;
  document.getElementById("sendMessageModal").style.display = "block";
}

function showBulkMessageModal() {
  document.getElementById("bulkMessageModal").style.display = "block";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";

  if (modalId === "qrModal" && qrInterval) {
    clearInterval(qrInterval);
    qrInterval = null;
  }
}

// Event Listeners
document
  .getElementById("createDeviceForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const deviceData = {
      device_name: document.getElementById("deviceName").value,
      webhook_url: document.getElementById("webhookUrl").value || null,
      auto_reply: document.getElementById("autoReply").checked,
    };

    await createDevice(deviceData);
    e.target.reset();
  });

document
  .getElementById("sendMessageForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const number = document.getElementById("phoneNumber").value;
    const message = document.getElementById("messageText").value;

    await sendMessage(currentDeviceId, number, message);
    closeModal("sendMessageModal");
    e.target.reset();
  });

document
  .getElementById("bulkMessageForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const numbers = document
      .getElementById("bulkNumbers")
      .value.split("\n")
      .filter((n) => n.trim());
    const message = document.getElementById("bulkMessage").value;
    const deviceId = document.getElementById("bulkDevice").value;

    if (!deviceId) {
      showAlert("Please select a device", "error");
      return;
    }

    showAlert(`Sending ${numbers.length} messages...`, "info");

    let successful = 0;
    let failed = 0;

    for (const number of numbers) {
      try {
        await sendMessage(deviceId, number.trim(), message);
        successful++;
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay between messages
      } catch (error) {
        failed++;
      }
    }

    showAlert(
      `Bulk message completed: ${successful} successful, ${failed} failed`,
      successful > 0 ? "success" : "error"
    );
    closeModal("bulkMessageModal");
    e.target.reset();
  });

// Close modals when clicking outside
window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
    if (qrInterval) {
      clearInterval(qrInterval);
      qrInterval = null;
    }
  }
});

// Alert Function
function showAlert(message, type = "info") {
  const alertContainer = document.getElementById("alertContainer");
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;

  alertContainer.appendChild(alertDiv);

  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}
