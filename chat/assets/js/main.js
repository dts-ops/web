/*=============== GSAP ANIMATION ===============*/
const tl = gsap.timeline({})

/* Animate form in the center */
tl.fromTo(
   '.login__content',
   {
      y: -800, 
      scaleX: .2, 
      scaleY: .5,
      opacity: 0
   }, 
   {
      y: 0, 
      scaleX: .2, 
      scaleY: .5,
      opacity: 1, 
      duration: 1.5, 
      ease: 'power3.out'
   }
)

/* Expand vertically */
tl.to(
   '.login__content', 
   {
      scaleY: 1,
      duration: .6, 
      ease: 'power3.out'
   }, '-=0.3'
)

/* Expand horizontally */
tl.to(
   '.login__content', 
   {
      scaleX: 1,
      duration: .7, 
      ease: 'power3.out'
   }, '-=0.2'
)

/* Animate background image */
tl.to(
   '.login__img',
   {
      scale: 1.08, 
      duration: 5, 
      ease: 'power1.inOut', 
      repeat: -1, 
      yoyo: true, 
      transformOrigin: 'center center'
   }
)

/* Animate form */
gsap.defaults({opacity: 0, y: -60, ease: 'power2.out', duration: 1.2})
gsap.from('.login__title',{delay: 2.5})
gsap.from('.login__form > *',{delay: 2.7, stagger: .2})
gsap.from('.login__img',{y: 0, x: 100, delay: 3.2, ease: 'elastic.out(1,0.6)'})

// ==========================================================================
// ĐOẠN XỬ LÝ DEMO GỬI DỮ LIỆU ĐÃ KHỚP VỚI HTML CỦA BẠN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
   // Nhặt các thẻ chuẩn theo ID định dạng trong file HTML của bạn
   const loginForm = document.querySelector(".login__form");
   const usernameInput = document.getElementById("name");       // Khớp với id="name"
   const passwordInput = document.getElementById("password");   // Khớp với id="password"

   if (!loginForm) return;

   loginForm.addEventListener("submit", async (event) => {
      event.preventDefault(); // Chặn hành vi load lại trang mặc định của form

      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      try {
         // Gửi POST request dạng JSON lên server FastAPI
         const response = await fetch("https://konkoo-server-chat.hf.space/login", {
            method: "POST",
            headers: {
               "Content-Type": "application/json"
            },
            body: JSON.stringify({
               username: username,
               password: password
            })
         });

         const result = await response.json();

         if (response.ok) {
            // Hiện popup thông báo thành công từ phản hồi của server
            showNotification(`🎉 ${result.message || "Gửi dữ liệu demo thành công!"}`, "success");
         } else {
            showNotification("❌ Gửi dữ liệu thất bại!", "error");
         }

      } catch (error) {
         console.error("Lỗi kết nối:", error);
         showNotification("🌐 Không thể kết nối tới Server!", "error");
      }
   });
});

// ==========================================================================
// HÀM TẠO THÔNG BÁO POPUP
// ==========================================================================
function showNotification(message, type = "success") {
   const oldToast = document.getElementById("login-toast");
   if (oldToast) oldToast.remove();

   const toast = document.createElement("div");
   toast.id = "login-toast";
   toast.innerText = message;
   
   // Style nhanh cho popup nổi bật ở góc phải màn hình
   toast.style = `
      position: fixed; 
      top: 20px; 
      right: 20px; 
      padding: 12px 24px; 
      border-radius: 8px; 
      color: #fff; 
      font-weight: bold; 
      z-index: 9999; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
      background-color: ${type === 'success' ? '#2ed573' : '#ff4757'}
   `;

   document.body.appendChild(toast);
   
   // Tự động xóa thông báo sau 3 giây
   setTimeout(() => toast.remove(), 3000);
}
