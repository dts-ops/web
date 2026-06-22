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
let isLoadingOldMessages = false; // Biến cờ (flag) chống việc gửi request liên tục khi đang tải tin cũ

// Đồng bộ hóa thông tin lấy từ trang đăng nhập
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
        
        // CƠ CHẾ TỰ ĐỘNG ĐỒNG BỘ: Mở app tự phân tích để gửi tham số thích hợp
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

            // 🟢 XỬ LÝ LỊCH SỬ CHAT TỪ SERVER (CHIA LÀM 2 NHÁNH: LOAD CŨ VÀ SYNC MỚI)
            if (data.type === "history") {
                let loadScreen = document.getElementById("first-load-screen");
                if (loadScreen) loadScreen.remove();

                let incomingMessages = data.messages || [];
                let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];

                // NHÁNH 1: ĐÁP ỨNG YÊU CẦU VUỐT LÊN - TẢI TIN NHẮN CŨ (load_old)
                if (data.sync_type === "load_old") {
                    if (incomingMessages.length > 0) {
                        console.log(`🔼 [TẢI CŨ] Nhận thêm ${incomingMessages.length} tin nhắn cũ về quá khứ.`);
                        
                        // Khóa chiều cao khung chat hiện tại lại trước khi render để chống giật
                        let previousScrollHeight = chatBoxContainer.scrollHeight;

                        // Lọc trùng và gộp dữ liệu cũ vào ĐẦU mảng cache
                        let filteredOld = incomingMessages.filter(m => !cachedMessages.some(c => c.id === m.id));
                        cachedMessages = [...filteredOld, ...cachedMessages];
                        localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));

                        // Render ngược (chèn vào đầu khung chat)
                        // Vì server mảng trả về sắp xếp tăng dần, ta lật ngược lại để chèn prepend chuẩn thứ tự
                        incomingMessages.reverse().forEach(function(msg) {
                            renderMessageFromServer(msg.sender, msg.content, msg.timestamp, msg.id, false, msg.role, true);
                        });

                        // 🧠 TÍNH TOÁN LẠI VỊ TRÍ CUỘN: Giữ nguyên khung hình, không để màn hình bị cuộn vọt lên đỉnh
                        let newScrollHeight = chatBoxContainer.scrollHeight;
                        chatBoxContainer.scrollTop = newScrollHeight - previousScrollHeight;
                    } else {
                        console.log("📥 [HỆ THỐNG] Đã tải hết lịch sử trong database, không còn tin nào cũ hơn.");
                    }
                    isLoadingOldMessages = false; // Mở khóa trạng thái loading cũ
                } 
                // NHÁNH 2: ĐỒNG BỘ TIN MỚI HOẶC VÀO APP LẦN ĐẦU (sync_new)
                else {
                    if (incomingMessages.length > 0) {
                        console.log(`📥 [ĐỒNG BỘ] Nhận thêm ${incomingMessages.length} tin mới.`);
                        let filteredNew = incomingMessages.filter(m => !cachedMessages.some(c => c.id === m.id));
                        cachedMessages = [...cachedMessages, ...filteredNew];
                    }

                    // Sắp xếp mảng theo thứ tự ID tăng dần tổng thể
                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));

                    // Xóa trắng và đổ lại toàn bộ giao diện từ cache
                    chatBoxContainer.innerHTML = ""; 
                    cachedMessages.forEach(function(msg) {
                        renderMessageFromServer(msg.sender, msg.content, msg.timestamp, msg.id, false, msg.role, false);
                    });
                    scrollToBottom();
                }
            } 
            
            // 🟢 NHẬN TIN NHẮN THỜI GIAN THỰC (REALTIME BUỒNG CHAT CHẠY ĐANG HOẠT ĐỘNG)
            else if (data.type === "message") {
                let pendingBubble = document.getElementById(data.tempId);
                let exactTimestamp = data.timestamp || new Date().toISOString();

                if (pendingBubble && data.sender === MY_NAME) {
                    // Cập nhật tin nhắn đang ở trạng thái chờ gửi của chính mình
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
                    // Gán ID thật từ Server trả về vào DOM để đồng bộ chuẩn xác sau này
                    if (data.id) pendingBubble.id = data.id;
                } else {
                    // Tin nhắn từ đối phương gửi tới, render mới tinh xuống cuối
                    renderMessageFromServer(data.sender, data.content, exactTimestamp, data.id, false, data.role, false);
                    scrollToBottom();
                }

                // Cập nhật bản ghi tin nhắn Realtime này vào Cache LocalStorage tức thì
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
// 5. HÀM ĐỔ TIN NHẮN LÊN GIAO DIỆN (HỖ TRỢ CHÈN CUỐI HOẶC CHÈN ĐẦU KHUNG CHAT)
// ==========================================================================
let renderMessageFromServer = function(sender, content, time, msgId = null, isPending = false, role = "n", prependToTop = false) {
    
    // Nếu tin nhắn có ID thật đã hiển thị sẵn trên màn hình (tránh render lặp khi sync_new)
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
    
    // Xử lý chuyển đổi chuỗi Timestamp ISO quốc tế về định dạng Giờ:Phút của máy cục bộ
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
    
    // RẼ NHÁNH PHƯƠNG THỨC CHÈN PHẦN TỬ HTML
    if (prependToTop) {
        // Nếu load tin nhắn cũ, chèn đẩy lên trên đầu hộp chat
        chatBoxContainer.prepend(chatDiv);
    } else {
        // Tin mới, đẩy xuống cuối cùng
        chatBoxContainer.appendChild(chatDiv);
    }
};

let scrollToBottom = function() {
    if (chatBoxContainer) {
        chatBoxContainer.scrollTop = chatBoxContainer.scrollHeight;
    }
};

// ==========================================================================
// 6. CƠ CHẾ THEO DÕI SỰ KIỆN CUỘN LÊN ĐỈNH ĐỂ TẢI THÊM TIN NHẮN CŨ (50 TIN/LẦN)
// ==========================================================================
if (chatBoxContainer) {
    chatBoxContainer.addEventListener("scroll", function() {
        // Khi người dùng vuốt chạm lên sát đỉnh khung chat (scrollTop === 0 hoặc rất nhỏ gần đỉnh)
        if (chatBoxContainer.scrollTop <= 5 && !isLoadingOldMessages) {
            let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];
            
            if (cachedMessages.length > 0) {
                isLoadingOldMessages = true; // Khóa đầu, chặn gửi trùng lặp nhiều request cùng lúc
                
                // Tìm ID nhỏ nhất (cũ nhất) hiện tại đang có trong bộ nhớ cache
                let minId = Math.min(...cachedMessages.map(msg => msg.id || Infinity));
                
                if (minId !== Infinity && minId > 1) {
                    console.log(`🔼 [YÊU CẦU] Người dùng vuốt lên đỉnh, yêu cầu tải 50 tin nhắn cũ trước ID: ${minId}`);
                    
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: "request_history",
                            id_start: minId // Gửi id_start lên để Server biết đường quét ngược
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

    // Render tạm tin dạng "Đang gửi..." hướng về phía tay phải (theo vai trò của mình)
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

// Lắng nghe sự kiện mất mạng của trình duyệt để đổi trạng thái lập tức
window.addEventListener('offline', function() {
    console.log("🌐 Trình duyệt phát hiện ngắt mạng Internet.");
    setDisconnected();
    if (socket) socket.close();
});

// ==========================================================================
// 8. LOGIC BANNER DROPDOWN & LOGOUT MENU
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const dropdownBtn = document.getElementById("dropdownBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn = document.getElementById("logoutBtn");

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

    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.clear(); // Xóa sạch bộ nhớ bao gồm cả cache chat
            console.log("🔒 Đã xóa sạch session đăng nhập.");
            window.location.replace("login.html");
        });
    }
});

// KHỞI CHẠY HỆ THỐNG LẦN ĐẦU TIÊN
connectWebSocket();