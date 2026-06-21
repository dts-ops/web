// ==========================================================================
// 1. CẤU HÌNH BIẾN TOÀN CỤC & ĐỊNH DANH USER (LOCAL STORAGE)
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

// Đọc giá trị từ Local Storage, mặc định ban đầu là "s"
let MY_NAME = localStorage.getItem("chat_username");
if (!MY_NAME) {
    MY_NAME = "s";
    localStorage.setItem("chat_username", "s");
}

// Tự động cập nhật tên đối phương lên Header
const PARTNER_NAME = (MY_NAME === "s") ? "n" : "s";
const headerNameSelector = document.querySelector(".profile .left-text h2");
if (headerNameSelector) {
    headerNameSelector.innerText = PARTNER_NAME;
}

console.log("👉 [HỆ THỐNG] Bạn đang online với tên User là:", MY_NAME);
console.log("👉 [HỆ THỐNG] Muốn đổi tài khoản? Gõ lệnh này vào console: setRole('n')");

window.setRole = function(name) {
    if (name === "s" || name === "n") {
        localStorage.setItem("chat_username", name);
        console.log(`🎉 Đã đổi thành công sang User: "${name}". Đang tải lại trang...`);
        location.reload();
    } else {
        console.error("❌ Lỗi: Chỉ được nhập 's' hoặc 'n' thôi!");
    }
};

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
            // Thay đổi URL HEAD này bằng đường dẫn HTTP thực tế từ Server FastAPI của bạn
            const response = await fetch("https://konkoo-server-chat.hf.space/", { method: "GET", cache: "no-store" });
            // Chấp nhận tất cả các status từ 200 đến 499 (vì có phản hồi từ server là server đang chạy)
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

            // Phản hồi Pong giữ nhịp tim từ Server
            if (data.type === "pong") {
                missedHeartbeats = 0;
                return;
            }

            // Trường hợp A: Tải lịch sử chat cũ từ Supabase
            if (data.type === "history") {
                let loadScreen = document.getElementById("first-load-screen");
                if (loadScreen) loadScreen.remove();

                chatBoxContainer.innerHTML = ""; 
                let messages = data.messages || [];
                messages.forEach(function(msg) {
                    renderMessageFromServer(msg.sender, msg.content, msg.timestamp);
                });
                scrollToBottom();
            } 
            // Trường hợp B: Nhận tin nhắn Realtime mới
            else if (data.type === "message") {
                let pendingBubble = document.getElementById(data.tempId);

                if (pendingBubble && data.sender === MY_NAME) {
                    // Cập nhật thời gian chuẩn từ Server cấp
                    let spanTime = pendingBubble.querySelector(".check span");
                    if (spanTime && data.timestamp) {
                        let dateObj = new Date(data.timestamp);
                        let hours = dateObj.getHours().toString().padStart(2, '0');
                        let minutes = dateObj.getMinutes().toString().padStart(2, '0');
                        spanTime.innerText = `${hours}:${minutes}`;
                    }

                    // Chèn thêm ảnh tích xanh double-check
                    let checkDiv = pendingBubble.querySelector(".check");
                    if (checkDiv && !checkDiv.querySelector("img")) {
                        let checkImg = document.createElement("img");
                        checkImg.src = "/chat/img/check-2.png";
                        checkDiv.appendChild(checkImg);
                    }
                    
                    pendingBubble.removeAttribute("id"); // Xóa id tạm để tránh trùng lặp trùng lặp
                } else {
                    // Nếu là tin nhắn của người khác gửi đến, render mới sang bên TRÁI
                    renderMessageFromServer(data.sender, data.content, data.timestamp);
                }
                scrollToBottom();
            }
        } catch (e) {
            console.error("Lỗi xử lý dữ liệu nhận từ server:", e);
        }
    };
}

// ==========================================================================
// 5. HÀM ĐỔ TIN NHẮN LÊN GIAO DIỆN (HTML RENDERING)
// ==========================================================================
// 🟢 ĐÃ CẬP NHẬT: Thêm tham số 'role' vào hàm để phân loại giao diện từ Server
let renderMessageFromServer = function(sender, content, time, msgId = null, isPending = false, role = "n") {
    
    // 1. KIỂM TRA XEM TIN NHẮN ĐÃ TỒN TẠI TRÊN MÀN HÌNH CHƯA (Xử lý tích xanh cập nhật)
    if (msgId) {
        let existingBubble = document.getElementById(msgId);
        
        if (existingBubble) {
            // Cập nhật lại thời gian chuẩn từ Server
            let spanTime = existingBubble.querySelector(".check span");
            if (spanTime && time && time.includes("T")) {
                let dateObj = new Date(time);
                let hours = dateObj.getHours().toString().padStart(2, '0');
                let minutes = dateObj.getMinutes().toString().padStart(2, '0');
                spanTime.innerText = `${hours}:${minutes}`;
            } else if (spanTime) {
                spanTime.innerText = time;
            }

            // Chèn thêm ảnh tích xanh vì tin đã lên server thành công
            let checkDiv = existingBubble.querySelector(".check");
            if (checkDiv && !isPending && !checkDiv.querySelector("img")) {
                let checkImg = document.createElement("img");
                checkImg.src = "img/check-2.png"; 
                checkDiv.appendChild(checkImg);
            }

            existingBubble.removeAttribute("id");
            return; // Đã cập nhật xong -> Thoát hàm
        }
    }

    // 2. NẾU TIN NHẮN CHƯA CÓ TRÊN MÀN HÌNH -> TIẾN HÀNH TẠO MỚI
    let chatDiv = document.createElement("div");
    
    // 🟢 THAY ĐỔI LOGIC: Phân loại vị trí bong bóng chat dựa hoàn toàn vào biến role của Server
    chatDiv.className = (role === "s") ? "chat-r" : "chat-l";
    
    if (msgId) {
        chatDiv.id = msgId;
    }

    let messDiv = document.createElement("div");
    // 🟢 THAY ĐỔI LOGIC: Style cho khung tin nhắn dựa hoàn toàn vào biến role của Server
    messDiv.className = (role === "s") ? "mess mess-r" : "mess";

    let ptag = document.createElement("p");
    // Bạn có thể hiển thị thêm tên người gửi nếu muốn người thường biết ai đang chat
    ptag.innerText = role === "s" ? content : `${sender}: ${content}`;

    let checkDiv = document.createElement("div");
    checkDiv.className = "check";
    
    let displayTime = time;
    if (time && time !== "Đang gửi..." && time.includes("T")) {
        let dateObj = new Date(time);
        let hours = dateObj.getHours().toString().padStart(2, '0');
        let minutes = dateObj.getMinutes().toString().padStart(2, '0');
        displayTime = `${hours}:${minutes}`;
    }

    let spanTime = document.createElement("span");
    spanTime.innerText = displayTime;
    checkDiv.appendChild(spanTime);

    // Tích xanh hiển thị nếu đó là tin nhắn của Sơn và đã gửi xong
    if (role === "s" && !isPending) {
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

    // Chặn gửi tin nhắn nếu WebSocket chưa sẵn sàng kết nối
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("⚠️ Không thể gửi tin, WebSocket chưa được kết nối!");
        return;
    }

    let textValue = inputPostText.value.trim();
    if (textValue === "") return;

    let tempId = "temp-" + Date.now();

    // Render tạm tin nhắn dạng "Đang gửi..." lên giao diện trước
    renderMessageFromServer(MY_NAME, textValue, "Đang gửi...", tempId, true);
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

// KHỞI CHẠY HỆ THỐNG LẦN ĐẦU TIÊN
connectWebSocket();