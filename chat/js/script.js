// ==========================================================================
// 1. CẤU HÌNH BIẾN TOÀN CỤC & ĐỊNH DANH USER
// ==========================================================================
let chatBoxContainer = document.getElementById('chatBoxContainer');
let micPost = document.getElementById('micPost');
let statusSpan = document.getElementById('connection-status');

let socket = null;
let heartbeatInterval = null;
let checkNetworkInterval = null;
let missedHeartbeats = 0;
let isCheckingNetwork = false;
let isLoadingOldMessages = false;

const inputPostText = document.getElementById('input-text');
const textSubmit = document.querySelector('label[for="input-text"]');

// ==================== DATABASE ====================
const ChatDB = localforage.createInstance({
    name: 'ChatDB',
    storeName: 'files',
});

// Cờ khóa toàn cục chống gọi trùng OneSignal.login liên tiếp
window.isOneSignalLoggingIn = false;

// Đồng bộ hóa thông tin lấy từ trang đăng nhập
let MY_NAME = localStorage.getItem('chat_display_name') || 'trunwson';
let MY_ROLE = localStorage.getItem('chat_my_role') || 'n';

// Tự động cập nhật tên đối phương lên Header dựa theo vai trò thực tế
const PARTNER_NAME = MY_ROLE === 's' ? 'Nga Ngố' : 'Anh Sơn';
const headerNameSelector = document.querySelector('.profile .left-text h2');
if (headerNameSelector) {
    headerNameSelector.innerText = PARTNER_NAME;
}

console.log(
    `👉 [HỆ THỐNG] Bạn đang online với tên: ${MY_NAME} (Quyền: ${MY_ROLE})`,
);

// ==========================================================================
// 2. HÀM QUẢN LÝ GIAO DIỆN TRẠNG THÁI KẾT NỐI
// ==========================================================================
function setConnected() {
    if (statusSpan) {
        statusSpan.innerText = 'Đã kết nối';
        statusSpan.className = 'status-connected';
    }
    if (checkNetworkInterval) {
        clearInterval(checkNetworkInterval);
        checkNetworkInterval = null;
    }
    isCheckingNetwork = false;
}

function setDisconnected() {
    if (statusSpan) {
        statusSpan.innerText = 'Mất kết nối';
        statusSpan.className = 'status-disconnected';
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

    heartbeatInterval = setInterval(function () {
        if (socket && socket.readyState === WebSocket.OPEN) {
            missedHeartbeats++;
            if (missedHeartbeats > 3) {
                console.log(
                    '🚨 Server không phản hồi nhịp tim, tiến hành ngắt kết nối ảo!',
                );
                setDisconnected();
                socket.close();
                return;
            }
            socket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 5000);
}

function startCheckingNetworkNgam() {
    if (isCheckingNetwork) return;
    isCheckingNetwork = true;

    console.log('🔄 Đang chạy ngầm kiểm tra trạng thái mạng...');

    checkNetworkInterval = setInterval(async () => {
        try {
            const response = await fetch(
                'https://konkoo-server-chat.hf.space/',
                {
                    method: 'GET',
                    cache: 'no-store',
                },
            );
            if (response.status >= 200 && response.status < 500) {
                console.log(
                    '🎉 Tìm thấy Server trực tuyến! Thực hiện kết nối lại WebSocket...',
                );
                clearInterval(checkNetworkInterval);
                checkNetworkInterval = null;
                connectWebSocket();
            }
        } catch (error) {
            console.log(
                '⏳ Chưa kết nối được tới server, tiếp tục thử lại sau 3 giây...',
            );
            if (statusSpan) {
                statusSpan.innerText = 'Đang kết nối lại...';
                statusSpan.className = 'status-disconnected';
            }
        }
    }, 3000);
}

// ==========================================================================
// 4. KHỞI TẠO VÀ LẮNG NGHE SỰ KIỆN WEBSOCKET
// ==========================================================================
function uploadFile(uploadUrl, blob, content) {
    const xhr = new XMLHttpRequest();
    if (uploadUrl == 'already_exists') {
        console.log('File đã tồn tại trên server, không cần upload lại.');
    } else {
        xhr.open('PUT', uploadUrl);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                console.log(percent + '%');
            }
        };

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                console.log('Upload thành công');

                socket.send(
                    JSON.stringify({
                        type: 'image',
                        sender: MY_NAME,
                        content: content,
                    }),
                );
            } else {
                console.log('Upload thất bại');
            }
        };
        xhr.send(blob);
    }
}

function connectWebSocket() {
    socket = new WebSocket('wss://konkoo-server-chat.hf.space/ws');

    socket.onopen = function () {
        console.log('🟢 Đã kết nối thành công tới server Hugging Face!');
        setConnected();
        startHeartbeat();

        let cachedMessages =
            JSON.parse(localStorage.getItem('chat_history_cache')) || [];

        if (cachedMessages.length > 0) {
            let maxId = Math.max(...cachedMessages.map((msg) => msg.id || 0));
            console.log(
                `🔄 [ĐỒNG BỘ MỚI] Yêu cầu các tin nhắn mới phát sinh sau ID: ${maxId}`,
            );
            socket.send(
                JSON.stringify({
                    type: 'request_history',
                    id_end: maxId,
                }),
            );
        } else {
            console.log(
                '🆕 [TẢI LẦN ĐẦU] Chưa có cache, yêu cầu server cấp 50 tin mới nhất làm gốc',
            );
            socket.send(
                JSON.stringify({
                    type: 'request_history',
                }),
            );
        }
    };

    socket.onclose = function () {
        console.log('🔴 Kết nối WebSocket đã bị đóng.');
        setDisconnected();
    };

    socket.onerror = function (error) {
        console.error('❌ Lỗi kết nối WebSocket:', error);
        setDisconnected();
    };

    socket.onmessage = function (event) {
        try {
            let data = JSON.parse(event.data);
            if (data.type === 'pong') {
                missedHeartbeats = 0;
                return;
            }

            if (data.type === 'history') {
                let loadScreen = document.getElementById('first-load-screen');
                if (loadScreen) loadScreen.remove();

                let incomingMessages = data.messages || [];
                let cachedMessages =
                    JSON.parse(localStorage.getItem('chat_history_cache')) ||
                    [];

                if (data.sync_type === 'load_old') {
                    if (incomingMessages.length > 0) {
                        console.log(
                            `🔼 [TẢI CŨ] Nhận thêm ${incomingMessages.length} tin nhắn cũ về quá khứ.`,
                        );
                        let previousScrollHeight =
                            chatBoxContainer.scrollHeight;

                        let filteredOld = incomingMessages.filter(
                            (m) => !cachedMessages.some((c) => c.id === m.id),
                        );
                        cachedMessages = [...filteredOld, ...cachedMessages];
                        localStorage.setItem(
                            'chat_history_cache',
                            JSON.stringify(cachedMessages),
                        );

                        incomingMessages.reverse().forEach(function (msg) {
                            renderMessageFromServer(
                                msg.sender,
                                msg.type,
                                msg.content,
                                msg.timestamp,
                                msg.id,
                                false,
                                msg.role,
                                true,
                            );
                        });

                        let newScrollHeight = chatBoxContainer.scrollHeight;
                        chatBoxContainer.scrollTop =
                            newScrollHeight - previousScrollHeight;
                    } else {
                        console.log(
                            '📥 [HỆ THỐNG] Đã tải hết lịch sử trong database, không còn tin nào cũ hơn.',
                        );
                    }
                    isLoadingOldMessages = false;
                } else {
                    if (incomingMessages.length > 0) {
                        console.log(
                            `📥 [ĐỒNG BỘ] Nhận thêm ${incomingMessages.length} tin mới.`,
                        );
                        let filteredNew = incomingMessages.filter(
                            (m) => !cachedMessages.some((c) => c.id === m.id),
                        );
                        cachedMessages = [...cachedMessages, ...filteredNew];
                    }

                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem(
                        'chat_history_cache',
                        JSON.stringify(cachedMessages),
                    );

                    chatBoxContainer.innerHTML = '';
                    cachedMessages.forEach(function (msg) {
                        renderMessageFromServer(
                            msg.sender,
                            msg.type,
                            msg.content,
                            msg.timestamp,
                            msg.id,
                            false,
                            msg.role,
                            false,
                        );
                    });
                    scrollToBottom();
                }
            } else if (data.type === 'msg' || data.type === 'image') {
                let pendingBubble = document.getElementById(data.tempId);
                let exactTimestamp = data.timestamp || new Date().toISOString();
                console.log({
                    tempId: data.tempId,
                    pendingBubble,
                    sender: data.sender,
                    myName: MY_NAME,
                });
                if (pendingBubble && data.sender === MY_NAME) {
                    let spanTime = pendingBubble.querySelector('.check span');
                    if (spanTime) {
                        let dateObj = new Date(exactTimestamp);
                        let hours = dateObj
                            .getHours()
                            .toString()
                            .padStart(2, '0');
                        let minutes = dateObj
                            .getMinutes()
                            .toString()
                            .padStart(2, '0');
                        spanTime.innerText = `${hours}:${minutes}`;
                    }
                    let checkDiv = pendingBubble.querySelector('.check');
                    if (checkDiv && !checkDiv.querySelector('img')) {
                        let checkImg = document.createElement('img');
                        checkImg.src = '/chat/img/check-2.png';
                        checkDiv.appendChild(checkImg);
                    }

                    if (data.id) pendingBubble.id = data.id;
                } else {
                    renderMessageFromServer(
                        data.sender,
                        data.type,
                        data.content.text,
                        exactTimestamp,
                        data.id,
                        false,
                        data.role,
                        false,
                    );
                    scrollToBottom();
                }

                let cachedMessages =
                    JSON.parse(localStorage.getItem('chat_history_cache')) ||
                    [];
                if (
                    data.id &&
                    !cachedMessages.some((msg) => msg.id === data.id)
                ) {
                    cachedMessages.push({
                        id: data.id,
                        type: data.type,
                        sender: data.sender,
                        content: data.content,
                        timestamp: exactTimestamp,
                        role: data.role || 'n',
                    });
                    cachedMessages.sort((a, b) => a.id - b.id);
                    localStorage.setItem(
                        'chat_history_cache',
                        JSON.stringify(cachedMessages),
                    );
                }
            } else if (data.type === 'upload_url') {
			// Hàm upload
				ChatDB.getItem(data.id).then(blob => {
					uploadFile(data.url, blob, data.content);
				});
			}
            //
        } catch (e) {
            console.error('Lỗi xử lý dữ liệu nhận từ server:', e);
        }
    };
}

// ==========================================================================
// 5. HÀM ĐỔ TIN NHẮN LÊN GIAO DIỆN
// ==========================================================================
// Khởi tạo hàm băm SHA-256 cho file (dùng để kiểm tra trùng lặp)
async function sha256File(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getImageSize(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(img.src);

            resolve({
                width: img.naturalWidth,
                height: img.naturalHeight,
            });
        };

        img.onerror = reject;

        img.src = URL.createObjectURL(file);
    });
}

let renderMessageFromServer = function (
    sender,
    type = 'msg',
    content, // Object
    time,
    msgId = null,
    isPending = false,
    role = 'n',
    prependToTop = false,
) {
    if (msgId && document.getElementById(msgId) && !prependToTop) {
        return;
    }

    const chatDiv = document.createElement('div');
    const isMyOwnMessage = sender === MY_NAME;
    chatDiv.className = isMyOwnMessage ? 'chat-r' : 'chat-l';

    if (msgId) chatDiv.id = msgId;

    const messDiv = document.createElement('div');
    messDiv.className = isMyOwnMessage ? 'mess mess-r' : 'mess';

    // ===== Render nội dung =====
    switch (type) {
		
        case 'msg': {
            const p = document.createElement('p');
            p.innerText = content;
            messDiv.appendChild(p);
            break;
        }

        case 'image': {
            messDiv.classList.add('img-mess');

            const img = document.createElement('img');
            img.className = 'img-chat';

            messDiv.appendChild(img);
            content = JSON.parse(content);

			ChatDB.getItem(content.id).then((blob) => {
				console.log(blob);
				if (blob) {
					const url = URL.createObjectURL(blob);

					img.onload = () => {
						console.log("Ảnh load OK");
						URL.revokeObjectURL(url);
					};

					img.onerror = (e) => {
						console.log("Ảnh lỗi", e);
					};


					img.src = url;
				} else {
					img.src = "/files/" + content.id;
				}
			});
			break
        }

        case 'video': {
            const video = document.createElement('video');
            video.controls = true;
            // video.src = ...
            messDiv.appendChild(video);
            break;
        }

        case 'audio': {
            const audio = document.createElement('audio');
            audio.controls = true;
            // audio.src = ...
            messDiv.appendChild(audio);
            break;
        }

        case 'other': {
            const file = document.createElement('div');
            file.className = 'file-message';
            file.innerText = content.originalName;
            messDiv.appendChild(file);
            break;
        }

        default: {
            const p = document.createElement('p');
            p.innerText = 'Không hỗ trợ loại tin nhắn';
            messDiv.appendChild(p);
        }
    }

    // ===== Check =====
    const checkDiv = document.createElement('div');
    checkDiv.className = 'check';

    let displayTime = time;

    if (
        time &&
        time !== 'Đang gửi...' &&
        (time.includes('T') || !isNaN(Date.parse(time)))
    ) {
        const dateObj = new Date(time);
        displayTime =
            `${dateObj.getHours().toString().padStart(2, '0')}:` +
            `${dateObj.getMinutes().toString().padStart(2, '0')}`;
    }

    const spanTime = document.createElement('span');
    spanTime.innerText = displayTime;
    checkDiv.appendChild(spanTime);

    if (isMyOwnMessage && !isPending) {
        const checkImg = document.createElement('img');
        checkImg.src = '/chat/img/check-2.png';
        checkDiv.appendChild(checkImg);
    }

    messDiv.appendChild(checkDiv);
    chatDiv.appendChild(messDiv);

    if (prependToTop) {
        chatBoxContainer.prepend(chatDiv);
    } else {
        chatBoxContainer.appendChild(chatDiv);
    }
    scrollToBottom();
};

// Cơ chế cuộn xuống cuối cùng của trang

let scrollToBottom = function () {
    if (chatBoxContainer) {
        setTimeout(() => {
            chatBoxContainer.scrollTop = chatBoxContainer.scrollHeight;
        }, 50); // Trì hoãn 50ms để DOM kịp render tin nhắn mới
    }
};

// ==========================================================================
// 6. CƠ CHẾ THEO DÕI SỰ KIỆN CUỘN LÊN ĐỈNH ĐỂ TẢI THÊM TIN CŨ
// ==========================================================================
if (chatBoxContainer) {
    chatBoxContainer.addEventListener('scroll', function () {
        if (chatBoxContainer.scrollTop <= 5 && !isLoadingOldMessages) {
            let cachedMessages =
                JSON.parse(localStorage.getItem('chat_history_cache')) || [];

            if (cachedMessages.length > 0) {
                isLoadingOldMessages = true;
                let minId = Math.min(
                    ...cachedMessages.map((msg) => msg.id || Infinity),
                );

                if (minId !== Infinity && minId > 1) {
                    console.log(
                        `🔼 [YÊU CẦU] Người dùng vuốt lên đỉnh, yêu cầu tải 50 tin nhắn cũ trước ID: ${minId}`,
                    );
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(
                            JSON.stringify({
                                type: 'request_history',
                                id_start: minId,
                            }),
                        );
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
let postTextAction = function (event) {
    if (event) event.preventDefault();

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ Không thể gửi tin, WebSocket chưa được kết nối!');
        return;
    }

    let textValue = inputPostText.value.trim();
    if (textValue === '') return;

    let tempId = 'temp-' + Date.now();

    renderMessageFromServer(
        MY_NAME,
        'msg',
        textValue,
        'Đang gửi...',
        tempId,
        true,
        MY_ROLE,
        false,
    );
    scrollToBottom();

    let msgPayload = {
        sender: MY_NAME,
        type: 'msg',
        content: {
            text: textValue,
        },
        tempId: tempId,
    };
    socket.send(JSON.stringify(msgPayload));
    inputPostText.value = '';
};

if (textSubmit) {
    textSubmit.addEventListener('click', postTextAction);
}

if (inputPostText) {
    inputPostText.addEventListener('keypress', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            postTextAction(event);
        }
    });
}

window.addEventListener('offline', function () {
    console.log('🌐 Trình duyệt phát hiện ngắt mạng Internet.');
    setDisconnected();
    if (socket) socket.close();
});

// ==========================================================================
// 8. LOGIC BANNER DROPDOWN & LOGOUT MENU + ĐỊNH DANH AN TOÀN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerLabel = document.querySelector('.hamburger');
    const pushNotifyCheckbox = document.getElementById('cbx2');
    const dropdownCheckbox = document.getElementById('dropdownBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    // ĐỒNG BỘ ĐỊNH DANH AN TOÀN (NƠI DUY NHẤT ĐƯỢC PHÉP LOGIN)
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
        setTimeout(async () => {
            if (window.isOneSignalLoggingIn) return; // Chặn trùng lặp
            try {
                const currentExternalId = await OneSignal.User.externalId;
                // Sử dụng MY_NAME đã khai báo đồng bộ ở đầu file
                if (currentExternalId !== MY_NAME) {
                    window.isOneSignalLoggingIn = true;
                    await OneSignal.login(MY_NAME);
                    console.log(
                        '🟢 Đã định danh thiết bị này thuộc về user:',
                        MY_NAME,
                    );
                } else {
                    console.log(
                        '✅ Thiết bị đã được định danh chính xác trước đó:',
                        MY_NAME,
                    );
                }
            } catch (error) {
                console.error('❌ Lỗi định danh OneSignal:', error);
            } finally {
                window.isOneSignalLoggingIn = false;
            }
        }, 1500); // Trì hoãn 1.5 giây chờ SDK ổn định hoàn toàn
    });

    if (hamburgerLabel && dropdownCheckbox && dropdownMenu) {
        // 1. Lắng nghe sự kiện khi ô checkbox thay đổi trạng thái (Tích chọn hoặc Bỏ chọn)
        hamburgerLabel.addEventListener('click', (e) => {
            // Ngăn sự kiện click lan ra ng oài window gây đóng menu lập tức
            e.stopPropagation();

            if (dropdownCheckbox.checked) {
                dropdownMenu.classList.add('show'); // Nếu checkbox ĐƯỢC TÍCH -> Hiện menu
            } else {
                dropdownMenu.classList.remove('show'); // Nếu checkbox BỎ TÍCH -> Ẩn menu
            }
        });
        dropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Giữ sự kiện click nằm im trong menu, không báo lên window
        });

        // 2. Khi click ra bất kỳ đâu ngoài màn hình -> Tự động bỏ tích checkbox và ẩn menu
        window.addEventListener('click', (e) => {
            // Kiểm tra xem menu có đang mở hay không
            if (dropdownMenu.classList.contains('show')) {
                dropdownCheckbox.checked = false; // Đưa ô checkbox về trạng thái hủy tích chọn
                dropdownMenu.classList.remove('show'); // Ẩn menu đi
            }
        });
    }

    // Xử lý sự kiện khi bấm nút Đăng xuất
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // 🟢 CHỈ ĐỔI CHỮ THÀNH "Deleting..." (Không thêm class hiệu ứng, không chặn e.stopPropagation)
            const textElement = logoutBtn.querySelector('.text');
            if (textElement) {
                textElement.innerText = 'Deleting...';
            }

            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(async function (OneSignal) {
                try {
                    await OneSignal.logout();
                    console.log(
                        '🔴 Đã xóa định danh OneSignal của thiết bị này!',
                    );
                } catch (error) {
                    console.error('❌ Lỗi gỡ định danh OneSignal:', error);
                } finally {
                    // Xóa sạch dữ liệu và chuyển hướng ngay lập tức
                    localStorage.clear();
                    sessionStorage.clear();
                    console.log('🔒 Đã xóa sạch session đăng nhập.');
                    window.location.replace('/chat/login.html');
                }
            });
        });
    }
});

// ==========================================================================
// 9. THIẾT LẬP CẤU HÌNH BAN ĐẦU ONESIGNAL
// ==========================================================================
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function (OneSignal) {
    await OneSignal.init({
        appId: '3bf4b621-fd87-4e03-87a6-fe336bd3d73a',
        safari_web_id:
            'web.onesignal.auto.313afc18-65a3-4cb5-bd8a-eabd69c6e4d8',
        notifyButton: {
            enable: false,
        },
    });
});

// Sử lí toàn bộ sự kiện nhấn nút trên giao diện
document.addEventListener('DOMContentLoaded', function () {
    const pushNotifyCheckbox = document.getElementById('cbx2');
    const dropdownCheckbox = document.getElementById('dropdownBtn'); // Nút Hamburger đóng/mở menu
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn'); // Gom luôn logic nút đăng xuất của bro vào đây

    const cameraInput = document.getElementById('open-camera');
    const imageUploadInput = document.getElementById('imageUpload');

    // Lắng nghe nút Chụp ảnh
    if (cameraInput) {
    }

    // Lắng nghe nút Chọn ảnh từ máy
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', async (event) => {
            // Lấy ra file đầu tiên người dùng vừa chọn
            const file = event.target.files[0];

            // Đọc tên người gửi từ Local Storage
            const sender = localStorage.getItem('chat_display_name');

            // Phòng hờ trường hợp người dùng mở hộp thoại lên rồi bấm "Cancel" không chọn gì
            if (!file) return;

            // Hiển thị trạng thái lên UI của bạn (Ví dụ: Đang xử lý...)
            console.log(
                `Đã chọn ảnh: ${file.name}. Bắt đầu tiến trình upload...`,
            );
            const options = {
                maxSizeMB: 1, // tối đa 1MB
                maxWidthOrHeight: 1280, // resize nếu quá lớn
                useWebWorker: true,
                initialQuality: 0.8,
            };

            const compressedFile = await imageCompression(file, options);
            const { width, height } = await getImageSize(compressedFile);
            const hash = await sha256File(compressedFile);
            let tempId = 'temp-' + Date.now();
            let imgPayload = {
                sender: MY_NAME,
                type: 'image',
                content: {
                    id: hash,
                    ext: file.name.split('.').pop().toLowerCase(),
                    originalName: file.name,
                    wdth: width,
                    height: height,
                },
                tempId: tempId,
            };

            // Lưu dữ liệu vào indexDB
            try {
                await ChatDB.setItem(hash, compressedFile);

                console.log('Đã lưu dữ liệu vào IndexDB');

                renderMessageFromServer(
                    MY_NAME,
                    'image',
                    JSON.stringify(imgPayload.content),
                    'Đang gửi...',
                    tempId,
                    true,
                    MY_ROLE,
                    false,
                );

                socket.send(JSON.stringify(imgPayload));
                console.log('Đã gửi thành công');
            } catch (err) {
                console.error('Lỗi lưu IndexDB:', err);
            }

            // showStatus('⏳ Đang xin vé upload...', 'loading');
        });
    }
    // ==========================================================================
    // 🟢 BƯỚC 1: ĐỒNG BỘ TRẠNG THÁI CHECKBOX TRỰC TIẾP VỚI MÁY TÍNH KHI VỪA TẢI TRANG
    // ==========================================================================
    if (pushNotifyCheckbox) {
        // Đọc trực tiếp quyền thông báo từ API gốc của Trình duyệt (Không phụ thuộc SDK)
        const currentPermission = Notification.permission;

        if (currentPermission === 'granted') {
            // Máy tính hiển thị "Cho phép" -> Tự động tích chọn checkbox
            pushNotifyCheckbox.checked = true;
            console.log(
                '🔄 Đồng bộ Trình duyệt: Thiết bị ĐÃ BẬT thông báo hệ thống.',
            );
        } else {
            // Máy tính chưa bật (default) hoặc đã chặn (denied) -> Bỏ tích chọn
            pushNotifyCheckbox.checked = false;
            console.log(
                `🔄 Đồng bộ Trình duyệt: Thiết bị ĐANG TẮT thông báo (Quyền: ${currentPermission})`,
            );
        }
    }

    // ==========================================================================
    // 🔵 BƯỚC 2: XỬ LÝ BẬT / TẮT KHI USER NHẤN VÀO CHECKBOX
    // ==========================================================================
    if (pushNotifyCheckbox) {
        pushNotifyCheckbox.addEventListener('change', function (e) {
            e.stopPropagation(); // Chặn tuyệt đối lan truyền sự kiện để menu không bị sập bất ngờ

            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function (OneSignal) {
                if (pushNotifyCheckbox.checked) {
                    console.log('🔔 Đang yêu cầu cấp quyền bật thông báo...');
                    try {
                        await OneSignal.Notifications.requestPermission();
                        await OneSignal.User.PushSubscription.optIn();
                        console.log(
                            '✅ Đã kích hoạt API thông báo phía Client!',
                        );
                    } catch (err) {
                        console.error('❌ Lỗi khi bật thông báo:', err);
                        pushNotifyCheckbox.checked = false;
                    }
                } else {
                    console.log('🔕 Đang tắt nhận thông báo từ hệ thống...');
                    try {
                        await OneSignal.User.PushSubscription.optOut();
                        console.log(
                            '✅ Đã hủy kích hoạt API thông báo phía Client!',
                        );
                    } catch (err) {
                        console.error('❌ Lỗi khi tắt thông báo:', err);
                        pushNotifyCheckbox.checked = true;
                    }
                }

                // Tự động đóng menu sau khi thao tác xong thông báo
                setTimeout(() => {
                    if (dropdownMenu) dropdownMenu.classList.remove('show');
                    if (dropdownCheckbox) dropdownCheckbox.checked = false;
                }, 500);
            });
        });
    }

    // ==========================================================================
    // 🔴 BƯỚC 3: LOGIC ĐĂNG XUẤT (CHỈ ĐỔI CHỮ THÀNH DELETING..., TỰ SẬP MENU)
    // ==========================================================================
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            // Chỉ đổi chữ Đăng xuất thành Deleting... để tạo cảm giác xử lý ngầm nhanh gọn
            const textElement = logoutBtn.querySelector('.text');
            if (textElement) {
                textElement.innerText = 'Deleting...';
            }

            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(async function (OneSignal) {
                try {
                    await OneSignal.logout();
                    console.log('🔴 Đã xóa định danh OneSignal trên thiết bị!');
                } catch (error) {
                    console.error('❌ Lỗi gỡ định danh OneSignal:', error);
                } finally {
                    // Xóa sạch bộ nhớ máy con và đá sang trang login
                    localStorage.clear();
                    sessionStorage.clear();
                    console.log('🔒 Đã xóa sạch session đăng nhập.');
                    window.location.replace('/chat/login.html');
                }
            });
        });
    }
});

// 10. Server đang bảo trì
// Cập nhật lại hàm thông báo Mất kết nối
function setDisconnected() {
    if (statusSpan) {
        statusSpan.innerText = 'Mất kết nối';
        statusSpan.className = 'status-disconnected';
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

    console.log('🔄 Đang chạy ngầm kiểm tra trạng thái mạng...');
    const maintenanceScreen = document.getElementById('maintenance-screen');

    checkNetworkInterval = setInterval(async () => {
        try {
            // Ping thử tới endpoint HTTP của Server
            const response = await fetch(
                'https://konkoo-server-chat.hf.space/',
                {
                    method: 'GET',
                    cache: 'no-store',
                },
            );

            if (response.status >= 200 && response.status < 500) {
                console.log(
                    '🎉 Server trực tuyến! Ẩn bảo trì và kết nối lại...',
                );

                // Server sống lại -> Ẩn màn hình bảo trì đi
                if (maintenanceScreen)
                    maintenanceScreen.style.setProperty(
                        'display',
                        'none',
                        'important',
                    );

                clearInterval(checkNetworkInterval);
                checkNetworkInterval = null;
                connectWebSocket();
            } else {
                // Server trả về lỗi 502, 503... -> Hiện bảo trì
                if (maintenanceScreen)
                    maintenanceScreen.style.setProperty(
                        'display',
                        'flex',
                        'important',
                    );
            }
        } catch (error) {
            // Lỗi sập nguồn hoàn toàn (Fetch lỗi, Server ngủ đông, rớt mạng mạng cục bộ)
            console.log(
                '⏳ Chưa kết nối được tới server, bật giao diện bảo trì...',
            );
            if (statusSpan) {
                statusSpan.innerText = 'Đang kết nối lại...';
                statusSpan.className = 'status-disconnected';
            }

            // Hiện màn hình bảo trì chặn user bấm bậy
            if (maintenanceScreen)
                maintenanceScreen.style.setProperty(
                    'display',
                    'flex',
                    'important',
                );
        }
    }, 3000); // 3 giây ping 1 lần
}

// let selectedFile = null;
// let previewUrl = null;

// function showPreview(file) {
//   selectedFile = file;

//   if (previewUrl) {
//     URL.revokeObjectURL(previewUrl);
//   }

//   previewUrl = URL.createObjectURL(file);

//   previewImage.src = previewUrl;
//   previewContainer.hidden = false;
// }

// imageUpload.addEventListener("change", (e) => {
//   const file = e.target.files[0];
//   if (!file) return;

//   showPreview(file);
// });

// document.addEventListener("paste", (e) => {
//   for (const item of e.clipboardData.items) {
//     if (item.type.startsWith("image/")) {
//       const file = item.getAsFile();

//       showPreview(file);

//       break;
//     }
//   }
// });

// removePreview.onclick = () => {
//   selectedFile = null;

//   if (previewUrl) {
//     URL.revokeObjectURL(previewUrl);
//     previewUrl = null;
//   }

//   previewImage.src = "";
//   previewContainer.hidden = true;
// };

// KHỞI CHẠY HỆ THỐNG LẦN ĐẦU TIÊN
connectWebSocket();
