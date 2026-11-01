# ☕ BrewLite - Đồ Án Quản Lý Đặt Cà Phê Không Dùng Tiền Mặt

**Trường Đại học Sài Gòn — Khoa Công nghệ Thông tin**  
**Môn học:** Công nghệ Phần mềm | **Học kỳ:** I, năm học 2026–2027

---

## 🚀 Cách 1: Chạy trọn gói qua Docker Compose (Khuyến nghị cho chấm bài - Task 9)

Chỉ với một lệnh duy nhất, toàn bộ CSDL PostgreSQL, Backend (NestJS) và Frontend (Next.js) sẽ tự động build, migrate, seed dữ liệu mẫu và khởi chạy:

```bash
docker compose up --build
```

Sau khi chạy xong:
* **Frontend Web App:** http://localhost:3000
* **Quầy pha chế Barista:** http://localhost:3000/barista
* **Backend API URL:** http://localhost:4000/api
* **Swagger API Docs:** http://localhost:4000/api/docs

---

## 💻 Cách 2: Chạy thủ công trên máy (Chế độ Development)

### Yêu cầu trước khi chạy:
* Bật sẵn **Docker Desktop** (để chạy Database).
* Cài sẵn **Node.js** v22.22.3 trở lên.
* *(Windows PowerShell nếu bị chặn lệnh)*: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

### 1. Bật Database
```bash
docker compose up -d db
```

### 2. Chạy Backend (Terminal 1)
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```
* **Swagger Docs:** http://localhost:4000/api/docs
* **Prisma Studio (Xem DB):** `npx prisma studio` (truy cập http://localhost:5555)
* **Chạy Unit Test:** `npm test`
ưadd
### 3. Chạy Frontend (Terminal 2)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
* **Web App:** http://localhost:3000

---

## 🔑 Tài khoản kiểm thử có sẵn

| Vai trò | Email | Mật khẩu | Chức năng chính |
|---|---|---|---|
| **Barista (Nhân viên)** | `barista@brewlite.com` | `Barista@123` | Nhận đơn hàng, đổi trạng thái (PAID → PREPARING → READY → COMPLETED), nhập kho |
| **Khách hàng** | `demo@brewlite.com` | `Demo@1234` | Xem menu, đặt hàng, áp mã giảm giá, tích điểm loyalty |
