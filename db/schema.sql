-- ============================================================
-- NeuralCode AI – schema tham khảo cho module Profile
-- Áp dụng cho PostgreSQL >= 14
-- Lưu ý: đây là schema "tham khảo" phục vụ backend.
--       Một số bảng phụ (jobs, applications, interviews,
--       evaluations, saved_jobs) là tùy chọn – nếu chưa có,
--       các API vẫn hoạt động, phần stats chỉ trả về 0.
-- ============================================================

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  full_name     VARCHAR(255) NOT NULL,
  avatar_url    TEXT,
  role          VARCHAR(20) NOT NULL
                  CHECK (role IN ('ADMIN', 'RECRUITER', 'CANDIDATE')),
  provider      VARCHAR(20) NOT NULL DEFAULT 'LOCAL'
                  CHECK (provider IN ('LOCAL', 'GOOGLE')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP
);

-- Cột này hữu ích cho admin: lọc user theo thời điểm online
CREATE INDEX IF NOT EXISTS idx_users_last_login
  ON users(last_login_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role) WHERE deleted_at IS NULL;

-- =========================
-- COMPANIES
-- =========================
CREATE TABLE IF NOT EXISTS companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  website      TEXT,
  logo_url     TEXT,
  description  TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_created_by
  ON companies(created_by);

-- =========================
-- RECRUITER PROFILES
-- =========================
CREATE TABLE IF NOT EXISTS recruiter_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  position        VARCHAR(100),
  phone           VARCHAR(20),
  bio             TEXT,
  linkedin_url    TEXT,
  cover_image_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_recruiter_profiles_company
  ON recruiter_profiles(company_id);

-- =========================
-- CANDIDATE PROFILES
-- =========================
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone            VARCHAR(20),
  github_url       TEXT,
  linkedin_url     TEXT,
  cv_url           TEXT,
  experience_years INT CHECK (experience_years >= 0)
);

-- =========================
-- JOBS (tham khảo – cần cho /api/recruiter/profile stats)
-- =========================
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                  CHECK (status IN ('OPEN', 'CLOSED', 'DRAFT', 'PAUSED')),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);

-- =========================
-- APPLICATIONS (tham khảo)
-- =========================
CREATE TABLE IF NOT EXISTS applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'REVIEWING', 'INTERVIEW',
                                   'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN')),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_job       ON applications(job_id);

-- =========================
-- INTERVIEWS (tham khảo)
-- =========================
CREATE TABLE IF NOT EXISTS interviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID REFERENCES jobs(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job       ON interviews(job_id);

-- =========================
-- EVALUATIONS (tham khảo)
-- =========================
CREATE TABLE IF NOT EXISTS evaluations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  score          INT,
  notes          TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- SAVED JOBS (tham khảo)
-- =========================
CREATE TABLE IF NOT EXISTS saved_jobs (
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (candidate_id, job_id)
);
