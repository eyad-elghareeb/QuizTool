// sync-engine.src.js
// Core logic for Progress Synchronization (WebRTC, QR, Text)
// QRCode.js and Html5Qrcode are lazy-loaded from CDN when needed.

const SyncEngine = {
    // --- Library Loading (CDN Lazy-Load) ---
    _libLoaded: {},
    _libQueue: {},

    _loadScript: function(url, globalName) {
        return new Promise((resolve, reject) => {
            if (this._libLoaded[url]) {
                resolve(window[globalName]);
                return;
            }
            if (this._libQueue[url]) {
                this._libQueue[url].push({ resolve, reject });
                return;
            }
            this._libQueue[url] = [{ resolve, reject }];
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => {
                this._libLoaded[url] = true;
                const queue = this._libQueue[url] || [];
                delete this._libQueue[url];
                queue.forEach(q => q.resolve(window[globalName]));
            };
            script.onerror = () => {
                const queue = this._libQueue[url] || [];
                delete this._libQueue[url];
                queue.forEach(q => q.reject(new Error('Failed to load: ' + url)));
            };
            document.head.appendChild(script);
        });
    },

    _ensureQRCode: function() {
        return this._loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
            'QRCode'
        );
    },

    _ensureHtml5Qrcode: function() {
        return this._loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
            'Html5Qrcode'
        );
    },

    // --- Trusted Devices (persisted in localStorage) ---
    _getTrustedDevices: function() {
        try { return JSON.parse(localStorage.getItem('quiztool_trusted_devices') || '[]'); } catch(e) { return []; }
    },
    _addTrustedDevice: function(deviceId, deviceName) {
        const trusted = this._getTrustedDevices();
        if (!trusted.find(d => d.id === deviceId)) {
            trusted.push({ id: deviceId, name: deviceName, trustedAt: Date.now() });
            localStorage.setItem('quiztool_trusted_devices', JSON.stringify(trusted));
        }
    },
    _removeTrustedDevice: function(deviceId) {
        const trusted = this._getTrustedDevices().filter(d => d.id !== deviceId);
        localStorage.setItem('quiztool_trusted_devices', JSON.stringify(trusted));
    },
    _isTrustedDevice: function(deviceId) {
        return this._getTrustedDevices().some(d => d.id === deviceId);
    },

    // --- Data Management ---
    exportData: function(options = { tracker: true, progress: true }) {
        const payload = { timestamp: Date.now(), senderName: SyncEngine.webrtc.deviceName, data: {} };
        
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));

        const subjectSet = new Set(options.subjects || []);

        for (const key of keys) {
            try {
                const val = localStorage.getItem(key);
                if (!val) continue;

                // Tracker Data (v2 only)
                if (options.tracker && key.startsWith('quiz_tracker_v2_')) {
                    if (subjectSet.size > 0) {
                        const uid = key.replace('quiz_tracker_v2_', '');
                        if (!subjectSet.has(uid)) continue;
                    }
                    payload.data[key] = JSON.parse(val);
                }
                // Tracker Index
                if (options.tracker && key === 'quiz_tracker_keys') {
                    payload.data[key] = JSON.parse(val);
                }
                // Progress Data
                if (options.progress && (key.startsWith('quiz_progress_') || key.startsWith('bank_progress_'))) {
                    if (subjectSet.size > 0) {
                        let matched = false;
                        for (const subj of subjectSet) { if (key.includes(subj)) { matched = true; break; } }
                        if (!matched) continue;
                    }
                    payload.data[key] = JSON.parse(val);
                }
            } catch(e) { console.warn("Export skip (invalid JSON):", key); }
        }
        
        // Compress data to fit in QR or easily copy/paste
        const jsonStr = JSON.stringify(payload);
        const compressed = LZString.compressToBase64(jsonStr);
        return compressed;
    },

    _previewImportData: function(compressedStr) {
        try {
            const jsonStr = LZString.decompressFromBase64(compressedStr);
            if (!jsonStr) return null;
            const payload = JSON.parse(jsonStr);
            if (!payload || !payload.data) return null;
            const summary = { senderName: payload.senderName || 'Unknown', trackerCount: 0, progressCount: 0, subjects: [] };
            const subjectNames = {};
            for (const key of Object.keys(payload.data)) {
                if (key.startsWith('quiz_tracker_v2_')) {
                    summary.trackerCount++;
                    const uid = key.replace('quiz_tracker_v2_', '');
                    try {
                        const d = payload.data[key];
                        subjectNames[uid] = { name: d.title || d.name || uid, wrong: (d.wrong||[]).length, flagged: (d.flagged||[]).length };
                    } catch(e) { subjectNames[uid] = { name: uid, wrong: 0, flagged: 0 }; }
                }
                if (key.startsWith('quiz_progress_') || key.startsWith('bank_progress_')) summary.progressCount++;
            }
            summary.subjects = Object.values(subjectNames);
            return summary;
        } catch(e) { return null; }
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
                                        if (existingItem.text && importedItem.text && existingItem.text.trim().length > 5) {
                                            if (existingItem.text.trim() === importedItem.text.trim()) {
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
        _pendingSyncs: {}, // deviceId -> { type, payload/data }
        pullOnly: (function() { try { return localStorage.getItem('quiztool_sync_pull_only') === 'true'; } catch(e) { return false; } })(),

        setPullOnly: function(val) {
            this.pullOnly = val;
            try { localStorage.setItem('quiztool_sync_pull_only', val ? 'true' : 'false'); } catch(e) {}
            const toggle = document.getElementById('sync-pull-only-toggle');
            if (toggle) toggle.checked = val;
            SyncEngine.ui.updateDeviceList();
            this.broadcastPresence();
        },

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
            
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
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
                        this._discovering = false;
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
                    name: this.deviceName,
                    pullOnly: this.pullOnly
                }));
                msg.destinationName = "quiztool/sync/v2/" + this.roomHash + "/presence/" + this.deviceId;
                this.mqttClient.send(msg);
            } catch (e) { console.warn("Presence broadcast failed:", e); }
        },

        _onMqttMessage: function(msg) {
            try {
                const payload = JSON.parse(msg.payloadString);
                
                if (payload.type === 'presence' && payload.id !== this.deviceId) {
                    this.devices[payload.id] = { name: payload.name, lastSeen: Date.now(), pullOnly: !!payload.pullOnly };
                    SyncEngine.ui.updateDeviceList();
                }
                else if (payload.type === 'signal' && payload.target === this.deviceId) {
                    this._handleSignal(payload);
                }
                else if (payload.type === 'qtp-ack' && payload.target === 'all') {
                    console.log("Received QTP Ack for part:", payload.idx);
                    if (SyncEngine.ui.qrPage + 1 === parseInt(payload.idx)) {
                        SyncEngine.ui.nextQR(true);
                    }
                }
                else if (payload.type === 'relay' && payload.target === this.deviceId) {
                    console.log("Received MQTT Relay Data");
                    var fromId = payload.sender;
                    if (SyncEngine._isTrustedDevice(fromId)) {
                        this._importRelay(payload);
                    } else {
                        var preview = SyncEngine._previewImportData(payload.data);
                        this._pendingSyncs[fromId] = { type: 'relay', payload: payload };
                        SyncEngine.ui.showConfirmToast(fromId, this.devices[fromId]?.name || 'Unknown', preview);
                    }
                }
            } catch(e) { console.error("MQTT Message Error:", e); }
        },

        _importRelay: function(payload) {
            SyncEngine.ui.setStatus("Receiving via Relay...", true);
            if (SyncEngine.importData(payload.data, 'merge')) {
                SyncEngine.ui.setStatus("Relay Sync complete!", true);
                if (window.showToast) window.showToast("Sync complete (via Relay)");
                if (window.renderQuizzes) window.renderQuizzes();
                if (!payload.isResponse && !this.pullOnly) {
                    this._sendRelay(payload.sender, SyncEngine.exportData(SyncEngine.ui._getOptions()), true);
                }
            } else {
                SyncEngine.ui.setStatus("Relay data import failed.", false);
            }
        },

        acceptSync: function(fromId, trustAlways) {
            var pending = this._pendingSyncs[fromId];
            if (!pending) return;
            if (trustAlways) {
                SyncEngine._addTrustedDevice(fromId, this.devices[fromId]?.name || 'Unknown');
                SyncEngine.ui.updateDeviceList();
            }
            if (pending.type === 'relay') {
                this._importRelay(pending.payload);
            } else if (pending.type === 'p2p-data') {
                SyncEngine.ui.setStatus("Receiving data...", true);
                if (SyncEngine.importData(pending.data, 'merge')) {
                    SyncEngine.ui.setStatus("Data received and merged!", true);
                    if (window.showToast) window.showToast("P2P Sync complete!");
                    if (window.renderQuizzes) window.renderQuizzes();
                } else { SyncEngine.ui.setStatus("Import failed.", false); }
            }
            delete this._pendingSyncs[fromId];
            SyncEngine.ui.hideConfirmToast(fromId);
        },

        declineSync: function(fromId) {
            delete this._pendingSyncs[fromId];
            SyncEngine.ui.hideConfirmToast(fromId);
            SyncEngine.ui.setStatus("Sync declined.", false);
        },

        connectToDevice: function(targetId) {
            if (this.pullOnly) {
                if (window.showToast) window.showToast("Pull-Only mode: You can only receive data.");
                return;
            }
            SyncEngine.ui.setStatus("Connecting to " + (this.devices[targetId]?.name || targetId) + "...");
            
            if (this.peers[targetId]) {
                try { this.peers[targetId].close(); } catch(e) {}
                delete this.peers[targetId];
            }

            const pc = this._createPeerConnection(targetId);
            const channel = pc.createDataChannel("sync");
            this._setupChannel(channel);

            let relayFired = false;

            pc.onconnectionstatechange = () => {
                console.log("Conn State:", pc.connectionState);
                if (pc.connectionState === 'connected') {
                    relayFired = true;
                    SyncEngine.ui.setStatus("P2P Established!", true);
                }
            };

            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                this._sendSignal(targetId, { sdp: offer });
            });

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
                if (this.pullOnly) {
                    SyncEngine.ui.setStatus("Pull-Only: Receiving only.", true);
                    return;
                }
                SyncEngine.ui.setStatus("Connected! Transferring data...", true);
                const opts = SyncEngine.ui._getOptions();
                const data = SyncEngine.exportData(opts);
                var totalBytes = data.length;
                var CHUNK_SIZE = 16384;
                if (data.length <= CHUNK_SIZE) {
                    channel.send(data);
                    SyncEngine.ui.updateTransferProgress(totalBytes, totalBytes);
                    SyncEngine.ui.setStatus("Data sent successfully!", true);
                } else {
                    var offset = 0;
                    var sendNext = function() {
                        if (offset >= data.length) {
                            SyncEngine.ui.updateTransferProgress(totalBytes, totalBytes);
                            SyncEngine.ui.setStatus("Data sent successfully!", true);
                            return;
                        }
                        var chunk = data.substr(offset, CHUNK_SIZE);
                        channel.send(chunk);
                        offset += chunk.length;
                        SyncEngine.ui.updateTransferProgress(offset, totalBytes);
                        if (channel.bufferedAmount > 1048576) setTimeout(sendNext, 50);
                        else setTimeout(sendNext, 0);
                    };
                    sendNext();
                }
            };
            channel.onmessage = (e) => {
                console.log("Data Received (" + e.data.length + " bytes)");
                var fromId = Object.keys(this.peers).find(k => this.peers[k] === channel);
                var isTrusted = fromId ? SyncEngine._isTrustedDevice(fromId) : false;
                if (!isTrusted && fromId && !this._pendingSyncs[fromId]) {
                    var preview = SyncEngine._previewImportData(e.data);
                    this._pendingSyncs[fromId] = { type: 'p2p-data', data: e.data };
                    SyncEngine.ui.showConfirmToast(fromId, this.devices[fromId]?.name || 'Unknown', preview);
                    return;
                }
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
        _scopeModalEl: null,

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
                        <button class="dash-scope-tab" id="sync-tab-btn-file" onclick="SyncEngine.ui.switchTab('file')">📁 File</button>
                    </div>

                    <!-- Scope bar removed — use Configure Scope button in WebRTC tab -->

                    <div class="dash-body" style="min-height: 280px; position: relative;">
                        <div id="sync-tab-webrtc" style="display: block; overflow: hidden;">
                            <div style="text-align: center; margin-bottom: 1.5rem;">
                                <div id="sync-webrtc-radar-container" style="display: inline-block; padding: 10px; overflow: visible;">
                                    <div id="sync-webrtc-radar" style="font-size: 2.5rem; animation: pulse 2s infinite; transform-origin: center;">📡</div>
                                </div>
                                <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.5rem;">Looking for devices on the same network...</p>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-bottom: 0.75rem; padding: 0.4rem 1rem;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; color: var(--text);"><span>🔒</span> Pull Only <input type="checkbox" id="sync-pull-only-toggle" ${SyncEngine.webrtc.pullOnly ? 'checked' : ''} onchange="SyncEngine.webrtc.setPullOnly(this.checked)" style="accent-color: var(--accent); transform: scale(1.1);"></label>
                                <button class="btn-dash-action" onclick="SyncEngine.ui.openScopeModal()" style="font-size: 0.85rem; padding: 0.4rem 0.8rem;">⚙ Configure Scope</button>
                            </div>
                                <div style="display: flex; justify-content: center; gap: 15px; margin-top: 4px;">
                                    <div id="sync-room-id" style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.6;">Room ID: Identifying...</div>
                                    <div id="sync-local-name" style="font-size: 0.7rem; color: var(--accent); font-weight: 600; opacity: 0.8;">My Name: ...</div>
                                </div>
                            </div>
                            <div id="sync-webrtc-device-list" style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 200px; overflow-y: auto;">
                                <!-- Devices populated dynamically -->
                            </div>
                            <div id="sync-webrtc-status" style="margin-top: 1rem; text-align: center; font-size: 0.8rem; font-weight: 600; min-height: 1.2em;"></div>
                            <div id="sync-confirm-toast-container" style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;"></div>
                            <div id="sync-transfer-progress" style="display: none; margin-bottom: 0.75rem; padding: 0 1rem;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">
                                    <span id="sync-transfer-label">Transferring...</span>
                                    <span id="sync-transfer-percent">0%</span>
                                </div>
                                <div style="width: 100%; height: 8px; background: var(--surface2); border-radius: 4px; overflow: hidden; border: 1px solid var(--border);">
                                    <div id="sync-transfer-bar" style="width: 0%; height: 100%; background: var(--accent); transition: width 0.3s ease; border-radius: 3px;"></div>
                                </div>
                            </div>
                            <style>
                                @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
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
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.prevQR()" style="padding: 0.3rem 0.6rem;"><</button>
                                    <span id="sync-qr-page-info" style="margin: 0 10px; font-weight: 600;">1 / 1</span>
                                    <button class="btn-dash-action" onclick="SyncEngine.ui.nextQR()" style="padding: 0.3rem 0.6rem;">></button>
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
        },

        closeModal: function() {
            if (this.modalEl) {
                this.modalEl.classList.remove('open');
                this.stopScanner();
                this.stopQRAnimation();
                this._scanChunks = {};
            }
            this.closeScopeModal();
            if (SyncEngine.webrtc.heartbeatInterval) {
                clearInterval(SyncEngine.webrtc.heartbeatInterval);
                SyncEngine.webrtc.heartbeatInterval = null;
            }

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
            this.stopScanner();
            this.stopQRAnimation();
            
            ['webrtc', 'qr', 'file'].forEach(id => {
                const btn = document.getElementById('sync-tab-btn-' + id);
                const content = document.getElementById('sync-tab-' + id);
                if (btn) {
                    if (id === tabId) btn.classList.add('active');
                    else btn.classList.remove('active');
                }
                if (content) content.style.display = (id === tabId) ? 'block' : 'none';
            });

            if (tabId === 'qr') {
                this._scanChunks = {};
                this.toggleQRScanner(false);
                // Lazy-load QRCode library before rendering
                SyncEngine._ensureQRCode().then(() => {
                    this.renderQR();
                    this.startQRAnimation();
                }).catch(() => {
                    document.getElementById('sync-qr-container').innerHTML = 
                        '<span style="color:var(--wrong)">Failed to load QR library. Check your internet connection.</span>';
                });
            }
            if (tabId === 'webrtc') {
                SyncEngine.webrtc.initDiscovery();
                if (SyncEngine.webrtc.mqttClient) {
                    SyncEngine.webrtc.broadcastPresence();
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
                // Lazy-load Html5Qrcode before starting scanner
                SyncEngine._ensureHtml5Qrcode().then(() => {
                    this.startScanner();
                }).catch(() => {
                    document.getElementById('sync-reader').innerHTML = 
                        '<div style="padding: 1rem; color: var(--wrong);">Failed to load QR scanner. Check your internet connection.</div>';
                });
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
                if (now - dev.lastSeen > 15000) {
                    delete SyncEngine.webrtc.devices[id];
                    continue;
                }
                count++;
                const isTrusted = SyncEngine._isTrustedDevice(id);
                const trustedBadge = isTrusted ? '<span style="font-size:0.7rem;padding:2px 6px;border-radius:6px;font-weight:600;margin-left:6px;background:rgba(255,193,7,0.15);color:#ffc107;">⭐ Trusted</span>' : '';
                const pullOnlyBadge = dev.pullOnly ? '<span style="font-size:0.7rem;padding:2px 6px;border-radius:6px;font-weight:600;margin-left:6px;background:rgba(33,150,243,0.15);color:#2196f3;">🔒 Pull Only</span>' : '';
                html += `
                <div class="device-item">
                    <div class="device-info">
                        <div class="device-name">📱 ${dev.name}${trustedBadge}${pullOnlyBadge}</div>
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

        showConfirmToast: function(fromId, fromName, preview) {
            var container = document.getElementById('sync-confirm-toast-container');
            if (!container) return;
            var existing = document.getElementById('sync-confirm-' + fromId);
            if (existing) existing.remove();
            var previewHTML = '';
            if (preview) {
                previewHTML = '<div style="margin:0.5rem 0;padding:0.5rem;background:var(--surface1);border-radius:8px;font-size:0.8rem;color:var(--text-muted);">'
                    + '<div style="font-weight:600;margin-bottom:4px;color:var(--text);">Import Preview:</div>'
                    + (preview.trackerCount > 0 ? '<div>📊 ' + preview.trackerCount + ' tracker(s)</div>' : '')
                    + (preview.progressCount > 0 ? '<div>📈 ' + preview.progressCount + ' progress record(s)</div>' : '')
                    + (preview.subjects.length > 0 ? '<div style="margin-top:4px;">Subjects: ' + preview.subjects.map(function(s){return s.name;}).join(', ') + '</div>' : '')
                    + '</div>';
            }
            var el = document.createElement('div');
            el.id = 'sync-confirm-' + fromId;
            el.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1rem;margin:0.5rem;box-shadow:0 -2px 12px rgba(0,0,0,0.2);animation:slideUp 0.3s ease;';
            el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-weight:600;color:var(--text);font-size:0.95rem;">📱 Incoming Sync</div><div style="font-size:0.8rem;color:var(--accent);">from <strong>' + fromName + '</strong></div></div>'
                + previewHTML
                + '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--text-muted);margin:0.5rem 0;cursor:pointer;"><input type="checkbox" id="sync-trust-' + fromId + '" style="accent-color:var(--accent);"> Always trust this device</label>'
                + '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
                + '<button class="btn-dash-action btn-dash-danger" onclick="SyncEngine.webrtc.declineSync(\'' + fromId + '\')" style="font-size:0.85rem;padding:0.4rem 1rem;">Decline</button>'
                + '<button class="btn-dash-action" onclick="SyncEngine.webrtc.acceptSync(\'' + fromId + '\', document.getElementById(\'sync-trust-' + fromId + '\').checked)" style="font-size:0.85rem;padding:0.4rem 1rem;background:var(--correct);color:#fff;">Accept</button>'
                + '</div>';
            container.appendChild(el);
        },

        updateTransferProgress: function(bytesTransferred, totalBytes) {
            var container = document.getElementById('sync-transfer-progress');
            var bar = document.getElementById('sync-transfer-bar');
            var label = document.getElementById('sync-transfer-label');
            var percent = document.getElementById('sync-transfer-percent');
            if (!container || !bar) return;
            container.style.display = 'block';
            var pct = totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0;
            bar.style.width = pct + '%';
            if (percent) percent.textContent = pct + '%';
            var fmt = function(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(1) + ' MB'; };
            if (label) label.textContent = fmt(bytesTransferred) + ' / ' + fmt(totalBytes);
            if (bytesTransferred >= totalBytes) setTimeout(function(){ container.style.display = 'none'; }, 2000);
        },

        hideConfirmToast: function(fromId) {
            var el = document.getElementById('sync-confirm-' + fromId);
            if (el) el.remove();
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

        _getSubjectList: function() {
            var subjects = [];
            try {
                var keys = JSON.parse(localStorage.getItem('quiz_tracker_keys') || '[]');
                for (var i = 0; i < keys.length; i++) {
                    var uid = keys[i];
                    var raw = localStorage.getItem('quiz_tracker_v2_' + uid);
                    if (!raw) continue;
                    try {
                        var d = JSON.parse(raw);
                        subjects.push({ uid: uid, name: d.title || d.name || uid, trackedCount: (d.wrong||[]).length + (d.flagged||[]).length });
                    } catch(e) { subjects.push({ uid: uid, name: uid, trackedCount: 0 }); }
                }
            } catch(e) {}
            return subjects;
        },
        _getSavedScope: function() {
            try { return JSON.parse(localStorage.getItem('quiztool_sync_scope') || '{}'); } catch(e) { return {}; }
        },
        _saveScope: function(scope) {
            try { localStorage.setItem('quiztool_sync_scope', JSON.stringify(scope)); } catch(e) {}
        },

        openScopeModal: function() {
            this.closeScopeModal();
            var subjects = this._getSubjectList();
            var saved = this._getSavedScope();
            var savedSubjects = saved.subjects || [];
            var html = '<div class="dash-overlay open" style="z-index:2200;" onclick="if(event.target===this)SyncEngine.ui.closeScopeModal()">'
                + '<div class="dash-modal" style="max-width:380px;">'
                + '<div class="dash-header"><h2>⚙ Sync Scope</h2><button class="dash-close-btn" onclick="SyncEngine.ui.closeScopeModal()">✕</button></div>'
                + '<div class="dash-body" style="padding:0.75rem 1.25rem;">';
            for (var i = 0; i < subjects.length; i++) {
                var s = subjects[i];
                var chk = savedSubjects.length === 0 || savedSubjects.indexOf(s.uid) !== -1 ? 'checked' : '';
                html += '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem 0;cursor:pointer;font-size:0.9rem;color:var(--text);border-bottom:1px solid var(--border);"><input type="checkbox" class="sync-scope-subject-cb" data-uid="' + s.uid + '" ' + chk + ' style="accent-color:var(--accent);"> <span style="flex:1;">' + s.name + '</span><span style="font-size:0.75rem;color:var(--text-muted);">' + s.trackedCount + ' tracked</span></label>';
            }
            if (subjects.length === 0) html += '<p style="color:var(--text-muted);font-size:0.85rem;padding:1rem 0;text-align:center;">No subjects with tracker data found.</p>';
            var progChk = saved.progress !== false ? 'checked' : '';
            html += '<div style="border-top:2px solid var(--border);margin-top:0.5rem;padding-top:0.5rem;">'
                + '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem 0;cursor:pointer;font-size:0.9rem;color:var(--text);"><input type="checkbox" id="sync-scope-progress-cb" ' + progChk + ' style="accent-color:var(--accent);"> Active Progress</label></div>'
                + '</div>'
                + '<div style="display:flex;gap:0.5rem;padding:0.75rem 1.25rem;border-top:1px solid var(--border);justify-content:space-between;">'
                + '<button class="btn-dash-action" onclick="SyncEngine.ui.toggleAllSubjects()">Select All</button>'
                + '<button class="btn-dash-action" onclick="SyncEngine.ui.applyScopeAndClose()">Done</button></div>'
                + '</div></div>';
            var wrap = document.createElement('div');
            wrap.innerHTML = html;
            this._scopeModalEl = wrap.firstElementChild;
            document.body.appendChild(this._scopeModalEl);
        },

        closeScopeModal: function() {
            if (this._scopeModalEl) { this._scopeModalEl.remove(); this._scopeModalEl = null; }
        },

        toggleAllSubjects: function() {
            var cbs = document.querySelectorAll('.sync-scope-subject-cb');
            var allChecked = Array.from(cbs).every(function(cb){return cb.checked;});
            cbs.forEach(function(cb){cb.checked = !allChecked;});
        },

        applyScopeAndClose: function() {
            var subjects = [];
            var cbs = document.querySelectorAll('.sync-scope-subject-cb');
            cbs.forEach(function(cb){ if (cb.checked) subjects.push(cb.dataset.uid); });
            var progressEl = document.getElementById('sync-scope-progress-cb');
            var allSubjects = this._getSubjectList();
            // If all selected, save empty (means all)
            var scopeSubjects = subjects.length === allSubjects.length ? [] : subjects;
            this._saveScope({ subjects: scopeSubjects, progress: progressEl ? progressEl.checked : true });
            this.closeScopeModal();
            if (window.showToast) window.showToast("Sync scope updated!");
        },

        _getOptions: function() {
            var scope = this._getSavedScope();
            return {
                tracker: true,
                progress: scope.progress !== false,
                subjects: scope.subjects || []
            };
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
            
            const CHUNK_SIZE = 700;
            this._qrInstance = null;
            if (fullData.length <= CHUNK_SIZE) {
                this.qrChunks = [fullData];
                if (pagination) pagination.style.display = 'none';
            } else {
                this.qrChunks = [];
                const total = Math.ceil(fullData.length / CHUNK_SIZE);
                for (let i = 0; i < total; i++) {
                    const chunk = fullData.substr(i * CHUNK_SIZE, CHUNK_SIZE);
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

            if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                readerEl.innerHTML = `<div style="padding: 2rem 1rem; color: var(--wrong);">⚠️ Camera requires HTTPS. Use Copy/Paste.</div>`;
                return;
            }

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

            if (this._useFront) {
                startWithCamera({ facingMode: "user" });
                return;
            }

            if (this._cameras && this._cameras.length > 0) {
                if (this._currentCameraIndex >= this._cameras.length) this._currentCameraIndex = 0;
                startWithCamera(this._cameras[this._currentCameraIndex].id);
                return;
            }

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