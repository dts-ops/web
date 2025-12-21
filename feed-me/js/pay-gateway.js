// ==================
// LẤY QUERY TỪ URL
// ==================
const params = new URLSearchParams(window.location.search);
const amount = params.get("amount");
const message = params.get("message") || "Thanh toan";

// ==================
// LẤY ELEMENT
// ==================
const amountEl = document.getElementById("amountValue");
const messageEl = document.getElementById("messageValue");

const openBtn = document.getElementById("openQR");
const closeBtn = document.getElementById("closeQR");
const modal = document.getElementById("qrModal");
const qrImg = document.getElementById("qrImage");
const qrError = document.getElementById("qrError");

// ==================
// ĐỔ DỮ LIỆU FORM
// ==================
if (messageEl) {
  messageEl.textContent = message;
}

let validAmount = true;

if (!amount || isNaN(amount) || Number(amount) <= 0) {
  amountEl.textContent = "Không hợp lệ";
  validAmount = false;
  openBtn.disabled = true;
  openBtn.style.opacity = "0.6";
} else {
  const formatted = Number(amount).toLocaleString("vi-VN");
  amountEl.textContent = formatted + "đ";
  document.title = `Thanh toán ${formatted}đ`;
}

// ==================
// BẮT LỖI LOAD QR
// ==================
qrImg.onerror = () => {
  qrImg.style.display = "none";
  qrError.style.display = "block";
};

qrImg.onload = () => {
  qrImg.style.display = "block";
  qrError.style.display = "none";
};

// ==================
// MỞ MODAL
// ==================
openBtn.onclick = () => {
  if (!validAmount) return;

  // reset trạng thái
  qrImg.style.display = "block";
  qrError.style.display = "none";

  qrImg.src =
    "https://qr.sepay.vn/img?" +
    "bank=MBBank" +
    "&acc=0977782370" +
    "&amount=" + amount +
    "&des=" + encodeURIComponent(message);

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
};

// ==================
// ĐÓNG MODAL
// ==================
const closeModal = () => {
  modal.classList.remove("active");
  document.body.style.overflow = "";
};

closeBtn.onclick = closeModal;

modal.onclick = (e) => {
  if (e.target === modal) closeModal();
};
