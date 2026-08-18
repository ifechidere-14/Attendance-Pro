-- ============================================================================
--  ATTENDANCE PRO — HIGH-CLASS DYNAMIC ATTENDANCE SYSTEM
--  CockroachDB Schema
--
--  How to run:
--    Option A — DB Code (recommended): open this file in the DB Code
--      extension for VS Code and run it against your CockroachDB cluster.
--    Option B — Command line:
--        npm run db:init
--    Option C — cockroach SQL shell:
--        cockroach sql --url "postgresql://root@localhost:26257/defaultdb?sslmode=disable" < schema.sql
--
--  The script creates the "attendance_system" database if it does not exist,
--  switches to it, then creates all tables, indexes and default data.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS attendance_system;
SET DATABASE = attendance_system;

-- ----------------------------------------------------------------------------
--  USERS  — system administrators and instructors
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      STRING NOT NULL UNIQUE,
    email         STRING NOT NULL UNIQUE,
    password_hash STRING NOT NULL,
    full_name     STRING NOT NULL,
    role          STRING NOT NULL DEFAULT 'teacher'
                    CHECK (role IN ('admin', 'teacher')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
--  STUDENTS  — the people whose attendance is tracked
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_code    STRING NOT NULL UNIQUE,
    full_name       STRING NOT NULL,
    email           STRING UNIQUE,
    phone           STRING,
    class_name      STRING,
    enrollment_date DATE DEFAULT current_date,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
--  COURSES  — classes / subjects offered
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_code   STRING NOT NULL UNIQUE,
    course_name   STRING NOT NULL,
    instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    schedule      STRING,
    location      STRING,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
--  COURSE_STUDENTS  — many-to-many enrollment between courses and students
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_students (
    course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (course_id, student_id)
);

-- ----------------------------------------------------------------------------
--  ATTENDANCE_RECORDS  — one row per student per course per day.
--  The UNIQUE (course_id, student_id, date) constraint guarantees a student
--  cannot be marked twice for the same course on the same day, and powers the
--  ON CONFLICT upsert used by the "mark attendance" API.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    marked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    date       DATE NOT NULL DEFAULT current_date,
    status     STRING NOT NULL DEFAULT 'present'
                 CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes      STRING,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, student_id, date)
);

-- ----------------------------------------------------------------------------
--  INDEXES — speed up common lookups and dashboard queries
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_name     ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_students_class    ON students(class_name);
CREATE INDEX IF NOT EXISTS idx_courses_name      ON courses(course_name);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance_records(course_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);

-- ----------------------------------------------------------------------------
--  DEFAULT ADMINISTRATOR
--  username:  admin
--  password:  Admin@1234
--
--  The password_hash below is a bcrypt hash of "Admin@1234". After applying
--  the schema you may also run "npm run seed" to refresh / reset this account.
-- ----------------------------------------------------------------------------
INSERT INTO users (username, email, password_hash, full_name, role)
SELECT 'admin', 'admin@attendance.local',
       '$2a$12$2GL1VHh930uKfR5wC0wNbOSsJN6pnEywaxYCAKDTgtzqGwxaHBKcy',
       'System Administrator', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- ----------------------------------------------------------------------------
--  SESSIONS  — express-session store table (connect-pg-simple)
--  CockroachDB-compatible definition (no "NOT DEFERRABLE" syntax).
--  createTableIfMissing is disabled in server.js so this table is created here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    sid    TEXT      NOT NULL PRIMARY KEY,
    sess   JSONB     NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions (expire);

-- ============================================================================
--  DONE — schema applied successfully.
-- ============================================================================
