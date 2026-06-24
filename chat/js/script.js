// ==========================================================================
// 1. CẤU HÌNH BIẾN TOÀN CỤC & ĐỊNH DANH USER
// ==========================================================================
let chatBoxContainer = document.getElementById("chatBoxContainer");
let inputPostText = document.getElementById("inputPostText");
let micPost = document.getElementById("micPost");
let textSubmit = document.getElementById("textSubmit");
let statusSpan = document.getElementById("connection-status");

let socket = null;
let heartbeatInterval = null;
let checkNetworkInterval = null;
let missedHeartbeats = 0;
let isCheckingNetwork = false;
let isLoadingOldMessages = false; 

// Cờ khóa toàn cục chống gọi trùng OneSignal.login liên tiếp
window.isOneSignalLoggingIn = false;

// Đồng bộ hóa thông tin lấy từ trang đăng nhập
let MY_NAME = localStorage.getItem("chat_display_name") || "trunwson";
let MY_ROLE = localStorage.getItem("chat_my_role") || "n";

// Tự động cập nhật tên đối phương lên Header dựa theo vai trò thực tế
const PARTNER_NAME = (MY_ROLE === "s") ? "Nga Ngố" : "Anh Sơn";
const headerNameSelector = document.querySelector(".profile .left-text h2");
if (headerNameSelector) {
    headerNameSelector.innerText = PARTNER_NAME;
}

console.log(`👉 [HỆ THỐNG] Bạn đang online với tên: ${MY_NAME} (Quyền: ${MY_ROLE})`);

// ==========================================================================
// 2. HÀM QUẢN LÝ GIAO DIỆN TRẠNG THÁI KẾT NỐI
// ==========================================================================
function setConnected() {
    if (statusSpan) {
        statusSpan.innerText = "Đã kết nối";
        statusSpan.className = "status-connected";
    }
    if (checkNetworkInterval) {
        clearInterval(checkNetworkInterval);
        checkNetworkInterval = null;
    }
    isCheckingNetwork = false;
}

function setDisconnected() {
    if (statusSpan) {
        statusSpan.innerText = "Mất kết nối";
        statusSpan.className = "status-disconnected";
    }
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    startCheckingNetworkNgam();
}

// ==========================================================================
// 3. CƠ CHẾ KIỂM TRA NHỊP TIM VÀ AUTO RECONNECT
// ==========================================================================
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    missedHeartbeats = 0;

    heartbeatInterval = setInterval(function() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            missedHeartbeats++;
            if (missedHeartbeats > 3) {
                console.log("🚨 Server không phản hồi nhịp tim, tiến hành ngắt kết nối ảo!");
                setDisconnected();
                socket.close();
                return;
            }
            socket.send(JSON.stringify({ type: "ping" }));
        }
    }, 5000); 
}

function startCheckingNetworkNgam() {
    if (isCheckingNetwork) return;
    isCheckingNetwork = true;

    console.log("🔄 Đang chạy ngầm kiểm tra trạng thái mạng...");

    checkNetworkInterval = setInterval(async () => {
        try {
            const response = await fetch("https://konkoo-server-chat.hf.space/", { method: "GET", cache: "no-store" });
            if (response.status >= 200 && response.status < 500) {
                console.log("🎉 Tìm thấy Server trực tuyến! Thực hiện kết nối lại WebSocket...");
                clearInterval(checkNetworkInterval);
                checkNetworkInterval = null;
                connectWebSocket();
            }
        } catch (error) {
            console.log("⏳ Chưa kết nối được tới server, tiếp tục thử lại sau 3 giây...");
            if (statusSpan) {
                statusSpan.innerText = "Đang kết nối lại...";
                statusSpan.className = "status-disconnected";
            }
        }
    }, 3000);
}

// ==========================================================================
// 4. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN WEBSOCKET
// ==========================================================================
function connectWebSocket() {
    socket = new WebSocket('wss://konkoo-server-chat.hf.space/ws');

    socket.onopen = function() {
        console.log("🟢 Đã kết nối thành công tới server Hugging Face!");
        setConnected();
        startHeartbeat();
        
        let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];
        
        if (cachedMessages.length > 0) {
            let maxId = Math.max(...cachedMessages.map(msg => msg.id || 0));
            console.log(`🔄 [ĐỒNG BỘ MỚI] Yêu cầu các tin nhắn mới phát sinh sau ID: ${maxId}`);
            socket.send(JSON.stringify({
                type: "request_history",
                id_end: maxId
            }));
        } else {
            console.log("🆕 [TẢI LẦN ĐẦU] Chưa có cache, yêu cầu server cấp 50 tin mới nhất làm gốc");
            socket.send(JSON.stringify({
                type: "request_history"
            }));
        }
    };

    socket.onclose = function() {
        console.log("🔴 Kết nối WebSocket đã bị đóng.");
        setDisconnected();
    };

    socket.onerror = function(error) {
        console.error("❌ Lỗi kết nối WebSocket:", error);
        setDisconnected();
    };

    socket.onmessage = function(event) {
        try {
            let data = JSON.parse(event.data);

            if (data.type === "pong") { missedHeartbeats = 0; return; }

            if (data.type === "history") {
                let loadScreen = document.getElementById("first-load-screen");
                if (loadScreen) loadScreen.remove();

                let incomingMessages = data.messages || [];
                let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];

                if (data.sync_type === "load_old") {
                    if (incomingMessages.length > 0) {
                        console.log(`🔼 [TẢI CŨ] Nhận thêm ${incomingMessages.length} tin nhắn cũ về quá khứ.`);
                        let previousScrollHeight = chatBoxContainer.scrollHeight;

                        let filteredOld = incomingMessages.filter(m => !cachedMessages.some(c => c.id === m.id));
                        cachedMessages = [...filteredOld, ...cachedMessages];
                        localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));

                        incomingMessages.reverse().forEach(function(msg) {
                            renderMessageFromServer(msg.sender, msg.content, msg.timestamp, msg.id, false, msg.role, true);
                        });

                        let newScrollHeight = chatBoxContainer.scrollHeight;
                        chatBoxContainer.scrollTop = newScrollHeight - previousScrollHeight;
                    } else {
                        console.log("📥 [HỆ THỐNG] Đã tải hết lịch sử trong database, không còn tin nào cũ hơn.");
                    }
                    isLoadingOldMessages = false; 
                } 
                else {
                    if (incomingMessages.length > 0) {
                        console.log(`📥 [ĐỒNG BỘ] Nhận thêm ${incomingMessages.length} tin mới.`);
                        let filteredNew = incomingMessages.filter(m => !cachedMessages.some(c => c.id === m.id));
                        cachedMessages = [...cachedMessages, ...filteredNew];
                    }

                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));

                    chatBoxContainer.innerHTML = ""; 
                    cachedMessages.forEach(function(msg) {
                        renderMessageFromServer(msg.sender, msg.content, msg.timestamp, msg.id, false, msg.role, false);
                    });
                    scrollToBottom();
                }
            } 
            else if (data.type === "message") {
                let pendingBubble = document.getElementById(data.tempId);
                let exactTimestamp = data.timestamp || new Date().toISOString();

                if (pendingBubble && data.sender === MY_NAME) {
                    let spanTime = pendingBubble.querySelector(".check span");
                    if (spanTime) {
                        let dateObj = new Date(exactTimestamp);
                        let hours = dateObj.getHours().toString().padStart(2, '0');
                        let minutes = dateObj.getMinutes().toString().padStart(2, '0');
                        spanTime.innerText = `${hours}:${minutes}`;
                    }
                    let checkDiv = pendingBubble.querySelector(".check");
                    if (checkDiv && !checkDiv.querySelector("img")) {
                        let checkImg = document.createElement("img");
                        checkImg.src = "/chat/img/check-2.png"; 
                        checkDiv.appendChild(checkImg);
                    }
                    if (data.id) pendingBubble.id = data.id;
                } else {
                    renderMessageFromServer(data.sender, data.content, exactTimestamp, data.id, false, data.role, false);
                    scrollToBottom();
                }

                let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];
                if (data.id && !cachedMessages.some(msg => msg.id === data.id)) {
                    cachedMessages.push({
                        id: data.id,
                        sender: data.sender,
                        content: data.content,
                        timestamp: exactTimestamp,
                        role: data.role || "n"
                    });
                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));
                }
            }
        } catch (e) {
            console.error("Lỗi xử lý dữ liệu nhận từ server:", e);
        }
    };
}

// ==========================================================================
// 5. HÀM ĐỔ TIN NHẮN LÊN GIAO DIỆN
// ==========================================================================
let renderMessageFromServer = function(sender, content, time, msgId = null, isPending = false, role = "n", prependToTop = false) {
    if (msgId && document.getElementById(msgId) && !prependToTop) {
        return;
    }

    let chatDiv = document.createElement("div");
    let isMyOwnMessage = (sender === MY_NAME);
    chatDiv.className = isMyOwnMessage ? "chat-r" : "chat-l";
    
    if (msgId) { chatDiv.id = msgId; }

    let messDiv = document.createElement("div");
    messDiv.className = isMyOwnMessage ? "mess mess-r" : "mess";

    let ptag = document.createElement("p");
    ptag.innerText = content;

    let checkDiv = document.createElement("div");
    checkDiv.className = "check";
    
    let displayTime = time;
    if (time && time !== "Đang gửi..." && (time.includes("T") || !isNaN(Date.parse(time)))) {
        let dateObj = new Date(time);
        let hours = dateObj.getHours().toString().padStart(2, '0');
        let minutes = dateObj.getMinutes().toString().padStart(2, '0');
        displayTime = `${hours}:${minutes}`;
    }

    let spanTime = document.createElement("span");
    spanTime.innerText = displayTime;
    checkDiv.appendChild(spanTime);

    if (isMyOwnMessage && !isPending) {
        let checkImg = document.createElement("img");
        checkImg.src = "/chat/img/check-2.png"; 
        checkDiv.appendChild(checkImg);
    }
        
    messDiv.appendChild(ptag);
    messDiv.appendChild(checkDiv);
    chatDiv.appendChild(messDiv);
    
    if (prependToTop) {
        chatBoxContainer.prepend(chatDiv);
    } else {
        chatBoxContainer.appendChild(chatDiv);
    }
};

let scrollToBottom = function() {
    if (chatBoxContainer) {
        chatBoxContainer.scrollTop = chatBoxContainer.scrollHeight;
    }
};

// ==========================================================================
// 6. CƠ CHẾ THEO DÕI SỰ KIỆN CUỘN LÊN ĐỈNH ĐỂ TẢI THÊM TIN CŨ
// ==========================================================================
if (chatBoxContainer) {
    chatBoxContainer.addEventListener("scroll", function() {
        if (chatBoxContainer.scrollTop <= 5 && !isLoadingOldMessages) {
            let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];
            
            if (cachedMessages.length > 0) {
                isLoadingOldMessages = true; 
                let minId = Math.min(...cachedMessages.map(msg => msg.id || Infinity));
                
                if (minId !== Infinity && minId > 1) {
                    console.log(`🔼 [YÊU CẦU] Người dùng vuốt lên đỉnh, yêu cầu tải 50 tin nhắn cũ trước ID: ${minId}`);
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: "request_history",
                            id_start: minId 
                        }));
                    } else {
                        isLoadingOldMessages = false;
                    }
                } else {
                    isLoadingOldMessages = false;
                }
            }
        }
    });
}

// ==========================================================================
// 7. XỬ LÝ SỰ KIỆN GỬI TIN NHẮN (CLIENT TO SERVER)
// ==========================================================================
let postTextAction = function(event) {
    if (event) event.preventDefault();

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("⚠️ Không thể gửi tin, WebSocket chưa được kết nối!");
        return;
    }

    let textValue = inputPostText.value.trim();
    if (textValue === "") return;

    let tempId = "temp-" + Date.now();

    renderMessageFromServer(MY_NAME, textValue, "Đang gửi...", tempId, true, MY_ROLE, false);
    scrollToBottom();

    let msgPayload = {
        "sender": MY_NAME,
        "content": textValue,
        "tempId": tempId 
    };

    socket.send(JSON.stringify(msgPayload));
    inputPostText.value = "";
};

if (textSubmit) {
    textSubmit.addEventListener("click", postTextAction);
}

if (inputPostText) {
    inputPostText.addEventListener("keypress", function(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            postTextAction(event);
        }
    });
}

window.addEventListener('offline', function() {
    console.log("🌐 Trình duyệt phát hiện ngắt mạng Internet.");
    setDisconnected();
    if (socket) socket.close();
});

// ==========================================================================
// 8. LOGIC BANNER DROPDOWN & LOGOUT MENU + ĐỊNH DANH AN TOÀN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const dropdownBtn = document.getElementById("dropdownBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn = document.getElementById("logoutBtn");

    // ĐỒNG BỘ ĐỊNH DANH AN TOÀN (NƠI DUY NHẤT ĐƯỢC PHÉP LOGIN)
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function(OneSignal) {
        setTimeout(async () => {
            if (window.isOneSignalLoggingIn) return; // Chặn trùng lặp
            try {
                const currentExternalId = await OneSignal.User.externalId;
                // Sử dụng MY_NAME đã khai báo đồng bộ ở đầu file
                if (currentExternalId !== MY_NAME) {
                    window.isOneSignalLoggingIn = true;
                    await OneSignal.login(MY_NAME); 
                    console.log("🟢 Đã định danh thiết bị này thuộc về user:", MY_NAME);
                } else {
                    console.log("✅ Thiết bị đã được định danh chính xác trước đó:", MY_NAME);
                }
            } catch (error) {
                console.error("❌ Lỗi định danh OneSignal:", error);
            } finally {
                window.isOneSignalLoggingIn = false;
            }
        }, 1500); // Trì hoãn 1.5 giây chờ SDK ổn định hoàn toàn
    });

    // Logic xử lý ẩn/hiện Dropdown Menu
    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("show");
        });

        window.addEventListener("click", () => {
            if (dropdownMenu.classList.contains("show")) {
                dropdownMenu.classList.remove("show");
            }
        });
    }

    // Xử lý sự kiện khi bấm nút Đăng xuất
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(async function(OneSignal) {
                try {
                    await OneSignal.logout();
                    console.log("🔴 Đã xóa định danh OneSignal của thiết bị này!");
                } catch (error) {
                    console.error("❌ Lỗi gỡ định danh OneSignal:", error);
                } finally {
                    localStorage.clear(); 
                    console.log("🔒 Đã xóa sạch session đăng nhập.");
                    window.location.replace("/chat/login.html");
                }
            });
        });
    }
}); 

// ==========================================================================
// 9. THIẾT LẬP CẤU HÌNH BAN ĐẦU ONESIGNAL
// ==========================================================================
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
        appId: "3bf4b621-fd87-4e03-87a6-fe336bd3d73a",
        safari_web_id: "web.onesignal.auto.313afc18-65a3-4cb5-bd8a-eabd69c6e4d8",
        notifyButton: {
            enable: false, 
        },
    });
});

// Xử lý sự kiện nút "Bật thông báo đẩy" trong menu dropdown
document.addEventListener("DOMContentLoaded", function() {
    const pushNotifyBtn = document.getElementById('pushNotifyBtn');
    if (pushNotifyBtn) {
        pushNotifyBtn.addEventListener('click', function(e) {
            e.preventDefault(); 
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(function(OneSignal) {
                OneSignal.Notifications.requestPermission().then(function() {
                    console.log("🔔 Đã xử lý yêu cầu cấp quyền từ Dropdown!");
                    const dropdownMenu = document.getElementById('dropdownMenu');
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                });
            });
        });
    }
});

// 10. Server đang bảo trì
// Cập nhật lại hàm thông báo Mất kết nối
function setDisconnected() {
    if (statusSpan) {
        statusSpan.innerText = "Mất kết nối";
        statusSpan.className = "status-disconnected";
    }
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    // Khi rớt kết nối hoặc ping quá 3 lần không phản hồi, kích hoạt kiểm tra ngầm lập tức
    startCheckingNetworkNgam();
}

// Cập nhật lại cơ chế quét mạng ngầm thông minh
function startCheckingNetworkNgam() {
    if (isCheckingNetwork) return;
    isCheckingNetwork = true;

    console.log("🔄 Đang chạy ngầm kiểm tra trạng thái mạng...");
    const maintenanceScreen = document.getElementById("maintenance-screen");

    checkNetworkInterval = setInterval(async () => {
        try {
            // Ping thử tới endpoint HTTP của Server
            const response = await fetch("https://konkoo-server-chat.hf.space/", { method: "GET", cache: "no-store" });
            
            if (response.status >= 200 && response.status < 500) {
                console.log("🎉 Server trực tuyến! Ẩn bảo trì và kết nối lại...");
                
                // Server sống lại -> Ẩn màn hình bảo trì đi
                if (maintenanceScreen) maintenanceScreen.style.setProperty("display", "none", "important");
                
                clearInterval(checkNetworkInterval);
                checkNetworkInterval = null;
                connectWebSocket();
            } else {
                // Server trả về lỗi 502, 503... -> Hiện bảo trì
                if (maintenanceScreen) maintenanceScreen.style.setProperty("display", "flex", "important");
            }
        } catch (error) {
            // Lỗi sập nguồn hoàn toàn (Fetch lỗi, Server ngủ đông, rớt mạng mạng cục bộ)
            console.log("⏳ Chưa kết nối được tới server, bật giao diện bảo trì...");
            if (statusSpan) {
                statusSpan.innerText = "Đang kết nối lại...";
                statusSpan.className = "status-disconnected";
            }
            
            // Hiện màn hình bảo trì chặn user bấm bậy
            if (maintenanceScreen) maintenanceScreen.style.setProperty("display", "flex", "important");
        }
    }, 3000); // 3 giây ping 1 lần
}

// 11. Thực hiện cuojc gọi
// ==========================================================================
// WEBRTC VIDEO CALL MODULE 
// ==========================================================================
let localStream = null;
let peerConnection = null;
let callTimerInterval = null;
let callStartTime = 0;

const iceConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// --- 1. HÀM KÍCH HOẠT CUỘC GỌI (Khi người gọi bấm nút Call trên Header) ---
async function startCall() {
    document.getElementById("video-call-screen").style.display = "block";
    
    try {
        // Bước 1: Thử gọi cả Cam và Mic như bình thường
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
        try {
            console.log("⚠️ Không tìm thấy Microphone, hạ cấp xuống chỉ gọi Camera...");
            // Bước 2: Nếu lỗi (do thiếu mic), thử gọi lại nhưng tắt audio đi (audio: false)
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (err2) {
            // Bước 3: Nếu vẫn lỗi tiếp thì mới chịu thua
            alert("Lỗi phần cứng: Không thể truy cập Camera/Microphone! " + err2.message);
            hangUpCall(false);
            return;
        }
    }

    // Khúc code bên dưới của hàm startCall() giữ nguyên...
    document.getElementById("localVideo").srcObject = localStream;
    initPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendToSignalingServer({ type: "offer", sdp: offer });
}

// HÀM GỬI DỮ LIỆU CUỘC GỌI LÊN SERVER WEBSOCKET
function sendToSignalingServer(payload) {
    // Kiểm tra xem biến socket của bro có đang mở kết nối không
    // LƯU Ý: Nếu biến WebSocket của bro đặt tên khác (ví dụ: ws, my_socket...), hãy đổi chữ "socket" thành tên đó nhé!
    if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
        
        // Tự động ghim tên người gửi vào gói tin nếu chưa có
        if (!payload.sender) {
            payload.sender = window.currentUserName || localStorage.getItem("user_name") || "trunwson";
        }
        
        // Bắn chuỗi JSON lên Server FastAPI bắc cầu
        socket.send(JSON.stringify(payload));
        console.log(`📤 Đã gửi gói tin WebRTC [${payload.type}] lên server.`);
    } else {
        console.error("❌ Không thể gửi gói tin WebRTC vì WebSocket chưa kết nối hoặc đã bị đóng!");
    }
}

// --- 2. KHỞI TẠO ĐỐI TƯỢNG PEER CONNECTION TRÌNH DUYỆT ---
function initPeerConnection() {
    peerConnection = new RTCPeerConnection(iceConfiguration);
    
    // Đẩy track dữ liệu vào kết nối
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    // Lắng nghe luồng video từ đối phương trả về
    peerConnection.ontrack = (event) => {
        document.getElementById("remoteVideo").srcObject = event.streams[0];
        // Khi nhận được video của nhau tức là cuộc gọi chính thức bắt đầu -> Bật bộ đếm thời gian
        startTimer();
    };
    
    // Dò đường địa chỉ mạng mạng công cộng
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendToSignalingServer({ type: "candidate", candidate: event.candidate });
        }
    };
}

// --- 3. PHÍA NGƯỜI NHẬN: XỬ LÝ KHI CÓ OFFER GỌI ĐẾN ---
function handleReceivedOffer(sdp) {
    // Không hiện màn hình camera ngay, chỉ hiện thanh thông báo xanh lá ở trên cùng
    const notice = document.getElementById("incoming-call-notice");
    notice.style.display = "flex";
    
    // Lưu tạm sdp vào bộ nhớ để khi bấm "Tham gia" thì xài
    window.pendingOfferSdp = sdp;
}

// --- 4. PHÍA NGƯỜI NHẬN: BẤM NÚT "THAM GIA" ---
async function acceptIncomingCall() {
    document.getElementById("incoming-call-notice").style.display = "none";
    document.getElementById("video-call-screen").style.display = "block";
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById("localVideo").srcObject = localStream;
        
        initPeerConnection();
        
        // Nạp sdp của người gọi
        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOfferSdp));
        
        // Tạo Answer phản hồi lại
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendToSignalingServer({ type: "answer", sdp: answer });
    } catch (err) {
        alert("Lỗi tham gia cuộc gọi!");
        hangUpCall(false);
    }
}

// --- 5. PHÍA NGƯỜI GỌI: NHẬN ANSWER ĐỂ THÔNG MẠNG P2P ---
async function handleReceivedAnswer(sdp) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
}

// --- 6. XỬ LÝ GÓI TIN ĐỊA CHỈ MẠNG ---
function handleReceivedCandidate(candidate) {
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {});
    }
}

// --- 7. BỘ ĐẾM THỜI GIAN CUỘC GỌI CHẠY ĐỒNG BỘ ---
function startTimer() {
    if (callTimerInterval) return;
    callStartTime = Date.now();
    callTimerInterval = setInterval(() => {
        const totalSeconds = Math.floor((Date.now() - callStartTime) / 1000);
        const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        document.getElementById("call-timer").innerText = `${mins}:${secs}`;
    }, 1000);
}

// --- 8. CÚP MÁY VÀ DỌN DẸP BĂNG THÔNG ---
function hangUpCall(isMusterNotify) {
    // Tắt bộ đếm thời gian
    clearInterval(callTimerInterval);
    callTimerInterval = null;
    document.getElementById("call-timer").innerText = "00:00";
    
    // Tắt camera/mic phần cứng thiết bị
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Đóng kết nối ngang hàng RTC
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Ẩn giao diện
    document.getElementById("video-call-screen").style.display = "none";
    document.getElementById("incoming-call-notice").style.display = "none";
    
    // Gửi tín hiệu báo cho đầu dây bên kia biết mình đã cúp để họ tự động tắt màn hình theo
    if (isMusterNotify) {
        sendToSignalingServer({ type: "hangup" });
    }
}

// --- 9. BẬT/TẮT NHANH PHẦN CỨNG CAM VÀ MIC ---
function toggleMic() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById("btn-toggle-mic").innerText = audioTrack.enabled ? "🎙️" : "🔇";
    document.getElementById("btn-toggle-mic").style.background = audioTrack.enabled ? "#3a3a55" : "#e74c3c";
}

function toggleCam() {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    document.getElementById("btn-toggle-cam").innerText = videoTrack.enabled ? "📷" : "❌";
    document.getElementById("btn-toggle-cam").style.background = videoTrack.enabled ? "#3a3a55" : "#e74c3c";
}

// KHỞI CHẠY HỆ THỐNG LẦN ĐẦU TIÊN
connectWebSocket();
