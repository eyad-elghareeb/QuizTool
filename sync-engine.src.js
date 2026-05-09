// sync-engine.src.js
// Core logic for Progress Synchronization (WebRTC, QR, Text)

const SyncEngine = {
    // --- Data Management ---
    exportData: function(options = { tracker: true, progress: true }) {
        const payload = { timestamp: Date.now(), data: {} };
        
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));

        for (const key of keys) {
            try {
                const val = localStorage.getItem(key);
                if (!val) continue;

                // Tracker Data (v2 only)
                if (options.tracker && key.startsWith('quiz_tracker_v2_')) {
                    payload.data[key] = JSON.parse(val);
                }
                // Tracker Index
                if (options.tracker && key === 'quiz_tracker_keys') {
                    payload.data[key] = JSON.parse(val);
                }
                // Progress Data
                if (options.progress && (key.startsWith('quiz_progress_') || key.startsWith('bank_progress_'))) {
                    payload.data[key] = JSON.parse(val);
                }
            } catch(e) { console.warn("Export skip (invalid JSON):", key); }
        }
        
        // Compress data to fit in QR or easily copy/paste
        const jsonStr = JSON.stringify(payload);
        const compressed = LZString.compressToBase64(jsonStr);
        return compressed;
    },

    importData: function(compressedStr, mode = 'merge') {
        try {
            const jsonStr = LZString.decompressFromBase64(compressedStr);
            if (!jsonStr) throw new Error("Invalid or corrupted sync data");
            
            const payload = JSON.parse(jsonStr);
            if (!payload || !payload.data) throw new Error("Invalid data format");

            this._processImport(payload.data, mode);
            return true;
        } catch (e) {
            console.error("Sync import failed:", e);
            if (window.showToast) window.showToast("Import error: " + e.message);
            return false;
        }
    },

    _processImport: function(importedData, mode) {
        // Implementation for 'merge' vs 'replace' logic
        for (const [key, importedVal] of Object.entries(importedData)) {
            if (mode === 'replace') {
                localStorage.setItem(key, JSON.stringify(importedVal));
            } else { // merge
                const existing = localStorage.getItem(key);
                if (!existing) {
                    localStorage.setItem(key, JSON.stringify(importedVal));
                    continue;
                }
                
                // For tracker data, merge questions
                if (key.startsWith('quiz_tracker_v2_')) {
                    try {
                        const existingData = JSON.parse(existing);
                        if (existingData && typeof existingData === 'object') {
                            const mergeTracker = (a, b) => {
                                const listA = Array.isArray(a) ? a : [];
                                const listB = Array.isArray(b) ? b : [];
                                
                                const remainingA = [...listA];
                                const result = [];
                                
                                listB.forEach(importedItem => {
                                    const matchIndex = remainingA.findIndex(existingItem => {
                                        // 1. Index Match (Most reliable)
                                        const hasIdxA = existingItem.idx !== undefined && existingItem.idx !== null;
                                        const hasIdxB = importedItem.idx !== undefined && importedItem.idx !== null;
                                        if (hasIdxA && hasIdxB && String(existingItem.idx) === String(importedItem.idx)) return true;

                                        // 2. Text Match (Fallback)
                                        // Only match by text if at least one is missing an index, 
                                        // AND the text is non-empty and long enough to be unique
                                        if (existingItem.text && importedItem.text && existingItem.text.trim().length > 5) {
                                            if (existingItem.text.trim() === importedItem.text.trim()) {
                                                // If one has an index and the other doesn't, it's likely a mismatch from different versions
                                                if (!hasIdxA || !hasIdxB) return true;
                                            }
                                        }
                                        return false;
                                    });

                                    if (matchIndex !== -1) {
                                        const matched = remainingA.splice(matchIndex, 1)[0];
                                        result.push(Object.assign({}, matched, importedItem));
                                    } else {
                                        result.push(importedItem);
                                    }
                                });
                                
                                return result.concat(remainingA);
                            };
                            
                            existingData.wrong = mergeTracker(existingData.wrong, importedVal.wrong);
                            existingData.flagged = mergeTracker(existingData.flagged, importedVal.flagged);
                            
                            // CRITICAL: Update derived counts so UI badges/stats don't stay stale
                            existingData.wrongCount = (existingData.wrong || []).length;
                            existingData.flaggedCount = (existingData.flagged || []).length;
                            
                            existingData.timestamp = Math.max(existingData.timestamp || 0, importedVal.timestamp || 0);
                            localStorage.setItem(key, JSON.stringify(existingData));
                        } else {
                            localStorage.setItem(key, JSON.stringify(importedVal));
                        }
                    } catch(e) {
                        localStorage.setItem(key, JSON.stringify(importedVal));
                    }
                } else if (key === 'quiz_tracker_keys') {
                    // Union of tracker key indices
                    try {
                        const existingData = JSON.parse(existing || '[]');
                        const merged = [...new Set([...existingData, ...importedVal])];
                        localStorage.setItem(key, JSON.stringify(merged));
                    } catch(e) {}
                } else if (key.startsWith('quiz_progress_') || key.startsWith('bank_progress_')) {
                    // For progress, only take the imported version if it's newer
                    try {
                        const existingData = JSON.parse(existing);
                        if (!existingData.timestamp || !importedVal.timestamp || importedVal.timestamp > existingData.timestamp) {
                            localStorage.setItem(key, JSON.stringify(importedVal));
                        }
                    } catch(e) {
                        localStorage.setItem(key, JSON.stringify(importedVal));
                    }
                } else {
                    localStorage.setItem(key, JSON.stringify(importedVal));
                }
            }
        }
        
        // Final pass: ensure all quiz_tracker_v2_ keys are in the index
        try {
            let keys = JSON.parse(localStorage.getItem('quiz_tracker_keys') || '[]');
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.startsWith('quiz_tracker_v2_')) {
                    const uid = k.replace('quiz_tracker_v2_', '');
                    if (!keys.includes(uid)) keys.push(uid);
                }
            }
            localStorage.setItem('quiz_tracker_keys', JSON.stringify(keys));
        } catch(e) {}
    },

    // --- WebRTC Core Architecture ---
    webrtc: {

        deviceId: (function() {
            let id = sessionStorage.getItem('quiztool-sync-device-id');
            if (!id) {
                id = Math.random().toString(36).substr(2, 6).toUpperCase();
                sessionStorage.setItem('quiztool-sync-device-id', id);
            }
            return id;
        })(),
        deviceName: (function() {
            let name = sessionStorage.getItem('quiztool-sync-device-name');
            if (!name) {
                const adjectives = ['Red','Blue','Gold','Swift','Calm','Bold','Wise','Keen'];
                const nouns = ['Owl','Fox','Bear','Wolf','Hawk','Lion','Stag','Lynx'];
                name = adjectives[Math.floor(Math.random()*adjectives.length)] + ' ' + nouns[Math.floor(Math.random()*nouns.length)];
                sessionStorage.setItem('quiztool-sync-device-name', name);
            }
            return name;
        })(),
        roomHash: null,
        mqttClient: null,
        peers: {}, // Remote peer RTCPeerConnections
        devices: {}, // Discovered devices
        heartbeatInterval: null,
        disconnectTimeout: null,
        _discovering: false, // Guard against async race in initDiscovery

        initDiscovery: function() {
            if (this.disconnectTimeout) {
                clearTimeout(this.disconnectTimeout);
                this.disconnectTimeout = null;
            }
            if (this.mqttClient || this._discovering) return; // Already initialized or in progress
            this._discovering = true;

            SyncEngine.ui.setStatus("Initializing discovery...");

            // 1. Get STUN Public IP as RoomHash
            this._getPublicIP((ip) => {
                console.log("Discovery IP:", ip);
                // Increment version to V2 to clear "flooded" ghost devices from V1
                this._hashString("quiztool-v2-" + ip).then(hash => {
                    this.roomHash = hash.substring(0, 8).toUpperCase();
                    SyncEngine.ui.setRoomId(this.roomHash);
                    this._connectMQTT();
                });
            });
        },

        _getPublicIP: function(callback) {
            try {
                // Try to get public IP via STUN
                const pc = new RTCPeerConnection({iceServers: [{urls: "stun:stun.l.google.com:19302"}]});
                pc.createDataChannel("");
                pc.createOffer().then(offer => pc.setLocalDescription(offer));
                
                let found = false;
                const timeout = setTimeout(() => {
                    if (!found) {
                        found = true;
                        callback("offline");
                        try { pc.close(); } catch(e) {}
                    }
                }, 2500);

                pc.onicecandidate = (e) => {
                    if (found) return;
                    if (!e.candidate) return;

                    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                    const match = ipRegex.exec(e.candidate.candidate);
                    if (match && e.candidate.type === "srflx") {
                        found = true;
                        clearTimeout(timeout);
                        callback(match[1]);
                        pc.close();
                    }
                };
            } catch(e) {
                callback("offline");
            }
        },

        _hashString: async function(str) {
            try {
                if (window.crypto && crypto.subtle) {
                    const msgBuffer = new TextEncoder().encode(str);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                }
            } catch(e) { console.warn("Crypto hash failed, using fallback"); }
            
            // Simple robust hash fallback for non-secure contexts
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(16).padStart(8, '0');
        },

        _connectMQTT: function() {
            try {
                if (!window.Paho) {
                    SyncEngine.ui.setStatus("Paho MQTT library missing.", false);
                    return;
                }
                
                SyncEngine.ui.setStatus("Connecting to signaling network...");
                
                // Use a stable public broker
                const clientId = "qt-" + (this.deviceId || "UNK") + "-" + Math.floor(Math.random()*10000);
                
                try {
                    const PahoClient = (window.Paho && Paho.MQTT) ? Paho.MQTT.Client : (window.Paho ? Paho.Client : null);
                    if (!PahoClient) throw new Error("Paho Client class not found.");
                    
                    this.mqttClient = new PahoClient("broker.emqx.io", 8084, "/mqtt", clientId);
                } catch (ce) {
                    console.error("Paho Constructor Error:", ce);
                    SyncEngine.ui.setStatus("MQTT Setup Failed: " + ce.message, false);
                    return;
                }
                
                this.mqttClient.onConnectionLost = (responseObject) => {
                    if (responseObject.errorCode !== 0) {
                        SyncEngine.ui.setStatus("Network lost. Will retry on next open.");
                        console.log("MQTT Lost:", responseObject.errorMessage);
                        // Reset so initDiscovery can re-run on next modal open
                        this.mqttClient = null;
                        this._discovering = false;
                        if (this.heartbeatInterval) {
                            clearInterval(this.heartbeatInterval);
                            this.heartbeatInterval = null;
                        }
                    }
                };
                
                this.mqttClient.onMessageArrived = (m) => this._onMqttMessage(m);
                
                const connectOptions = {
                    useSSL: true,
                    timeout: 5,
                    keepAliveInterval: 30,
                    onSuccess: () => {
                        console.log("MQTT Connected. Room:", this.roomHash);
                        this.mqttClient.subscribe("quiztool/sync/v2/" + this.roomHash + "/#");
                        this._discovering = false; // Allow re-entry if MQTT drops and reconnects
                        this.broadcastPresence();
                        this._startHeartbeat();
                        SyncEngine.ui.setStatus("Scanning for devices...");
                    },
                    onFailure: (e) => {
                        console.error("MQTT Connect Failed:", e);
                        SyncEngine.ui.setStatus("Connection failed (Internet/Firewall).", false);
                    }
                };

                this.mqttClient.connect(connectOptions);
            } catch (e) {
                console.error("MQTT Client Setup Error:", e);
                SyncEngine.ui.setStatus("Critical Error: " + e.message, false);
            }
        },

        _startHeartbeat: function() {
            if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = setInterval(() => this.broadcastPresence(), 5000);
        },

        broadcastPresence: function() {
            if (!this.mqttClient) return;
            try {
                const PahoMsg = (window.Paho && Paho.MQTT) ? Paho.MQTT.Message : (window.Paho ? Paho.Message : null);
                if (!PahoMsg) return;

                const msg = new PahoMsg(JSON.stringify({
                    type: 'presence',
                    id: this.deviceId,
                    name: this.deviceName
                }));
                msg.destinationName = "quiztool/sync/v2/" + this.roomHash + "/presence/" + this.deviceId;
                // DO NOT use retained messages for presence to avoid "ghost" devices
                this.mqttClient.send(msg);
            } catch (e) { console.warn("Presence broadcast failed:", e); }
        },

        _onMqttMessage: function(msg) {
            try {
                const payload = JSON.parse(msg.payloadString);
                
                if (payload.type === 'presence' && payload.id !== this.deviceId) {
                    this.devices[payload.id] = { name: payload.name, lastSeen: Date.now() };
                    SyncEngine.ui.updateDeviceList();
                }
                else if (payload.type === 'signal' && payload.target === this.deviceId) {
                    this._handleSignal(payload);
                }
                else if (payload.type === 'qtp-ack' && payload.target === 'all') {
                    console.log("Received QTP Ack for part:", payload.idx);
                    if (SyncEngine.ui.qrPage + 1 === parseInt(payload.idx)) {
                        SyncEngine.ui.nextQR(true); // Cycle to next part on signal
                    }
                }
                else if (payload.type === 'relay' && payload.target === this.deviceId) {
                    console.log("Received MQTT Relay Data");
                    SyncEngine.ui.setStatus("Receiving via Relay...", true);
                    if (SyncEngine.importData(payload.data, 'merge')) {
                        SyncEngine.ui.setStatus("Relay Sync complete!", true);
                        if (window.showToast) window.showToast("Sync complete (via Relay)");
                        if (window.renderQuizzes) window.renderQuizzes();
                        
                        // Bidirectional: if we received a relay but haven't sent one, send ours back
                        if (!payload.isResponse) {
                            console.log("Sending Relay response...");
                            this._sendRelay(payload.sender, SyncEngine.exportData(SyncEngine.ui._getOptions()), true);
                        }
                    } else {
                        SyncEngine.ui.setStatus("Relay data import failed.", false);
                    }
                }
            } catch(e) { console.error("MQTT Message Error:", e); }
        },

        connectToDevice: function(targetId) {
            SyncEngine.ui.setStatus("Connecting to " + (this.devices[targetId]?.name || targetId) + "...");
            
            // Close and remove any existing stale peer for this target
            if (this.peers[targetId]) {
                try { this.peers[targetId].close(); } catch(e) {}
                delete this.peers[targetId];
            }

            // Try WebRTC first
            const pc = this._createPeerConnection(targetId);
            const channel = pc.createDataChannel("sync");
            this._setupChannel(channel);

            let relayFired = false;

            // Cancel relay fallback if P2P succeeds
            pc.onconnectionstatechange = () => {
                console.log("Conn State:", pc.connectionState);
                if (pc.connectionState === 'connected') {
                    relayFired = true; // Prevent relay from firing
                    SyncEngine.ui.setStatus("P2P Established!", true);
                }
            };

            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                this._sendSignal(targetId, { sdp: offer });
            });

            // Set a timeout for Relay fallback — only fires if P2P hasn't connected
            setTimeout(() => {
                if (!relayFired && pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected') {
                    console.log("P2P hanging, falling back to MQTT Relay...");
                    SyncEngine.ui.setStatus("P2P slow, using Relay Sync...");
                    relayFired = true;
                    const opts = SyncEngine.ui._getOptions();
                    const data = SyncEngine.exportData(opts);
                    this._sendRelay(targetId, data);
                }
            }, 6000);
        },

        _createPeerConnection: function(targetId) {
            const pc = new RTCPeerConnection({
                iceServers: [
                    {urls: "stun:stun.l.google.com:19302"},
                    {urls: "stun:stun1.l.google.com:19302"},
                    {urls: "stun:stun2.l.google.com:19302"}
                ]
            });
            this.peers[targetId] = pc;

            pc.oniceconnectionstatechange = () => {
                console.log("ICE State:", pc.iceConnectionState);
                if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                    SyncEngine.ui.setStatus("P2P Failed. Use QR Sync instead.", false);
                    // Clean up failed connection
                    try { pc.close(); } catch(e) {}
                    delete SyncEngine.webrtc.peers[Object.keys(SyncEngine.webrtc.peers).find(k => SyncEngine.webrtc.peers[k] === pc)];
                }
            };

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    this._sendSignal(targetId, { ice: e.candidate });
                }
            };
            
            pc.ondatachannel = (e) => {
                console.log("Received DataChannel");
                if (window.showToast) window.showToast("📱 Sync connection from " + (this.devices[targetId]?.name || "another device"));
                this._setupChannel(e.channel);
            };
            
            return pc;
        },

        _handleSignal: function(payload) {
            const fromId = payload.from;
            let pc = this.peers[fromId];

            if (!pc) {
                pc = this._createPeerConnection(fromId);
            }

            if (payload.sdp) {
                pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
                    if (payload.sdp.type === 'offer') {
                        SyncEngine.ui.setStatus("Incoming connection from " + (this.devices[fromId]?.name || fromId) + "...");
                        pc.createAnswer().then(answer => {
                            pc.setLocalDescription(answer);
                            this._sendSignal(fromId, { sdp: answer });
                        });
                    }
                });
            } else if (payload.ice) {
                pc.addIceCandidate(new RTCIceCandidate(payload.ice)).catch(e => {});
            }
        },

        _sendSignal: function(targetId, data) {
            if (!this.mqttClient) return;
            try {
                const PahoMsg = (window.Paho && Paho.MQTT) ? Paho.MQTT.Message : (window.Paho ? Paho.Message : null);
                const msg = new PahoMsg(JSON.stringify(Object.assign({ type: 'signal', from: this.deviceId, target: targetId }, data)));
                msg.destinationName = "quiztool/sync/v2/" + this.roomHash + "/signal/" + targetId;
                this.mqttClient.send(msg);
            } catch (e) { console.error("Signal send failed:", e); }
        },

        _sendRelay: function(targetId, data, isResponse = false) {
            if (!this.mqttClient) return;
            try {
                const PahoMsg = (window.Paho && Paho.MQTT) ? Paho.MQTT.Message : (window.Paho ? Paho.Message : null);
                
                // Alert if payload is very large (> 128KB)
                if (data.length > 131072) {
                    console.warn("Relay payload very large:", data.length);
                    SyncEngine.ui.setStatus("Large data: Relay may be slow...");
                }

                const msg = new PahoMsg(JSON.stringify({
                    type: 'relay',
                    sender: this.deviceId,
                    target: targetId,
                    data: data,
                    isResponse: isResponse
                }));
                msg.destinationName = "quiztool/sync/v2/" + this.roomHash + "/relay/" + targetId;
                this.mqttClient.send(msg);
                if (!isResponse) SyncEngine.ui.setStatus("Sync sent via Relay!", true);
            } catch (e) { console.error("Relay failed:", e); }
        },

        _setupChannel: function(channel) {
            channel.onopen = () => {
                console.log("DataChannel Open!");
                SyncEngine.ui.setStatus("Connected! Transferring data...", true);
                const opts = SyncEngine.ui._getOptions();
                const data = SyncEngine.exportData(opts);
                channel.send(data);
                SyncEngine.ui.setStatus("Data sent successfully!", true);
            };
            channel.onmessage = (e) => {
                console.log("Data Received (" + e.data.length + " bytes)");
                SyncEngine.ui.setStatus("Receiving data...", true);
                const success = SyncEngine.importData(e.data, 'merge');
                if (success) {
                    SyncEngine.ui.setStatus("Data received and merged successfully!", true);
                    if (window.showToast) window.showToast("P2P Sync complete!");
                    if (window.renderQuizzes) window.renderQuizzes();
                } else {
                    SyncEngine.ui.setStatus("Failed to import received data.", false);
                }
            };
        }
    },

    // --- UI Implementation ---
    ui: {
        modalEl: null,
        scanner: null,
        _qrTimer: null,
        _qrInstance: null,
        _cameras: [],
        _currentCameraIndex: 0,
        _useFront: false,
        _scanChunks: {},
        _scanTotal: 0,

        _createModalHTML: function() {
            return `
            <div class="dash-overlay" id="sync-dashboard">
                <div class="dash-modal" style="max-width: 580px;">
                    <div class="dash-header">
                        <h2>🔄 Sync Progress</h2>
                        <button class="dash-close-btn" onclick="SyncEngine.ui.closeModal()">✕</button>
                    </div>
                    
                    <div class="dash-scope-bar" style="display:flex; overflow-x:auto;">
                        <button class="dash-scope-tab active" id="sync-tab-btn-webrtc" onclick="SyncEngine.ui.switchTab('webrtc')">📡 Nearby Devices</button>
                        <button class="dash-scope-tab" id="sync-tab-btn-qr" onclick="SyncEngine.ui.switchTab('qr')">📷 QR Sync</button>
                        <button class="dash-scope-tab" id="sync-tab-btn-text" onclick="SyncEngine.ui.switchTab('text')">Copy/Paste</button>
                        <button class="dash-scope-tab" id="sync-tab-btn-file" onclick="SyncEngine.ui.switchTab('file')">File</button>
                    </div>

                    <div class="dash-scope-bar" style="padding: 0.6rem 1.25rem; font-size: 0.85rem; color: var(--text-muted); background: var(--surface2); border-bottom: 1px solid var(--border);">
                        <span style="margin-right: 15px; font-weight: 600; text-transform: uppercase; font-size: 0.7rem;">Sync Scope:</span>
                        <label style="margin-right: 15px; cursor:pointer;"><input type="checkbox" id="sync-scope-tracker" checked style="accent-color: var(--accent);"> Tracker Data</label>
                        <label style="cursor:pointer;"><input type="checkbox" id="sync-scope-progress" checked style="accent-color: var(--accent);"> Active Progress</label>
                    </div>

                    <div class="dash-body" style="min-height: 280px; position: relative;">
                        <div id="sync-tab-webrtc" style="display: block; overflow: hidden;">
                            <div style="text-align: center; margin-bottom: 1.5rem;">
                                <div id="sync-webrtc-radar-container" style="display: inline-block; padding: 10px; overflow: visible;">
                                    <div id="sync-webrtc-radar" style="font-size: 2.5rem; animation: pulse 2s infinite; transform-origin: center;">📡</div>
                                </div>
                                <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.5rem;">Looking for devices on the same network...</p>
                                <div style="display: flex; justify-content: center; gap: 15px; margin-top: 4px;">
                                    <div id="sync-room-id" style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.6;">Room ID: Identifying...</div>
                                    <div id="sync-local-name" style="font-size: 0.7rem; color: var(--accent); font-weight: 600; opacity: 0.8;">My Name: ...</div>
                                </div>
                            </div>
                            <div id="sync-webrtc-device-list" style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 200px; overflow-y: auto;">
                                <!-- Devices populated dynamically -->
                            </div>
                            <div id="sync-webrtc-status" style="margin-top: 1rem; text-align: center; font-size: 0.8rem; font-weight: 600; min-height: 1.2em;"></div>
                            <style>
                                @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                                .device-item { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.25rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; transition: border-color 0.2s; }
                                .device-item:hover { border-color: var(--accent); }
                                .device-name { font-weight: 600; font-size: 1rem; color: var(--text); }
                            </style>
                        </div>

                        <!-- QR Sync Tab -->
                        <div id="sync-tab-qr" style="display: none; text-align: center;">
                            <div id="sync-qr-export-section">
                                <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.95rem;">Scan this code from another device.</p>
                                <div id="sync-qr-container" style="display: inline-block; padding: 1.25rem; background: #fff; border-radius: 12px; margin-bottom: 1rem;"></div>
                                <div id="sync-qr-pagination" style="margin-top: 10px; font-size: 0.85rem; display: none; margin-bottom: 15px;">
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.prevQR()" style="padding: 0.3rem 0.6rem;">&lt;</button>
                                    <span id="sync-qr-page-info" style="margin: 0 10px; font-weight: 600;">1 / 1</span>
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.nextQR()" style="padding: 0.3rem 0.6rem;">&gt;</button>
                                </div>
                                <div style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.toggleQRScanner(true)">📷 Scan Another Device</button>
                                </div>
                            </div>
                            
                            <div id="sync-qr-scan-section" style="display: none;">
                                <p style="margin-bottom: 1rem; color: var(--text-muted); font-size: 0.95rem;">Point your camera at a QR code.</p>
                                <div id="sync-reader" style="width: 100%; max-width: 320px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); position: relative;"></div>
                                <div id="sync-camera-controls" style="margin-top: 10px; display: none;">
                                    <button class="btn-dash-action" id="sync-switch-camera-btn" onclick="SyncEngine.ui.switchCamera()" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">🔄 Switch Camera</button>
                                </div>
                                <div id="sync-scan-progress" style="margin-top: 1.25rem; font-weight: 600; font-size: 0.9rem; color: var(--accent); display: none;">
                                    Scanning: <span id="sync-scan-count">0</span> / <span id="sync-scan-total">?</span> parts
                                    <div style="width: 100%; height: 6px; background: var(--surface2); border-radius: 3px; margin-top: 8px; overflow: hidden; border: 1px solid var(--border);">
                                        <div id="sync-scan-bar" style="width: 0%; height: 100%; background: var(--accent); transition: width 0.3s ease;"></div>
                                    </div>
                                </div>
                                <div style="margin-top: 1.5rem;">
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.toggleQRScanner(false)">🔙 Show My Code</button>
                                </div>
                            </div>
                        </div>

                        <!-- Text Tab -->
                        <div id="sync-tab-text" style="display: none;">
                            <p style="margin-bottom: 0.5rem; font-weight: 600; font-size: 0.95rem; color: var(--text);">Export Data</p>
                            <textarea id="sync-export-text" readonly style="width: 100%; height: 75px; margin-bottom: 1.25rem; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; font-family: monospace; font-size: 0.85rem;" onclick="this.select(); document.execCommand('copy'); if(window.showToast) window.showToast('Copied to clipboard!');"></textarea>
                            <p style="margin-bottom: 0.5rem; font-weight: 600; font-size: 0.95rem; color: var(--text);">Import Data</p>
                            <textarea id="sync-import-text" placeholder="Paste sync data here..." style="width: 100%; height: 75px; background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; font-family: monospace; font-size: 0.85rem;"></textarea>
                            <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem;">
                                <button class="btn-dash-action" onclick="SyncEngine.ui.importText('merge')">Merge</button>
                                <button class="btn-dash-action btn-dash-danger" onclick="SyncEngine.ui.importText('replace')">Replace</button>
                            </div>
                        </div>

                        <!-- File Tab -->
                        <div id="sync-tab-file" style="display: none; text-align: center;">
                            <div style="padding: 1.5rem; background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 1rem;">
                                <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📥</div>
                                <p style="font-weight: 600; margin-bottom: 0.25rem; color: var(--text);">Backup Progress</p>
                                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">Save your current progress offline to a secure file.</p>
                                <button class="btn-dash-action" onclick="SyncEngine.ui.downloadBackup()">Download Backup</button>
                            </div>
                            
                            <div style="padding: 1.5rem; background: var(--surface2); border: 1px dashed var(--border); border-radius: 12px;">
                                <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📁</div>
                                <p style="font-weight: 600; margin-bottom: 0.25rem; color: var(--text);">Restore Progress</p>
                                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">Select a backup file to securely load your progress.</p>
                                <input type="file" id="sync-file-input" accept=".quizbackup,.txt,.json" style="display: none;" onchange="SyncEngine.ui.handleFileUpload(event)">
                                <button class="btn-dash-action" onclick="document.getElementById('sync-file-input').click()">Select File</button>
                                <div id="sync-file-restore-options" style="display: none; margin-top: 1.25rem; gap: 0.75rem; justify-content: center;">
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.confirmFileRestore('merge')">Merge File</button>
                                    <button class="btn-dash-action btn-dash-danger" onclick="SyncEngine.ui.confirmFileRestore('replace')">Replace All</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        },

        openModal: function() {
            if (!this.modalEl) {
                const wrap = document.createElement('div');
                wrap.innerHTML = this._createModalHTML();
                this.modalEl = wrap.firstElementChild;
                document.body.appendChild(this.modalEl);
            }
            this.modalEl.classList.add('open');
            const activeTab = document.querySelector('.dash-scope-tab.active')?.id?.replace('sync-tab-btn-', '') || 'webrtc';
            this.switchTab(activeTab);
            
            // Populate export text area
            this._refreshExportText();
        },

        closeModal: function() {
            if (this.modalEl) {
                this.modalEl.classList.remove('open');
                this.stopScanner();
                this.stopQRAnimation();
                this._scanChunks = {}; // Clear any partial QR scans
            }
            // Stop heartbeat when modal is closed to avoid wasted MQTT traffic
            if (SyncEngine.webrtc.heartbeatInterval) {
                clearInterval(SyncEngine.webrtc.heartbeatInterval);
                SyncEngine.webrtc.heartbeatInterval = null;
            }

            // Auto-disconnect MQTT after 60s of inactivity to save battery/data
            if (SyncEngine.webrtc.mqttClient) {
                if (SyncEngine.webrtc.disconnectTimeout) clearTimeout(SyncEngine.webrtc.disconnectTimeout);
                SyncEngine.webrtc.disconnectTimeout = setTimeout(() => {
                    if (SyncEngine.webrtc.mqttClient) {
                        console.log("Auto-disconnecting MQTT due to inactivity");
                        try { SyncEngine.webrtc.mqttClient.disconnect(); } catch(e) {}
                        SyncEngine.webrtc.mqttClient = null;
                        SyncEngine.webrtc._discovering = false;
                    }
                    SyncEngine.webrtc.disconnectTimeout = null;
                }, 60000);
            }
        },

        switchTab: function(tabId) {
            this.stopScanner(); // Always stop scanner when leaving tab
            this.stopQRAnimation(); // Always stop animation when leaving tab
            
            ['webrtc', 'qr', 'text', 'file'].forEach(id => {
                const btn = document.getElementById('sync-tab-btn-' + id);
                const content = document.getElementById('sync-tab-' + id);
                if (btn) {
                    if (id === tabId) btn.classList.add('active');
                    else btn.classList.remove('active');
                }
                if (content) content.style.display = (id === tabId) ? 'block' : 'none';
            });

            if (tabId === 'qr') {
                this._scanChunks = {}; // Clear stale partial scans on tab switch
                this.toggleQRScanner(false); // Default to export
                this.renderQR();
                this.startQRAnimation();
            }
            if (tabId === 'text') this._refreshExportText();
            if (tabId === 'webrtc') {
                SyncEngine.webrtc.initDiscovery();
                // If already connected (e.g. modal re-opened), ensure heartbeat is running
                if (SyncEngine.webrtc.mqttClient) {
                    SyncEngine.webrtc.broadcastPresence(); // Announce immediately
                    SyncEngine.webrtc._startHeartbeat();
                }
                this.updateDeviceList();
            }
            if (tabId === 'file') document.getElementById('sync-file-restore-options').style.display = 'none';
        },

        toggleQRScanner: function(show) {
            const exportSec = document.getElementById('sync-qr-export-section');
            const scanSec = document.getElementById('sync-qr-scan-section');
            if (show) {
                exportSec.style.display = 'none';
                scanSec.style.display = 'block';
                this.startScanner();
            } else {
                this.stopScanner();
                exportSec.style.display = 'block';
                scanSec.style.display = 'none';
            }
        },

        updateDeviceList: function() {
            const listEl = document.getElementById('sync-webrtc-device-list');
            if (!listEl) return;
            
            const now = Date.now();
            let html = '';
            let count = 0;
            
            for (const id in SyncEngine.webrtc.devices) {
                const dev = SyncEngine.webrtc.devices[id];
                // Be more aggressive with clearing old devices
                if (now - dev.lastSeen > 15000) {
                    delete SyncEngine.webrtc.devices[id];
                    continue;
                }
                count++;
                html += `
                <div class="device-item">
                    <div class="device-info">
                        <div class="device-name">📱 ${dev.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Local Network Device</div>
                    </div>
                    <button class="btn-dash-action" onclick="SyncEngine.webrtc.connectToDevice('${id}')">Sync</button>
                </div>`;
            }
            
            if (count === 0) {
                html = `<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1.5rem 1rem;">No devices found. Ensure other devices have the Sync modal open and are connected to the internet on the same WiFi network.</p>`;
            }
            
            listEl.innerHTML = html;
        },

        setStatus: function(msg, isSuccess = null) {
            const el = document.getElementById('sync-webrtc-status');
            if (!el) return;
            el.innerText = msg;
            if (isSuccess === true) el.style.color = 'var(--correct)';
            else if (isSuccess === false) el.style.color = 'var(--wrong)';
            else el.style.color = 'var(--accent)';
        },

        setRoomId: function(id) {
            const el = document.getElementById('sync-room-id');
            if (el) el.innerText = "Room ID: " + id;
            const nameEl = document.getElementById('sync-local-name');
            if (nameEl) nameEl.innerText = "My Name: " + SyncEngine.webrtc.deviceName;
        },

        _getOptions: function() {
            const trackerEl  = document.getElementById('sync-scope-tracker');
            const progressEl = document.getElementById('sync-scope-progress');
            return {
                tracker:  trackerEl  ? trackerEl.checked  : true,
                progress: progressEl ? progressEl.checked : true
            };
        },

        _refreshExportText: function() {
            const el = document.getElementById('sync-export-text');
            if (el) el.value = SyncEngine.exportData(this._getOptions());
        },

        copyText: function() {
            const el = document.getElementById('sync-export-text');
            el.select();
            document.execCommand('copy');
            if (window.showToast) window.showToast("Copied to clipboard!");
        },

        importText: function(mode) {
            const data = document.getElementById('sync-import-text').value.trim();
            if (!data) return;
            if (SyncEngine.importData(data, mode)) {
                if (window.showToast) window.showToast("Sync successful!");
                this.closeModal();
                if (window.renderQuizzes) window.renderQuizzes();
            } else {
                if (window.showToast) window.showToast("Import failed: Invalid or corrupted code.");
            }
        },

        downloadBackup: function() {
            const data = SyncEngine.exportData(this._getOptions());
            const blob = new Blob([data], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `QuizProgress_Backup_${date}.quizbackup`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        _pendingFileContent: null,

        handleFileUpload: function(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                this._pendingFileContent = e.target.result;
                document.getElementById('sync-file-restore-options').style.display = 'flex';
                if (window.showToast) window.showToast("File loaded. Choose restore method.");
            };
            reader.readAsText(file);
            // Reset input so the same file can be selected again
            event.target.value = '';
        },

        confirmFileRestore: function(mode) {
            if (!this._pendingFileContent) return;
            if (SyncEngine.importData(this._pendingFileContent, mode)) {
                if (window.showToast) window.showToast("File Sync successful!");
                this.closeModal();
                if (window.renderQuizzes) window.renderQuizzes();
            } else {
                if (window.showToast) window.showToast("Import failed: File may be corrupted or invalid.");
            }
            this._pendingFileContent = null;
            document.getElementById('sync-file-restore-options').style.display = 'none';
        },

        qrChunks: [],
        qrPage: 0,

        renderQR: function() {
            const container = document.getElementById('sync-qr-container');
            const pageInfo = document.getElementById('sync-qr-page-info');
            const pagination = document.getElementById('sync-qr-pagination');
            
            if (!container) return;
            container.innerHTML = '';
            const fullData = SyncEngine.exportData(this._getOptions());
            
            // Lower Density: 700 chars per QR is extremely easy for most scanners to focus/decode
            const CHUNK_SIZE = 700;
            this._qrInstance = null; // Reset instance on new data
            if (fullData.length <= CHUNK_SIZE) {
                // Single QR — only use when data fits comfortably
                this.qrChunks = [fullData];
                if (pagination) pagination.style.display = 'none';
            } else {
                this.qrChunks = [];
                const total = Math.ceil(fullData.length / CHUNK_SIZE);
                for (let i = 0; i < total; i++) {
                    const chunk = fullData.substr(i * CHUNK_SIZE, CHUNK_SIZE);
                    // Optimized compact prefix
                    this.qrChunks.push(`qtp:${i+1}:${total}:${chunk}`);
                }
                if (pagination) pagination.style.display = 'block';
                this.qrPage = 0;
            }

            this._drawCurrentQR();
        },

        startQRAnimation: function() {
            this.stopQRAnimation();
            if (this.qrChunks.length <= 1) return;
            // No auto-cycling. We wait for MQTT signals (qtp-ack) or manual navigation.
        },

        stopQRAnimation: function() {
            // No timer to stop
        },

        _drawCurrentQR: function() {
            const container = document.getElementById('sync-qr-container');
            const pageInfo = document.getElementById('sync-qr-page-info');
            if (!container) return;
            
            const data = this.qrChunks[this.qrPage];
            if (pageInfo) pageInfo.innerText = `${this.qrPage + 1} / ${this.qrChunks.length}`;

            try {
                if (!this._qrInstance) {
                    container.innerHTML = '';
                    this._qrInstance = new QRCode(container, {
                        text: data,
                        width: 256,
                        height: 256,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.L
                    });
                } else {
                    this._qrInstance.makeCode(data);
                }
            } catch (e) {
                container.innerHTML = '<span style="color:red">QR Generation failed.</span>';
            }
        },

        nextQR: function(fromSignal = false) {
            if (this.qrChunks.length <= 1) return;
            
            this.qrPage = (this.qrPage + 1) % this.qrChunks.length;
            this._drawCurrentQR();
        },

        prevQR: function() {
            if (this.qrPage > 0) {
                this.qrPage--;
                this._drawCurrentQR();
            }
        },

        _scanChunks: {}, // Storage for incoming partial scans

        _updateScanProgress: function(current, total) {
            const progSec = document.getElementById('sync-scan-progress');
            const countEl = document.getElementById('sync-scan-count');
            const totalEl = document.getElementById('sync-scan-total');
            const barEl = document.getElementById('sync-scan-bar');
            
            if (progSec) progSec.style.display = 'block';
            if (countEl) countEl.innerText = current;
            if (totalEl) totalEl.innerText = total;
            if (barEl) barEl.style.width = (current / total * 100) + '%';
        },

        switchCamera: function() {
            if (this._cameras && this._cameras.length > 1) {
                this._currentCameraIndex = (this._currentCameraIndex + 1) % this._cameras.length;
                this._useFront = false;
            } else {
                // Mobile Fallback: if getCameras() returned nothing, toggle between front/back
                this._useFront = !this._useFront;
            }
            this.stopScanner();
            this.startScanner();
        },



        startScanner: function() {
            if (this.scanner) return;
            
            const readerEl = document.getElementById('sync-reader');
            const switchBtn = document.getElementById('sync-camera-controls');
            if (!readerEl) return;

            // Secure Context Check
            if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                readerEl.innerHTML = `<div style="padding: 2rem 1rem; color: var(--wrong);">⚠️ Camera requires HTTPS. Use Copy/Paste.</div>`;
                return;
            }

            // ALWAYS show the switch button on mobile instantly (before any promises resolve/reject)
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (switchBtn && isMobile) {
                switchBtn.style.display = 'block';
            }

            const startWithCamera = (cameraIdOrConfig) => {
                if (this.scanner) {
                    this.scanner.stop().then(() => {
                        this.scanner = null;
                        this.startScanner(); 
                    }).catch(() => {});
                    return;
                }
                
                this.scanner = new Html5Qrcode("sync-reader");
                this.scanner.start(
                    cameraIdOrConfig,
                    { fps: 15, qrbox: { width: 250, height: 250 } },
                    (decodedText) => {
                        if (decodedText.startsWith('qtp:')) {
                            const parts = decodedText.split(':');
                            const idx = parts[1];
                            const total = parts[2];
                            const data = parts.slice(3).join(':');
                            if (!this._scanChunks[total]) this._scanChunks[total] = {};
                            this._scanChunks[total][idx] = data;
                            const currentCount = Object.keys(this._scanChunks[total]).length;
                            this._updateScanProgress(currentCount, total);
                            
                            if (SyncEngine.webrtc.mqttClient && SyncEngine.webrtc.roomHash) {
                                try {
                                    const PahoMsg = (window.Paho && Paho.MQTT) ? Paho.MQTT.Message : (window.Paho ? Paho.Message : null);
                                    const ack = new PahoMsg(JSON.stringify({ type: 'qtp-ack', idx: idx, total: total, target: 'all' }));
                                    ack.destinationName = "quiztool/sync/v2/" + SyncEngine.webrtc.roomHash + "/signal/all";
                                    SyncEngine.webrtc.mqttClient.send(ack);
                                } catch(e) {}
                            }

                            if (currentCount >= parseInt(total)) {
                                let full = '';
                                for (let i = 1; i <= parseInt(total); i++) full += (this._scanChunks[total][String(i)] || '');
                                delete this._scanChunks[total];
                                this.stopScanner();
                                if (SyncEngine.importData(full, 'merge')) {
                                    if (window.showToast) window.showToast("Multi-part QR Sync complete!");
                                    this.closeModal();
                                }
                            }
                        } else {
                            this.stopScanner();
                            if (SyncEngine.importData(decodedText, 'merge')) {
                                if (window.showToast) window.showToast("QR Scan Sync successful!");
                                this.closeModal();
                            }
                        }
                    },
                    (errorMessage) => {}
                ).then(() => {
                    // SUCCESS: We have permission. Rescan cameras.
                    Html5Qrcode.getCameras().then(cameras => {
                        this._cameras = cameras || [];
                        if (switchBtn && (isMobile || this._cameras.length > 1)) {
                            switchBtn.style.display = 'block';
                        }
                    }).catch(() => {});
                }).catch(err => {
                    console.error("Scanner start error:", err);
                    readerEl.innerHTML = `<div style="padding: 1rem; color: var(--wrong);">Scanner error: ${err}</div>`;
                });
            };

            // If we manually toggled to front via generic fallback, force it.
            if (this._useFront) {
                startWithCamera({ facingMode: "user" });
                return;
            }

            // If we have a cached populated list of cameras (from previous permission grant)
            if (this._cameras && this._cameras.length > 0) {
                if (this._currentCameraIndex >= this._cameras.length) this._currentCameraIndex = 0;
                startWithCamera(this._cameras[this._currentCameraIndex].id);
                return;
            }

            // Otherwise, attempt to get cameras (might fail if no permission yet)
            Html5Qrcode.getCameras().then(cameras => {
                this._cameras = cameras || [];
                
                if (switchBtn && (isMobile || this._cameras.length > 1)) {
                    switchBtn.style.display = 'block';
                }

                if (this._cameras.length > 0) {
                    let bestIdx = -1;
                    if (this._cameras.length > 1 && this._currentCameraIndex === 0) {
                        bestIdx = this._cameras.findIndex(c => {
                            const l = c.label.toLowerCase();
                            return (l.includes('back') || l.includes('rear') || l.includes('environment')) && 
                                   !l.includes('wide') && !l.includes('ultra');
                        });
                        if (bestIdx === -1) {
                            bestIdx = this._cameras.findIndex(c => {
                                const l = c.label.toLowerCase();
                                return l.includes('back') || l.includes('rear') || l.includes('environment');
                            });
                        }
                        if (bestIdx !== -1) {
                            this._currentCameraIndex = bestIdx;
                        }
                    }
                    
                    startWithCamera(this._cameras[this._currentCameraIndex].id);
                } else {
                    startWithCamera({ facingMode: "environment" });
                }
            }).catch(err => {
                console.warn("getCameras failed, using facingMode fallback", err);
                startWithCamera({ facingMode: "environment" });
            });
        },

        stopScanner: function() {
            if (this.scanner) {
                try {
                    this.scanner.stop().catch(e => {});
                    this.scanner.clear();
                } catch(e) {}
                this.scanner = null;
            }
        }
    }
};

window.SyncEngine = SyncEngine;
