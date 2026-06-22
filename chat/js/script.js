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

            // A. Phản hồi Pong giữ nhịp tim từ Server
            if (data.type === "pong") {
                missedHeartbeats = 0;
                return;
            }

            // B. Nhận số lượng người kết nối online từ Server gửi về
            if (data.type === "online_count") {
                const onlineTextElem = document.getElementById("online-text");
                if (onlineTextElem) {
                    onlineTextElem.innerText = `🟢 Đang online: ${data.count} người`;
                }
                return;
            }

            // C. Trường hợp tải lịch sử chat cũ từ Supabase
            // Đoạn xử lý data.type === "history" trong socket.onmessage sửa lại:

            if (data.type === "history") {
                let loadScreen = document.getElementById("first-load-screen");
                if (loadScreen) loadScreen.remove();

                let newMessages = data.messages || [];
                let cachedMessages = JSON.parse(localStorage.getItem("chat_history_cache")) || [];

                if (newMessages.length > 0) {
                    console.log(`📥 Nhận thêm ${newMessages.length} tin nhắn mới từ server.`);
                    
                    // Bổ sung các tin nhắn mới vào mảng cũ
                    newMessages.forEach(msg => {
                        // Chặn trùng lặp chắc cú bằng cách kiểm tra ID
                        if (!cachedMessages.some(c => c.id === msg.id)) {
                            cachedMessages.push({
                                id: msg.id,
                                sender: msg.sender,
                                content: msg.content,
                                timestamp: msg.timestamp,
                                role: msg.role || "n"
                            });
                        }
                    });

                    // Lưu mảng đã được cập nhật đầy đủ lại vào LocalStorage
                    localStorage.setItem("chat_history_cache", JSON.stringify(cachedMessages));
                }

                // Vẽ lại toàn bộ giao diện từ mảng cache mới nhất sau khi đã đồng bộ ổn định
                chatBoxContainer.innerHTML = ""; 
                cachedMessages.forEach(function(msg) {
                    renderMessageFromServer(msg.sender, msg.content, msg.timestamp, msg.id, false, msg.role);
                });
                scrollToBottom();
            }
            // D. Trường hợp nhận tin nhắn Realtime mới
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

                    // Chèn thêm ảnh tích xanh double-check công nhận tin nhắn đã lên DB
                    let checkDiv = pendingBubble.querySelector(".check");
                    if (checkDiv && !checkDiv.querySelector("img")) {
                        let checkImg = document.createElement("img");
                        checkImg.src = "/chat/img/check-2.png";
                        checkDiv.appendChild(checkImg);
                    }
                    
                    pendingBubble.removeAttribute("id"); 
                } else {
                    // 🟢 ĐÃ SỬA: Render tin nhắn mới với thuộc tính data.role thực tế của người gửi
                    renderMessageFromServer(data.sender, data.content, data.timestamp, null, false, data.role);
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
    
    // 1. KIỂM TRA XEM TIN NHẮN ĐÃ TỒN TẠI TRÊN MÀN HÌNH CHƯA (Xử lý tích xanh cập nhật)
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

    // 2. NẾU TIN NHẮN CHƯA CÓ TRÊN MÀN HÌNH -> TIẾN HÀNH TẠO MỚI
    let chatDiv = document.createElement("div");
    
    // 🟢 ĐÃ SỬA: Nếu NGƯỜI GỬI (sender) trùng với TÊN CỦA BẠN (MY_NAME) -> Nằm bên PHẢI (chat-r), ngược lại nằm bên TRÁI (chat-l)
    let isMyOwnMessage = (sender === MY_NAME);
    chatDiv.className = isMyOwnMessage ? "chat-r" : "chat-l";
    
    if (msgId) {
        chatDiv.id = msgId;
    }

    let messDiv = document.createElement("div");
    // 🟢 ĐÃ SỬA: Khung tin nhắn của chính mình sẽ là 'mess mess-r', của người khác là 'mess'
    messDiv.className = isMyOwnMessage ? "mess mess-r" : "mess";

    let ptag = document.createElement("p");
    // Nếu là tin nhắn của mình thì hiện trơn text, tin nhắn của người khác thì hiện thêm 'Tên: nội dung'
    ptag.innerText = isMyOwnMessage ? content : content;

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

    // Tích xanh hiển thị nếu đó là tin nhắn do chính bạn gửi và đã hoàn tất lên Server
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