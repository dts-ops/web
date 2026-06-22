// ==========================================================================
// 1. CẤU HÌNH BIẾN TOÀN CỤC & ĐỊNH DANH USER (LOCAL STORAGE CHUẨN)
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

// 🟢 ĐÃ SỬA: Đồng bộ hóa thông tin lấy từ trang đăng nhập
let MY_NAME = localStorage.getItem("chat_display_name") || "Ẩn danh";
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
            let lastId = 0;

            if (cachedMessages.length > 0) {
                // Tìm ID lớn nhất trong mảng (Giả định ID tăng dần theo số thứ tự 1, 2, 3...)
                lastId = Math.max(...cachedMessages.map(msg => msg.id || 0));
            }

            console.log(`🔄 [ĐỒNG BỘ] Gửi yêu cầu lấy tin nhắn mới từ sau ID: ${lastId}`);
            
            // Gửi gói tin yêu cầu đồng bộ lên Server
            socket.send(JSON.stringify({
                type: "request_history",
                last_id: lastId
            }));
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

            // LÀM MỚI/BỔ SUNG LỊCH SỬ TỪ SERVER
            if (data.type === "history") {
                let loadScreen = document.getElementById("first-load-screen");
                if (loadScreen) loadScreen.remove();

                let newMessages = data.messages || [];
                let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];

                if (newMessages.length > 0) {
                    console.log(`📥 [ĐỒNG BỘ] Nhận thêm ${newMessages.length} tin mới.`);
                    
                    newMessages.forEach(msg => {
                        if (!cachedMessages.some(c => c.id === msg.id)) {
                            cachedMessages.push({
                                id: msg.id,
                                sender: msg.sender,
                                content: msg.content,
                                timestamp: msg.timestamp, // 🟢 LƯU TIMESTAMP GỐC TỪ SERVER
                                role: msg.role || "n"
                            });
                        }
                    });

                    // Sắp xếp mảng theo thứ tự ID tăng dần để tránh lộn xộn giờ giấc
                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));
                }

                // Render sạch giao diện từ mảng đã có đầy đủ timestamp
                chatBoxContainer.innerHTML = ""; 
                cachedMessages.forEach(function(msg) {
                    renderMessageFromServer(msg.sender, msg.content, msg.timestamp, msg.id, false, msg.role);
                });
                scrollToBottom();
            } 
            
            // NHẬN TIN NHẮN THỜI GIAN THỰC (REALTIME)
            else if (data.type === "message") {
                let pendingBubble = document.getElementById(data.tempId);

                // Xác định timestamp thực tế từ server cấp (nếu server chưa cấp kịp thì lấy thời gian hiện tại)
                let exactTimestamp = data.timestamp || new Date().toISOString();

                if (pendingBubble && data.sender === MY_NAME) {
                    // Cập nhật giao diện tin nhắn của chính mình vừa gửi thành công
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
                    pendingBubble.removeAttribute("id"); 
                } else {
                    // Tin nhắn của đối phương gửi tới
                    renderMessageFromServer(data.sender, data.content, exactTimestamp, data.id, false, data.role);
                }

                // 🟢 BỔ SUNG VÀO CACHE: Lưu trữ đầy đủ id, content và timestamp
                let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];
                let isExist = cachedMessages.some(msg => msg.id === data.id);
                
                if (!isExist && data.id) {
                    cachedMessages.push({
                        id: data.id,
                        sender: data.sender,
                        content: data.content,
                        timestamp: exactTimestamp, // 🟢 ĐƯA TIMESTAMP VÀO LOCAL STORAGE
                        role: data.role || "n"
                    });
                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));
                }

                scrollToBottom();
            }
        } catch (e) {
            console.error("Lỗi xử lý dữ liệu nhận từ server:", e);
        }
    };
}

// ==========================================================================
// 5. HÀM ĐỔ TIN NHẮN LÊN GIAO DIỆN (HTML RENDERING THEO MÁY NGƯỜI DÙNG)
// ==========================================================================
let renderMessageFromServer = function(sender, content, time, msgId = null, isPending = false, role = "n") {
    
    // 1. KIỂM TRA TIN NHẮN ĐÃ TỒN TẠI (Cập nhật tích xanh cho tin đang gửi)
    if (msgId) {
        let existingBubble = document.getElementById(msgId);
        
        if (existingBubble) {
            let spanTime = existingBubble.querySelector(".check span");
            if (spanTime && time && time.includes("T")) {
                let dateObj = new Date(time);
                let hours = dateObj.getHours().toString().padStart(2, '0');
                let minutes = dateObj.getMinutes().toString().padStart(2, '0');
                spanTime.innerText = `${hours}:${minutes}`;
            } else if (spanTime) {
                spanTime.innerText = time;
            }

            let checkDiv = existingBubble.querySelector(".check");
            if (checkDiv && !isPending && !checkDiv.querySelector("img")) {
                let checkImg = document.createElement("img");
                checkImg.src = "/chat/img/check-2.png"; 
                checkDiv.appendChild(checkImg);
            }

            existingBubble.removeAttribute("id");
            return; 
        }
    }

    // 2. TẠO MỚI TIN NHẮN TRÊN MÀN HÌNH
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
    
    // Xử lý định dạng hiển thị Giờ:Phút từ timestamp
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
    
    chatBoxContainer.appendChild(chatDiv);
};

let scrollToBottom = function() {
    if (chatBoxContainer) {
        chatBoxContainer.scrollTop = chatBoxContainer.scrollHeight;
    }
};

// ==========================================================================
// 6. XỬ LÝ SỰ KIỆN GỬI TIN NHẮN (CLIENT TO SERVER)
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

    // 🟢 ĐÃ SỬA: Khi render tạm, truyền kèm MY_ROLE hiện tại của mình để vẽ đúng hướng trước
    renderMessageFromServer(MY_NAME, textValue, "Đang gửi...", tempId, true, MY_ROLE);
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

// Lắng nghe sự kiện mất mạng của trình duyệt để đổi trạng thái lập tức
window.addEventListener('offline', function() {
    console.log("🌐 Trình duyệt phát hiện ngắt mạng Internet.");
    setDisconnected();
    if (socket) socket.close();
});

// KHỔI CHẠY HỆ THỐNG LẦN ĐẦU TIÊN
connectWebSocket();

document.addEventListener("DOMContentLoaded", () => {
    const dropdownBtn = document.getElementById("dropdownBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn = document.getElementById("logoutBtn");

    // 1. Bấm vào icon để Ẩn/Hiện menu
    dropdownBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Ngăn sự kiện nổi bọt lên window
        dropdownMenu.classList.toggle("show");
    });

    // 2. Tự động đóng menu nếu người dùng bấm ra ngoài khoảng trống
    window.addEventListener("click", () => {
        if (dropdownMenu.classList.contains("show")) {
            dropdownMenu.classList.remove("show");
        }
    });

    // 3. Xử lý sự kiện khi bấm nút Đăng xuất
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault(); // Chặn hành vi nhảy link mặc định

            // Xóa toàn bộ Token, Quyền, Tên đã lưu ở trang đăng nhập
            localStorage.clear(); 
            
            console.log("🔒 Đã xóa sạch session đăng nhập.");
            
            // Chuyển hướng người dùng về trang đăng nhập login.html lập tức
            window.location.replace("login.html");
        });
    }
});