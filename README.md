# Attendance Pro — High-Class Dynamic Attendance System

A full-stack attendance management platform built on **Node.js + Express** with a
**CockroachDB** database. Mark attendance per course per day, manage students and
courses, and explore live analytics & reports — all in a polished dashboard UI.

---

## ✨ Features

- 🔐 **Secure authentication** — bcrypt password hashing + HTTP-only session cookies
- 🧑‍🎓 **Student management** — add / edit / delete / search students
- 📚 **Course management** — courses, instructors, schedules, locations
- 👥 **Enrollment (rosters)** — bulk enroll / unenroll students per course
- ✅ **Attendance sheets** — mark Present / Absent / Late / Excused with notes, bulk "all present" shortcuts
- 📊 **Dashboard analytics** — stat cards, 7-day trend chart, today's donut chart, top students
- 📈 **Reports** — per-course & per-student summaries, date filters, trend charts, CSV export
- 🗄️ **CockroachDB** — fully relational, schema in `schema.sql`, connection via `.env`

---

## 📁 Project structure

```
Newfolder/
├── schema.sql            ← CockroachDB schema (run in DB Code or via npm run db:init)
├── server.js             ← Express web server
├── seed.js               ← creates the default admin account
├── .env                  ← YOUR CockroachDB connection string lives here
├── .env.example          ← template of all configuration
├── db/
│   ├── pool.js           ← CockroachDB connection pool (node-postgres)
│   └── init.js           ← applies schema.sql to your database
├── middleware/auth.js    ← session auth guards
├── routes/               ← REST API: auth, students, courses, attendance, dashboard, reports
└── public/               ← front-end (no build step)
    ├── login.html        ← sign-in page
    ├── app.html          ← dashboard shell
    ├── css/style.css     ← design system
    └── js/               ← API client, router, view modules
```

---

## 🚀 Quick start

### 1. Prerequisites
- **Node.js 18+** (tested on v24)
- A **CockroachDB** cluster (local install, or a free Serverless cluster
  at <https://cockroachlabs.cloud>)

### 2. Configure your database connection

Open **`.env`** and paste your CockroachDB connection string into `DATABASE_URL`:

```dotenv
# Local CockroachDB:
DATABASE_URL=postgresql://root@localhost:26257/attendance_system?sslmode=disable

# Serverless / cloud (from the CockroachDB Console → Connect):
DATABASE_URL=postgresql://user:password@cluster-host:26257/attendance_system?sslmode=verify-full
DB_SSL=true
```

### 3. Install dependencies

```bash
npm install
```

### 4. Create the database (CockroachDB)

**Option A — DB Code (recommended):** open `schema.sql` in the **DB Code**
extension inside VS Code, connect to your CockroachDB cluster, and **Run** the
script. It creates the `attendance_system` database, all tables, indexes, and
the default admin account.

**Option B — command line:**

```bash
npm run db:init
```

### 5. (Optional) Create / reset the admin account

```bash
npm run seed
```

### 6. Start the website

```bash
npm start
```

Then open **http://localhost:3000** and sign in:

| | |
|---|---|
| **Username** | `admin` |
| **Password** | `Admin@1234` |

> Change the password via `seed.js` / `.env` (`ADMIN_PASSWORD`) for production.

### 7. Verify the database is connected

Visit **http://localhost:3000/api/health** — it should return
`{ "status": "ok", "database": "connected", ... }`.

---

## 🗄️ Database schema (CockroachDB)

| Table | Purpose |
|---|---|
| `users` | admins & instructors (`role` CHECK: admin / teacher) |
| `students` | student profiles with unique student codes |
| `courses` | courses, optional instructor FK, schedule & location |
| `course_students` | many-to-many enrollment (course ↔ student) |
| `attendance_records` | one row per student per course per day (unique constraint + `ON CONFLICT` upserts) |

Key behaviour built into the schema:

- `UNIQUE (course_id, student_id, date)` — a student can never be marked twice
  for the same course on the same day.
- Status is constrained to `present | absent | late | excused`.
- Deleting a student/course **cascades** to enrollment and attendance records.
- `gen_random_uuid()` primary keys and `now()` timestamps everywhere.

---

## 🔌 REST API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | sign in (username or email + password) |
| POST | `/api/auth/logout` | end session |
| GET | `/api/auth/me` | current session user |
| GET | `/api/health` | DB connectivity check |
| GET/POST | `/api/students` | list / create students (`search`, `page`, `limit`) |
| GET/PUT/DELETE | `/api/students/:id` | get / update / delete a student |
| GET/POST/PUT/DELETE | `/api/courses` | course CRUD |
| GET | `/api/courses/:id/students` | enrolled students |
| POST | `/api/courses/:id/enroll` `{studentIds}` | enroll students |
| POST | `/api/courses/:id/unenroll` `{studentIds}` | unenroll students |
| GET | `/api/attendance/course/:courseId?date=` | attendance sheet for a date |
| POST | `/api/attendance/mark` | bulk upsert attendance |
| GET | `/api/attendance` | filterable records (`courseId`, `studentId`, `status`, `from`, `to`) |
| PUT | `/api/attendance/:id` | update a single record |
| GET | `/api/attendance/student/:id` | one student's history |
| GET | `/api/dashboard/summary` | KPI cards + charts data |
| GET | `/api/reports/overview` / `students` / `trend` | aggregated reports |

---

## 🧪 Common commands

```bash
npm start          # run the website (production mode)
npm run dev        # run with auto-restart on file changes
npm run db:init    # apply schema.sql to CockroachDB
npm run seed       # create/reset the admin account
```

---

## 🔒 Notes for production

- Set a strong random `SESSION_SECRET` in `.env`.
- Change the default admin password immediately.
- For cloud clusters, enable `DB_SSL=true`.
- The database name must match the one in `schema.sql` (`attendance_system`)
  or change both.
