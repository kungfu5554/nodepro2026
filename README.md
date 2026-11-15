# Personnel Evaluation System (ระบบการประเมินบุคลากร)
> Vocational Skills Competition: Modern IT Personnel Evaluation System (ปวช. 2568 - 2572)

## 📌 Architecture Overview
- **Back-end**: Node.js v18+, Express 5, JWT Authentication, Multer file upload, bcryptjs.
- **Database**: MySQL 8.0 (Relational schema with 7 tables & Foreign Keys), managed with phpMyAdmin.
- **Front-end**: Vue 3 Single-File Components with unified RESTful API client (`front-end/api.js`).
- **DevOps**: Docker Compose for containerized MySQL and phpMyAdmin services.

---

## 🚀 Quick Start Guide

### 1. Database & phpMyAdmin (Docker)
Start the MySQL database and phpMyAdmin containers:
```bash
docker compose up -d db-mysql phpmyadmin
```
- **MySQL Host**: `localhost:3306` (User: `root`, Password: `12345`, Database: `my_app_db`)
- **phpMyAdmin Web UI**: [http://localhost:8080](http://localhost:8080)

### 2. Back-end REST API Server
Start the Express server:
```bash
npm start
# or development auto-reload:
npm run dev
```
- **API URL**: [http://localhost:2000/api](http://localhost:2000/api)
- Database tables and initial seed data are auto-initialized on first run.

---

## 👥 Pre-configured Test Accounts

| Role | Citizen ID (13 Digits) | Password | Full Name |
| :--- | :--- | :--- | :--- |
| **Admin** (ผู้ดูแลระบบ) | `1100000000000` | `admin1234` | นายพัฒนพงษ์ เทคโนแอดมิน |
| **HR** (ฝ่ายบุคลากร) | `1100100000001` | `hr1234` | นางสาวดวงใจ รัตนพร |
| **Teacher** (ผู้รับการประเมิน) | `1100200000002` | `pass1234` | นายสมชาย ใจดี |
| **Judge** (กรรมการผู้ประเมิน) | `1100300000003` | `judge1234` | ดร.สมศักดิ์ ทรงธรรม |

---

## 📑 API Endpoints Summary
See complete documentation in [API_DOCUMENTATION.md](file:///c:/Users/Motion%20Graphic/Desktop/node%20pro/API_DOCUMENTATION.md).

- **Authentication**: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- **User Management**: `GET /api/users`, `POST /api/users`, `PUT /api/users/:citizenId`, `DELETE /api/users/:citizenId`
- **HR Operations**: `GET/PUT /api/hr/period`, `GET/POST/DELETE /api/hr/metrics`, `GET/POST /api/hr/assignments`, `GET /api/hr/statistics`
- **Evaluatee (Teacher)**: `GET /api/evaluatee/sheet`, `POST /api/evaluatee/self-submit`, `PUT /api/evaluatee/profile`
- **Judge (Evaluator)**: `GET /api/judge/assigned`, `GET /api/judge/grading/:assignmentId`, `POST /api/judge/submit/:assignmentId`
- **File Upload**: `POST /api/upload` (Supports `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`)

