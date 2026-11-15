# Personnel Evaluation System - RESTful API Specification
> Compliant with the Vocational Skills Competition Standards (ปวช.) 2568 - 2572 (Item 57)

## 1. System Overview
- **Base URL**: `http://localhost:2000/api`
- **Response Format**: `application/json`
- **Authentication**: JWT Bearer Token in `Authorization` header (`Bearer <token>`)

### Standard Response Envelope
```json
{
  "status": "success",
  "message": "Operation description",
  "data": { ... }
}
```

### Error Response Envelope
```json
{
  "status": "error",
  "message": "Reason for error",
  "data": null
}
```

---

## 2. Authentication Service (`/api/auth`)

### 2.1 User Login
- **Method**: `POST`
- **Endpoint**: `/api/auth/login`
- **Description**: Authenticate user credentials and return a signed JWT token.
- **Request Body**:
  ```json
  {
    "citizenId": "1100200000002",
    "password": "pass1234"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "status": "success",
    "message": "Login successful.",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "user": {
        "id": 3,
        "citizenId": "1100200000002",
        "name": "นายสมชาย ใจดี",
        "role": "teacher",
        "roleTitle": "ผู้รับการประเมิน",
        "department": "แผนกวิชาเทคโนโลยีสารสนเทศ",
        "position": "ครู คศ.1"
      }
    }
  }
  ```

### 2.2 Candidate Registration
- **Method**: `POST`
- **Endpoint**: `/api/auth/register`
- **Description**: Register a new evaluatee (teacher) account.
- **Request Body**:
  ```json
  {
    "citizenId": "1100400000004",
    "password": "secretpassword",
    "prefix": "นาย",
    "name": "ทดสอบ นามสกุล",
    "department": "แผนกวิชาเทคโนโลยีสารสนเทศ",
    "position": "ครูผู้ช่วย",
    "signatureUrl": null
  }
  ```
- **Response**: `201 Created`

### 2.3 Current User Profile
- **Method**: `GET`
- **Endpoint**: `/api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

---

## 3. User Management Service (`/api/users`)
*Requires Role: `admin` or `hr`*

### 3.1 Get All Users
- **Method**: `GET`
- **Endpoint**: `/api/users`
- **Query Parameters**:
  - `role` *(optional)*: `ALL` | `admin` | `hr` | `teacher` | `judge`
  - `search` *(optional)*: Name or Citizen ID search term
- **Response**: `200 OK`

### 3.2 Get User by Citizen ID
- **Method**: `GET`
- **Endpoint**: `/api/users/:citizenId`
- **Path Parameters**: `citizenId` (13 digits)
- **Response**: `200 OK` or `404 Not Found`

### 3.3 Create User
- **Method**: `POST`
- **Endpoint**: `/api/users`
- **Request Body**:
  ```json
  {
    "citizenId": "1100500000005",
    "password": "userpass",
    "prefix": "ดร.",
    "fullname": "วิทยากร ผู้ทรงคุณวุฒิ",
    "role": "judge",
    "department": "คณะกรรมการประเมินภายนอก",
    "position": "ผู้ทรงคุณวุฒิ"
  }
  ```

### 3.4 Update User
- **Method**: `PUT`
- **Endpoint**: `/api/users/:citizenId`
- **Request Body**: Fields to update (`fullname`, `prefix`, `role`, `department`, `position`, `password`)

### 3.5 Delete User
- **Method**: `DELETE`
- **Endpoint**: `/api/users/:citizenId`
- **Description**: Delete user by citizen ID (Admin only).

---

## 4. Human Resources & Administration (`/api/hr`)
*Requires Role: `admin` or `hr`*

### 4.1 Get Evaluation Period
- **Method**: `GET`
- **Endpoint**: `/api/hr/period`
- **Description**: Fetch current evaluation cycle and open/closed status.

### 4.2 Update Evaluation Period
- **Method**: `PUT`
- **Endpoint**: `/api/hr/period/:id`
- **Request Body**: `{ "name": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "isOpen": true }`

### 4.3 Get Metrics
- **Method**: `GET`
- **Endpoint**: `/api/hr/metrics?periodId=1`

### 4.4 Create Metric
- **Method**: `POST`
- **Endpoint**: `/api/hr/metrics`
- **Request Body**:
  ```json
  {
    "periodId": 1,
    "title": "การจัดการเรียนการสอนแบบ Active Learning",
    "description": "จัดกิจกรรมการเรียนรู้เน้นผู้เรียนเป็นสำคัญ",
    "weight": 25,
    "evalType": "SCALE",
    "evidenceType": "PDF"
  }
  ```

### 4.5 Assign Judge to Evaluatee
- **Method**: `POST`
- **Endpoint**: `/api/hr/assignments`
- **Request Body**:
  ```json
  {
    "periodId": 1,
    "teacherId": "1100200000002",
    "judgeId": "1100300000003",
    "roleInBoard": "ประธานกรรมการ"
  }
  ```

### 4.6 Statistical Overview
- **Method**: `GET`
- **Endpoint**: `/api/hr/statistics?periodId=1`
- **Description**: Calculates total teachers, judges, completed evaluations, and overall average score.

---

## 5. Candidate Evaluatee Service (`/api/evaluatee`)
*Requires Role: `teacher`*

### 5.1 Get Evaluation Sheet & Progress
- **Method**: `GET`
- **Endpoint**: `/api/evaluatee/sheet?periodId=1`
- **Response**: Metrics list, recorded self-scores, completion percentage, and judge feedback.

### 5.2 Submit Self Evaluation
- **Method**: `POST`
- **Endpoint**: `/api/evaluatee/self-submit`
- **Request Body**:
  ```json
  {
    "periodId": 1,
    "scores": [
      { "metricId": 1, "selfScore": "4", "evidenceUrl": "/uploads/plan.pdf" },
      { "metricId": 2, "selfScore": "3", "evidenceUrl": "https://drive.google.com/..." }
    ]
  }
  ```

---

## 6. Judge Evaluator Service (`/api/judge`)
*Requires Role: `judge`*

### 6.1 Get Assigned Candidates
- **Method**: `GET`
- **Endpoint**: `/api/judge/assigned?periodId=1`

### 6.2 Get Candidate Details for Grading
- **Method**: `GET`
- **Endpoint**: `/api/judge/grading/:assignmentId`
- **Response**: Candidate info, metrics, candidate's self score, and attached evidence links.

### 6.3 Submit Evaluation Scores
- **Method**: `POST`
- **Endpoint**: `/api/judge/submit/:assignmentId`
- **Request Body**:
  ```json
  {
    "scores": {
      "1": 4,
      "2": 3,
      "3": 4
    },
    "overallFeedback": "ผลการจัดการเรียนรู้ดีเยี่ยม เอกสารประกอบครบถ้วน",
    "signature": "ดร.สมศักดิ์ ทรงธรรม"
  }
  ```

---

## 7. File Upload Service (`/api/upload`)
- **Method**: `POST`
- **Endpoint**: `/api/upload`
- **Headers**: `Content-Type: multipart/form-data`, `Authorization: Bearer <token>`
- **Field Name**: `file` (Supports `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, max 10MB)
- **Response**: `200 OK`
  ```json
  {
    "status": "success",
    "message": "File uploaded successfully.",
    "data": {
      "filename": "1730621456789-plan.pdf",
      "fileUrl": "/uploads/1730621456789-plan.pdf"
    }
  }
  ```

---

## 8. Pre-seeded Test Accounts
| Role | Citizen ID | Password | Name |
| :--- | :--- | :--- | :--- |
| **Admin** | `1100000000000` | `admin1234` | นายพัฒนพงษ์ เทคโนแอดมิน |
| **HR** | `1100100000001` | `hr1234` | นางสาวดวงใจ รัตนพร |
| **Teacher (ผู้รับการประเมิน)** | `1100200000002` | `pass1234` | นายสมชาย ใจดี |
| **Judge (กรรมการ)** | `1100300000003` | `judge1234` | ดร.สมศักดิ์ ทรงธรรม |

