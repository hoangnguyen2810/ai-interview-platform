CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    full_name     VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','RECRUITER','CANDIDATE')),
    provider      VARCHAR(20) NOT NULL DEFAULT 'LOCAL' CHECK (provider IN ('LOCAL','GOOGLE')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP,
    last_login_at TIMESTAMP
);	

CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;


CREATE TABLE companies (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    website      TEXT,
    logo_url     TEXT,
    description  TEXT,
    created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP
);

CREATE INDEX idx_companies_created_by ON companies(created_by);


CREATE TABLE recruiter_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
    position        VARCHAR(100),
    phone           VARCHAR(20),
    bio             TEXT,
    linkedin_url    TEXT,
    cover_image_url TEXT
);

CREATE TABLE candidate_profiles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone            VARCHAR(20),
    github_url       TEXT,
    linkedin_url     TEXT,
    cv_url           TEXT,
    experience_years INT CHECK (experience_years >= 0)
);

CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(255) NOT NULL,
    description TEXT,

    meeting_code VARCHAR(50) UNIQUE NOT NULL,

    room_password_hash VARCHAR(255),

    allow_guest BOOLEAN NOT NULL DEFAULT TRUE,

    max_participants INT NOT NULL DEFAULT 10,

    max_interviewers INT NOT NULL DEFAULT 2
        CHECK (max_interviewers IN (2,3)),

    duration_minutes INT NOT NULL DEFAULT 60
        CHECK (duration_minutes IN (30,60,90,120)),

    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
        CHECK (
            status IN (
                'SCHEDULED',
                'ONGOING',
                'FINISHED',
                'CANCELLED'
            )
        ),

    scheduled_at TIMESTAMP NOT NULL,

    started_at TIMESTAMP,
    ended_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    deleted_at TIMESTAMP
);

CREATE TABLE interview_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    participant_role VARCHAR(20) NOT NULL
    CHECK (
        participant_role IN (
            'HOST',
            'INTERVIEWER'
        )
    ),

    joined_at TIMESTAMP,
    left_at TIMESTAMP,

    UNIQUE(interview_id, user_id)
);

CREATE TABLE interview_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID UNIQUE NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    user_id UUID
        REFERENCES users(id),

    candidate_name VARCHAR(255) NOT NULL,

    candidate_email VARCHAR(255),

    joined_at TIMESTAMP,
    left_at TIMESTAMP
);

CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID UNIQUE NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    host_id UUID REFERENCES users(id),

    status VARCHAR(20) DEFAULT 'WAITING'
    CHECK (
        status IN (
            'WAITING',
            'LIVE',
            'ENDED'
        )
    ),

    started_at TIMESTAMP,
    ended_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    session_id UUID NOT NULL
        REFERENCES interview_sessions(id)
        ON DELETE CASCADE,

    sender_id UUID REFERENCES users(id),

    guest_name VARCHAR(255),

    content TEXT NOT NULL,

    type VARCHAR(20) DEFAULT 'TEXT'
    CHECK (
        type IN (
            'TEXT',
            'SYSTEM'
        )
    ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE coding_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(255) NOT NULL,

    description TEXT NOT NULL,

    difficulty VARCHAR(20)
    CHECK (
        difficulty IN (
            'EASY',
            'MEDIUM',
            'HARD'
        )
    ),

    created_by UUID REFERENCES users(id),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    question_id UUID NOT NULL
        REFERENCES coding_questions(id)
        ON DELETE CASCADE,

    input_data TEXT,

    expected_output TEXT,

    is_hidden BOOLEAN DEFAULT FALSE
);

CREATE TABLE interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    question_id UUID NOT NULL
        REFERENCES coding_questions(id),

    question_order INT DEFAULT 0
);

CREATE TABLE code_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID UNIQUE
        REFERENCES interviews(id)
        ON DELETE CASCADE,

    language VARCHAR(50) DEFAULT 'javascript',

    current_code TEXT,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE code_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id),

    interview_candidate_id UUID NOT NULL
        REFERENCES interview_candidates(id),

    question_id UUID NOT NULL
        REFERENCES coding_questions(id),

    language VARCHAR(50),

    source_code TEXT NOT NULL,

    status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (
        status IN (
            'PENDING',
            'RUNNING',
            'ACCEPTED',
            'WRONG_ANSWER',
            'COMPILE_ERROR',
            'RUNTIME_ERROR'
        )
    ),

    runtime_ms INT,

    memory_kb INT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    submission_id UUID UNIQUE NOT NULL
        REFERENCES code_submissions(id)
        ON DELETE CASCADE,

    score NUMERIC(5,2),

    strengths TEXT,

    weaknesses TEXT,

    feedback TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    interview_id UUID NOT NULL
        REFERENCES interviews(id),

    interview_candidate_id UUID NOT NULL
        REFERENCES interview_candidates(id),

    evaluator_id UUID NOT NULL
        REFERENCES users(id),

    technical_score NUMERIC(5,2),

    communication_score NUMERIC(5,2),

    problem_solving_score NUMERIC(5,2),

    overall_score NUMERIC(5,2),

    comments TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(interview_id, evaluator_id)
);