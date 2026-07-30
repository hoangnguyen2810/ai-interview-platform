BÁO CÁO KHẢO SÁT CODEBASE AI — CHUẨN BỊ TÍNH NĂNG AI-GENERATED REPORT
Tất cả đường dẫn là absolute path (e:\neuralcode-ai\...). Mọi line range là startLine:endLine để bạn tra cứu nhanh.

1. CODE/AI HIỆN TẠI
   1.1. Stack AI đang dùng (chỉ có Ollama local, không OpenAI/Gemini/Anthropic)
   Dự án chạy AI trên Ollama local với model qwen2.5-coder:3b (chạy qua package ollama cho Node). Mặc định host http://127.0.0.1:11434, override bằng env OLLAMA_HOST và AI_REVIEW_MODEL.

lib\ai-analyzer.ts:14-22 — class Ollama từ package ollama, const MODEL = process.env.AI_REVIEW_MODEL || "qwen2.5-coder:3b", OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434".
lib\ai-reviewer.ts:14-22 — cùng pattern.
lib\ai-test-suggestions.ts:6-12 — cùng pattern.
Không có wrapper OpenAI/Gemini/Anthropic ở phía Node; ai/ (Python, ai\app\main.py) chỉ chạy local Whisper (faster_whisper) cho STT và ollama cho chat — KHÔNG dùng cho report.

1.2. 3 AI modules (refactor gần đây) + barrel
lib\ai-analyzer.ts:127-177 — analyzeExecutionMode(input) → phân loại stdin | hardcoded | function | unknown. Trả về ExecutionModeAnalysis { executionMode, confidence, reason, entryPoint, usesHardcodedValues }.

System prompt ở lib\ai-analyzer.ts:39-62 (tiếng Việt, JSON-only, có schema ép buộc).
Helper ollamaChat({system, user}) ở lib\ai-analyzer.ts:89-103 với temperature: 0.1, num_predict: 600.
extractJsonObject ở lib\ai-analyzer.ts:64-82 (parse JSON robust — chịu markdown json wrapper).
lib\ai-reviewer.ts:143-214 — reviewCode(input) → trả CodeReview { correctness: PASS|PARTIAL|FAIL|CANNOT_RUN, algorithm, time_complexity, space_complexity, overall_score (0..10), correctness_score, algorithm_score, strengths, weaknesses, hint }.

System prompt REVIEWER_SYSTEM_PROMPT ở lib\ai-reviewer.ts:43-73.
ollamaChat ở lib\ai-reviewer.ts:100-114 với temperature: 0.2, num_predict: 1500.
Có cơ chế fallback khi Ollama fail / JSON parse fail — không throw ra ngoài.
lib\ai-test-suggestions.ts:93-139 — suggestTestCases(input) → trả ProposedTestCase[] { input, expected_output, description, edge_case_type }. Cap 1..5 (mặc định 3).

System prompt ở lib\ai-test-suggestions.ts:20-42.
ollamaChat ở lib\ai-test-suggestions.ts:69-83 với temperature: 0.3, num_predict: 1500.
lib\ai-code-review.ts:1-65 — barrel re-export. Có 2 hàm deprecated shim analyzeCode và generateTestCases để giữ backward-compat.

1.3. Endpoint code-review (đã có sẵn)
app\api\interviews\[meetingCode]\code-review\route.ts (542 dòng) — endpoint chính gọi AI:

POST (route.ts:82-446) — flow:

getAuthUserFromRequest(req) (route.ts:99).
Validate UUID submissionId (route.ts:117-122).
Fetch code_submissions + code_executions + coding_questions qua JOIN (route.ts:125-147).
Upsert ai_reviews row với model_name = 'qwen2.5-coder:3b' (route.ts:159-167).
analyzeExecutionMode (route.ts:170-176).
reviewCode (route.ts:181-207).
suggestTestCases cap 3 (route.ts:212-223).
UPDATE ai_reviews với toàn bộ verdict + metadata (route.ts:226-265).
INSERT ai_generated_test_cases (PENDING) (route.ts:268-294).
Nếu executionMode === "stdin" → auto-run sandbox, UPDATE kết quả (route.ts:302-337).
Recompute final scores factoring pass-rate (route.ts:340-368).
Trả payload + emit submission:reviewed qua Socket.IO (route.ts:386-444).
maxDuration = 60 (route.ts:30) vì có thể mất ~30s (qwen + N×sandbox).
Env: SANDBOX_SERVICE_URL, SOCKET_SERVER_URL.
GET (route.ts:450-541) — fetch persisted review + tests (dùng cho cả candidate UI lẫn recruiter UI). Filter qua meeting code → interview_id → submission_id.

1.4. Endpoint liên quan
Endpoint Method Mục đích File
/api/interviews/[meetingCode]/submissions
POST
Candidate submit, INSERT code_submissions + code_executions, fire-and-forget POST code-review
app\api\interviews\[meetingCode]\submissions\route.ts:333-349
/api/interviews/[meetingCode]/submissions
GET
Recruiter list submissions (status, source_code, stdout/stderr, runtime)
app\api\interviews\[meetingCode]\submissions\route.ts:373-448
/api/interviews/[meetingCode]/ai-tests
POST/PATCH/DELETE
Recruiter manage AI test cases (run/add/edit/delete)
app\api\interviews\[meetingCode]\ai-tests\route.ts (456 dòng)
/api/auth/me
GET
Trả { user: { id, email, fullName, avatarUrl, role } } — UI dùng để gate recruiter-only actions
app\api\auth\me\route.ts:13-49
1.5. AI Assistant Panel trong recruiter dashboard
app\components\recruiter-dashboard\AIAssistantPanel.tsx:1-85 — chỉ là static placeholder. Nội dung:
Title "Hỗ trợ tạo chuỗi phỏng vấn" (AIAssistantPanel.tsx:4-6).
Subhead "CodePilot AI Engine" (AIAssistantPanel.tsx:19-22).
2 button hard-coded: "Tải lên danh sách ứng viên (Excel/CSV/PDF)" (AIAssistantPanel.tsx:28-38), "Phân bổ lịch trình tự động" (AIAssistantPanel.tsx:53-61), "Tạo hàng loạt phòng chờ" (AIAssistantPanel.tsx:62-70).
Không có API call — đây là UI mock, chưa wire vào bất cứ endpoint nào.
Được render ở app\recruiter\dashboard\page.tsx:28 trong cột phải.
1.6. AIReviewList (UI đã có)
app\components\interview-room\coding\AIReviewList.tsx:148-545 — UI 2 cột: list submissions bên trái, review chi tiết bên phải.
interface Review (AIReviewList.tsx:6-25) định nghĩa đầy đủ shape review.
interface AITestCase (AIReviewList.tsx:27-38) — có source: "AI" | "MANUAL", aiVerified: boolean | null.
Detect role bằng /api/auth/me (AIReviewList.tsx:165-180) → ẩn/hiện nút Edit/Run.
Render ReviewContent (AIReviewList.tsx:547-844) — banner execution mode, score bars, complexity, strengths/weaknesses, hint, list test cases.
Hiện chỉ mount trong interview room (app\components\interview-room\coding\RecruiterCodingView.tsx reference), không có trang recruiter dashboard độc lập để xem review sau khi buổi kết thúc.
1.7. AI Python service (FastAPI) — không dùng cho report
ai\app\main.py, ai\app\api\chat.py, ai\app\api\cv.py, ai\app\api\sessions.py, ai\app\api\speech.py — phục vụ STT (Whisper) + CV upload + chat session. Không liên quan đến report trong interview. 2. SCHEMA LIÊN QUAN
2.1. File schema gốc: db\schema.sql (378 dòng)
Tổng cộng 17 bảng (xem db\schema.sql:1-378):

Bảng Dòng Cột đáng chú ý
users
db\schema.sql:1-14 (+ migration 019_password_changed_at.sql:17-25)
id UUID, role CHECK('ADMIN','RECRUITER','CANDIDATE'), provider CHECK('LOCAL','GOOGLE'), deleted_at, password_changed_at TIMESTAMPTZ NOT NULL (track rotate JWT).
companies
db\schema.sql:19-28
created_by UUID REFERENCES users(id), deleted_at
recruiter_profiles
db\schema.sql:33-42
user_id UNIQUE REFERENCES users(id)
candidate_profiles
db\schema.sql:44-52
user_id UNIQUE REFERENCES users(id)
interviews
db\schema.sql:54-94
meeting_code UNIQUE, `status CHECK(SCHEDULED
recordings
db\schema.sql:96-130
interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE, meeting_code, file_name, file_url, duration_seconds, `status CHECK(PROCESSING
interview_participants
db\schema.sql:140-163
interview_id, user_id, participant_role CHECK('HOST','INTERVIEWER'), joined_at, left_at, UNIQUE(interview_id, user_id).
interview_candidates
db\schema.sql:165-181
interview_id UNIQUE, user_id UUID NULLABLE (cho phép guest/manual), candidate_name, candidate_email, joined_at, left_at.
interview_sessions
db\schema.sql:183-205
interview_id UNIQUE, `status CHECK(WAITING
messages
db\schema.sql:207-233
session_id, meeting_code, sender_id, sender_name, guest_name, type CHECK('TEXT','SYSTEM').
coding_questions
db\schema.sql:238-257
difficulty CHECK('EASY','MEDIUM','HARD'), created_by UUID REFERENCES users(id).
test_cases
db\schema.sql:259-271
question_id, input_data, expected_output, is_hidden.
interview_questions
db\schema.sql:273-284
many-to-many: interview_id, question_id, question_order.
code_rooms
db\schema.sql:286-298
interview_id UNIQUE, current_code.
code_submissions
db\schema.sql:300-333
interview_id, interview_candidate_id, question_id, language, source_code TEXT, `status CHECK(PENDING
ai_reviews
db\schema.sql:335-351 (gốc) + migration 005_add_ai_code_reviews.sql:7-16 + 006_add_ai_review_execution_mode.sql:7-13
submission_id UNIQUE, score, correctness_score, algorithm_score, overall_score, time_complexity, space_complexity, strengths, weaknesses, feedback, hint, model_name, raw_analysis JSONB, reviewed_at, `execution_mode CHECK(stdin
evaluations
db\schema.sql:353-378
interview_id, interview_candidate_id, evaluator_id UUID REFERENCES users(id), technical_score NUMERIC(5,2), communication_score, problem_solving_score, overall_score, comments TEXT, UNIQUE(interview_id, evaluator_id). Bảng duy nhất có "score" kiểu recruiter chấm — nhưng CHƯA có endpoint nào expose (chỉ được query read-only trong app\api\recruiter\profile\route.ts:194-243 cho activity timeline).
2.2. Bảng bổ sung qua migration
Bảng Migration Dòng Cột đáng chú ý
code_executions
db\migrations\004_add_code_executions.sql:6-53
id, interview_id, question_id, language, source_code, stdin_data, status (PENDING|RUNNING|SUCCESS|TIMEOUT|COMPILE_ERROR|RUNTIME_ERROR|SYSTEM_ERROR), stdout, stderr, exit_code, runtime_ms, memory_kb, completed_at.
ai_generated_test_cases
db\migrations\005_add_ai_code_reviews.sql:19-40 + 006_add_ai_review_execution_mode.sql:17-19 + 007_add_ai_verified_flag.sql:13-14
submission_id, input_data, expected_output, description, edge_case_type, status (PENDING|PASSED|FAILED|RUNTIME_ERROR|TIMEOUT), actual_output, stderr, runtime_ms, execution_order, source (AI|MANUAL), ai_verified.
recordings (bảng mới thay thế)
db\migrations\010_recordings_by_callcid.sql:22-39 + 013_add_interview_title.sql:29-35
id, call_cid, url, filename, duration, recording_type, created_at, interview_id, interview_title (snapshot).
room_presence
db\migrations\014_room_presence.sql:36-59
interview_id, user_id, participant_role (HOST|INTERVIEWER|CANDIDATE), session_id, joined_at, last_seen_at.
interview_participation_log
db\migrations\015_interview_participation_log.sql:40-61
interview_id, user_id, candidate_name (snapshot), joined_at, left_at, end_reason (LEFT_NORMAL|TAKEN_OVER|CRASH). Append-only log.
2.3. Bảng cho "report / notes / feedback / summary"
KẾT LUẬN QUAN TRỌNG: HIỆN KHÔNG CÓ BẢNG NÀO phục vụ recruiter-side AI-generated report:

KHÔNG có interview_reports, interview_notes, interview_feedback, interview_summaries, report_versions.
KHÔNG có cột report, notes, summary, feedback_text trong bất kỳ bảng nào liên quan đến interview — chỉ có:
evaluations.comments TEXT (db\schema.sql:373) — comment tự do nhưng chỉ 1 cột, schema cứng (technical/communication/problem_solving/overall + comments).
ai_reviews.feedback TEXT (db\schema.sql:348) — text review AI, đã populate bằng algorithm (code-review/route.ts:261).
code_reviews không có version/lock.
KHÔNG có cột created_by, updated_by, version, lock_version, locked_by, locked_at ở bất kỳ bảng nào.
deleted_at có ở users, companies, interviews, recordings, recordings (cũ), coding_questions không có, các bảng còn lại không có. KHÔNG có pattern soft-delete đồng nhất.
Cột created_at có ở hầu hết bảng; updated_at có ở users, recordings, ai_reviews.reviewed_at, code_executions.completed_at nhưng KHÔNG có ở interviews (xem chú thích trong app\api\interviews\[meetingCode]\end\route.ts:96-97).
2.4. Indexes hiện có
db\schema.sql:16 — idx_users_role ON users(role) WHERE deleted_at IS NULL
db\schema.sql:30 — idx_companies_created_by ON companies(created_by)
db\schema.sql:132-138 — 3 indexes trên recordings
db\schema.sql:235-236 — 2 indexes trên messages
Migration 005: idx_ai_generated_test_cases_submission_id
Migration 006: idx_ai_generated_test_cases_source ON (submission_id, source)
Migration 010: idx_recordings_call_cid, idx_recordings_created_at DESC, uq_recordings_call_cid_filename (partial unique).
Migration 013: idx_recordings_interview_id, idx_recordings_interview_title
Migration 014: 3 indexes trên room_presence (có partial index cho ACTIVE candidate).
Migration 015: 3 indexes trên interview_participation_log (composite (user_id, joined_at DESC), partial open-row lookup).
Không có Row-Level Security (RLS) trong schema — toàn bộ phân quyền làm ở application layer (xem mục 5).

3. RECRUITER UI PATTERNS
   3.1. Layout & routing
   File Chức năng
   app\recruiter\layout.tsx:1-24
   Server layout: chỉ wrap <RecruiterLayoutClient> (provider) — không render nav.
   app\recruiter\layout-client.tsx:1-22
   Client wrapper bọc RecruiterDashboardProvider (từ DashboardContext.tsx).
   app\components\recruiter-dashboard\DashboardContext.tsx:36-93
   Provider publish/subscribe: subscribeInterviewCreated, notifyInterviewCreated, subscribeInterviewFinished, notifyInterviewFinished. Listen = (interview: CreatedInterview) => void, Finished = (interviewId: string) => void.
   app\components\recruiter-dashboard\DashboardShell.tsx:1-12
   No-op wrapper (giữ lại để không phải refactor).
   app\components\SideNavBar.tsx:18-79
   Single source of truth cho nav menu. Nhóm: Tổng quan → dashboard; Phỏng vấn → interviews; AI & Phân tích → reports + statistics (CHƯA CÓ PAGE), Lưu trữ → recordings; Hệ thống → profile, settings (chưa có). Lưu ý: recruiter/reports và recruiter/statistics đã được liệt kê trong nav nhưng CHƯA có file — chỗ này có thể là vị trí tự nhiên cho report feature.
   3.2. Các trang hiện có
   Trang File Pattern
   /recruiter/dashboard
   app\recruiter\dashboard\page.tsx:1-35
   DashboardShell + TopNavBar + SideNavBar + grid 2/1 (HeroSection, QuickStats, UpcomingInterviews, RecentInterviews, JoinInterviewForm, AIAssistantPanel).
   /recruiter/interviews
   app\recruiter\interviews\page.tsx:182-529
   List page dùng pattern table chuẩn: stats cards (4) + filter bar (search + status + duration) + table + pagination. Header có nút "Tạo buổi phỏng vấn".
   /recruiter/recordings
   app\recruiter\recordings\page.tsx:95-667
   List page tương tự: sync panel (sync mới nhất + nhập tay callCid) + search + table + pagination + modal preview video. KHÔNG có trang detail cho 1 recording — chỉ modal <video>.
   /recruiter/profile
   app\recruiter\profile\page.tsx:1-116
   Profile page 2 cột: PersonalInfo + CompanyInfo + ActivityTimeline bên trái, ProfileCompletion + AccountInfo bên phải.
   3.3. Recruiter xem 1 interview cụ thể ở đâu?
   HIỆN TẠI KHÔNG CÓ TRANG DETAIL cho 1 interview. Pattern hiện hành:

Từ /recruiter/interviews table → mỗi row có <MoreHorizontal> button (xem interviews/page.tsx:479-484) KHÔNG wire action nào → không mở detail.
Từ RecentInterviews table → click "visibility" button → router.push('/recruiter/recordings?meetingCode=...') (app\components\recruiter-dashboard\RecentInterviews.tsx:94-102). Chỉ navigate sang recordings, KHÔNG có page detail cho riêng 1 interview.
Từ UpcomingInterviews → nếu SCHEDULED mở CreateInterviewModal mode=detail (UpcomingInterviews.tsx:230-247) → success screen chỉ show info tĩnh + nút "Vào phòng". Nếu ONGOING thì router.push('/interview/room/...') vào room trực tiếp.
Trong phòng (app\interview\room\[meetingCode]\page.tsx) mới có access đến RecruiterCodingView, RecruiterCodingView có AIReviewList ở panel phụ. Đây là nơi duy nhất hiện tại recruiter thấy AI review, nhưng chỉ trong khi đang phỏng vấn.
Kết luận: cần tạo mới app\recruiter\interviews\[meetingCode]\page.tsx (hoặc [id]) cho report detail, sẽ là pattern mới đầu tiên trong recruiter area.

3.4. Common UI components / patterns
Pattern File Ghi chú
Color palette
app\recruiter\interviews\page.tsx, app\recruiter\recordings\page.tsx
Dark theme: bg-[#071524] (page), bg-[#0F1E2E] (card), bg-[#13263a] (table head), border-cyan-500/10 (border). Accent cyan: bg-cyan-500, text-cyan-400.
Card style
app\recruiter\interviews\page.tsx:343-379
bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl p-6 hover:-translate-y-1 transition shadow-md shadow-black/20
Primary button
app\recruiter\interviews\page.tsx:331-338
flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition shadow-lg shadow-cyan-500/20
Ghost/outline button
app\recruiter\interviews\page.tsx:572-579 (CreateInterviewModal)
px-6 py-3 rounded-xl border border-white/10 disabled:opacity-40
Filter pill / status badge
app\recruiter\interviews\page.tsx:466-473
px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor} (helper map SCHEDULED/ONGOING/FINISHED/CANCELLED → Tailwind class).
Search input
app\recruiter\interviews\page.tsx:386-396
<Search> icon absolute left-4 + bg-[#071524] border border-slate-700 rounded-xl pl-11 pr-4 py-3 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10
Select dropdown
app\recruiter\interviews\page.tsx:398-410
bg-[#071524] border border-slate-700 rounded-xl px-4 py-3 min-w-[160px] focus:border-cyan-500
Table
app\recruiter\interviews\page.tsx:428-490
bg-[#0F1E2E] border border-cyan-500/10 rounded-2xl overflow-hidden, thead bg-[#13263a], tr border-t border-slate-800 hover:bg-cyan-500/5 transition, td p-5.
Pagination
app\recruiter\interviews\page.tsx:88-180 (component Pagination) + app\recruiter\recordings\page.tsx:585-632 (inline). PAGE_SIZE = 5.
Modal pattern
app\components\recruiter-dashboard\CreateInterviewModal.tsx:238-322 (create success), app\recruiter\recordings\page.tsx:636-665 (video preview), app\components\interview-room\coding\RecruiterCodingView.tsx:74-171 (CodeViewerModal). Convention: fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm, container bg-[#0B1120] border border-white/10 rounded-2xl p-8 shadow-2xl max-w-md/md/lg.
Token + Authorization header
app\recruiter\interviews\page.tsx:215-220, app\recruiter\recordings\page.tsx:127-131
Pattern: lấy localStorage.getItem('token') → headers["Authorization"] = "Bearer ${token}" + credentials: "include".
Toast / status banner
app\recruiter\recordings\page.tsx:415-469
Border + bg color theo type success/error/info, có icon + close button.
Loading state
app\recruiter\interviews\page.tsx:443-448
<Loader2 className="inline-block animate-spin mr-2" /> + text.
Empty state
app\recruiter\interviews\page.tsx:450-454, app\recruiter\recordings\page.tsx:501-506
Row/col-span full với text "Chưa có ...".
Material Symbols icons
Dùng rộng rãi (auto_awesome, cloud_upload, code, visibility, event_note, check_circle, analytics...). Có sẵn CDN (không cần import).
Lucide icons
Side-nav button groups dùng lucide-react: Plus, Search, Users, CalendarDays, Clock3, CheckCircle2, Loader2, MoreHorizontal, PlayCircle, Download, RefreshCw, AlertCircle. 4. INTERVIEW DETAIL & DATA SOURCES CHO REPORT
4.1. Các nguồn data để tổng hợp report
Nguồn Lệnh query / endpoint Trả về File
Interview metadata
DB trực tiếp: SELECT id, title, description, meeting_code, status, scheduled_at, started_at, ended_at, duration_minutes, allow_guest, enable_recording, max_participants, max_interviewers, created_at FROM interviews WHERE meeting_code = $1
Title, thời lượng, status, giờ bắt đầu/kết thúc, description.
db\schema.sql:54-94
Candidate info
DB: SELECT ic.id, ic.candidate_name, ic.candidate_email, ic.joined_at, ic.left_at, u.id AS user_id, u.email, u.full_name, u.avatar_url FROM interview_candidates ic LEFT JOIN users u ON u.id = ic.user_id WHERE ic.interview_id = $1
Tên, email, avatar, joined/left.
db\schema.sql:165-181
Host + interviewers
DB: SELECT ip.user_id, ip.participant_role, u.full_name, u.avatar_url, ip.joined_at, ip.left_at FROM interview_participants ip JOIN users u ON u.id = ip.user_id WHERE ip.interview_id = $1 AND ip.participant_role IN ('HOST','INTERVIEWER')
Người chấm.
db\schema.sql:140-163
Coding questions assigned
API: GET /api/interviews/[meetingCode]/questions
{ questions: [{ id, title, description, difficulty, order, isActive }], activeQuestionId }
app\api\interviews\[meetingCode]\questions\route.ts:16-57
Code submissions
API: GET /api/interviews/[meetingCode]/submissions
{ submissions: [{ submissionId, questionId, language, sourceCode, status, runtimeMs, stdout, stderr, exitCode, createdAt, candidateName, candidateUserId }] }
app\api\interviews\[meetingCode]\submissions\route.ts:373-441
AI review (1 submission)
API: GET /api/interviews/[meetingCode]/code-review?submissionId=...
{ review: { overallScore, correctnessScore, algorithmScore, timeComplexity, spaceComplexity, correctness, algorithm (text), strengths, weaknesses, hint, executionMode, analysisReason, ... }, tests: { total, passed, items: [{ id, description, edgeCaseType, inputData, expectedOutput, actualOutput, status, runtimeMs, source, aiVerified }] } }
app\api\interviews\[meetingCode]\code-review\route.ts:450-540
AI reviews gộp (nhiều submissions)
DB trực tiếp cần viết: SELECT ar._ FROM ai_reviews ar JOIN code_submissions cs ON cs.id = ar.submission_id WHERE cs.interview_id = $1
All reviews for that interview (1 per submission).
(chưa có API)
Recordings
API: GET /api/interviews/[meetingCode]/recordings
{ recordings: [{ id, interviewId, meetingCode, title, fileName, fileUrl, mimeType, sizeBytes, durationSeconds, status, recordedBy, createdAt, updatedAt }] }
app\api\interviews\[meetingCode]\recordings\route.ts:303-379
Chat messages
DB trực tiếp: SELECT id, sender_id, sender_name, guest_name, content, type, created_at FROM messages WHERE meeting_code = $1 ORDER BY created_at ASC
Conversation log.
db\schema.sql:207-233 + db\migrations\002_add_chat_enhancements.sql
Participation log
DB: SELECT _ FROM interview_participation_log WHERE interview_id = $1 ORDER BY joined_at ASC
Lịch sử vào/ra từng candidate.
db\migrations\015_interview_participation_log.sql:40-61
Code executions (mỗi run)
DB: SELECT _ FROM code_executions WHERE interview_id = $1 ORDER BY created_at
Tất cả lần chạy (kể cả auto-run của AI test).
db\migrations\004_add_code_executions.sql:6-53
Existing evaluations
DB: SELECT _ FROM evaluations WHERE interview_id = $1
technical_score, communication_score, problem_solving_score, overall_score, comments của từng recruiter (UNIQUE theo (interview_id, evaluator_id)).
db\schema.sql:353-378
4.2. Recruiter hiện tại xem code review ở đâu?
Endpoint: GET /api/interviews/[meetingCode]/code-review?submissionId=... (app\api\interviews\[meetingCode]\code-review\route.ts:450-541).
POST trigger: POST /api/interviews/[meetingCode]/code-review body { submissionId } (code-review/route.ts:82-446). Auto-trigger fire-and-forget từ submissions route (submissions/route.ts:333-349).
UI hiện tại: app\components\interview-room\coding\AIReviewList.tsx:148-545 — chỉ mount trong khi đang phỏng vấn (panel phụ của RecruiterCodingView). KHÔNG có page recruiter-side để xem review sau khi buổi kết thúc. 5. AUTH & PERMISSIONS
5.1. Auth helper (route handlers)
lib\auth.ts:9-51 — getAuthUserFromRequest(req) đọc token từ 3 nguồn:
Authorization: Bearer <token> header
x-auth-token header
Cookie token=<value> (regex ở lib\auth.ts:19-20)
Verify bằng jwt.verify(token, process.env.JWT_SECRET) (auth.ts:31-37).
Trả AuthUser { id, role: 'CANDIDATE' | 'RECRUITER' | 'ADMIN' } | null.
lib\auth.ts:39-43 — Token mới phát hành sau migration 019 có thêm claim `pwd` (UNIX seconds của password_changed_at). Hàm giữ sync để không phá 30+ route đang gọi nên KHÔNG so sánh `pwd` claim với DB. Token cũ (không có `pwd`) vẫn valid cho tới khi expire 7 ngày; token mới rotate khi user login/register/đổi MK.
lib\auth.ts:53-58 — unauthorized(message) helper trả 401.
lib\auth.ts:60-65 — forbidden(message) helper trả 403.
lib\auth.ts:4-7 — interface AuthUser re-export.
lib\auth.ts:67-92 — signAuthToken(user, pwdVersion=0): build JWT kèm `pwd` claim khi pwdVersion > 0. Được gọi từ login/register/google/change-password để gắn claim giúp rotate token sau đổi mật khẩu.
5.2. Endpoint auth liên quan
Endpoint Method Mục đích File
/api/auth/login
POST
Local email/password login. Response trả { token, user: { id, email, fullName, role, provider } } (provider mới được thêm để TopNavBar biết user LOCAL vs GOOGLE).
app\api\auth\login\route.ts:6-125
/api/auth/register
POST
Đăng ký LOCAL. Insert user với password_changed_at = NOW(), trả { token, user } (user KHÔNG có field provider — FE LoginForm tự fallback "LOCAL").
app\api\auth\register\route.ts:20-190
/api/auth/google
GET
OAuth flow Google (code → tokens → user). Insert/select user kèm password_changed_at.
app\api\auth\google\route.ts:12-111
/api/auth/google/callback
GET
Variant của OAuth callback (có token verification trước).
app\api\auth\google\callback\route.ts:12-129
/api/auth/change-password
POST
Đổi mật khẩu cho LOCAL user. Validate mật khẩu mạng (8+ ký tự, hoa/thường/số/đặc biệt), check oldPassword qua bcrypt.compare, chặn đổi trùng mật khẩu cũ, cập nhật password_hash + password_changed_at trong cùng transaction, trả về token MỚI để FE rotate (ChangePasswordModal lưu lại localStorage.token).
app\api\auth\change-password\route.ts:16-134
/api/auth/me
GET
Trả { user: { id, email, fullName, avatarUrl, role, provider } } — UI dùng để gate recruiter-only actions + hiển thị setting (TopNavBar đọc provider để ẩn nút "Đổi mật khẩu" cho user GOOGLE).
app\api\auth\me\route.ts:13-51
5.3. Auth flow UI (login/register/Google/change-password)
app\auth\success\page.tsx:6-68 — Trang nhận `?token=` từ Google callback, lưu `localStorage.token`, set cookie fallback, gọi /api/auth/me để hydrate full user (id, email, fullName, role, provider), redirect theo role (CANDIDATE/RECRUITER).
app\components\LoginForm.tsx:52-102 — Login LOCAL. Lưu `localStorage.user` đồng bộ shape với /auth/success (có provider fallback "LOCAL" nếu API không trả).
app\components\RegisterForm.tsx:49-93 — Register LOCAL. Có strength bar (5 mức) đo lường độ mạnh mật khẩu theo cùng tiêu chí với isStrongPassword() backend.
app\components\TopNavBar.tsx:7-136 — Header có dropdown settings (Trang cá nhân / Đổi mật khẩu / Đăng xuất). Điều kiện `{provider !== "GOOGLE" && ...}` ẩn nút "Đổi mật khẩu" cho user Google.
app\components\ChangePasswordModal.tsx:9-217 — Modal đổi mật khẩu. Validate FE (3 field bắt buộc, confirm match, mới ≠ cũ, mạnh). Gọi POST /api/auth/change-password; nếu response có `token` thì ghi đè localStorage.token (rotate). Có nút toggle hiển thị/ẩn mật khẩu cho cả 3 field.
5.4. Auth helper (server components / pages)
lib\interview-guard.ts:48-67 — getAuthedUser() đọc cookie token (chỉ dùng cho server components, không có Bearer fallback).
lib\interview-guard.ts:69-73 — requireAuth() redirect /login nếu thiếu.
lib\interview-guard.ts:94-105 — findInterviewByMeetingCode() SELECT.
lib\interview-guard.ts:107-120 — findParticipantRole(interviewId, userId) trả HOST | INTERVIEWER | null.
lib\interview-guard.ts:307-409 — requireInterviewAccess(meetingCode) — flow:
Require auth (redirect /login nếu thiếu).
Tìm interview (redirect /login nếu không có).
Nếu RECRUITER/ADMIN: check participant → nếu chưa có auto-attach với role INTERVIEWER (attachRecruiter ở lib\interview-guard.ts:127-142).
Nếu CANDIDATE: attachCandidate (case 1 refresh, case 2 claim slot, case 3 takeover dựa trên room_presence, case 4 insert mới) (lib\interview-guard.ts:157-296).
Password gate check (HOST bypass).
Trả InterviewAccess { user, interviewId, meetingCode, title, status, scheduledAt, participantRole, passwordRequired, userFullName, otherParticipantName }.
lib\interview-guard.ts:25-46 — types: InterviewRole, AuthedUser, InterviewAccess.
5.5. Permission pattern cho route handlers
Pattern 1 — recruiter-only (gate qua role string):

app\api\interviews\[meetingCode]\ai-tests\route.ts:58-69 — helper ensureRecruiter(auth) reject nếu không phải RECRUITER | ADMIN.
app\api\interviews\[meetingCode]\submissions\route.ts:383-388 — auth.role !== "RECRUITER" && auth.role !== "ADMIN" → 403.
app\api\interviews\route.ts:32-34, 213-216 — chỉ RECRUITER mới list/create.
app\api\interviews\upcoming\route.ts:39-44 — chỉ RECRUITER.
app\api\interviews\[meetingCode]\questions\route.ts:70-72 — chỉ RECRUITER/ADMIN.
app\api\interviews\[meetingCode]\messages\route.ts:51-56 — không check role, chỉ cần authenticated.
app\api\interviews\[meetingCode]\code-review\route.ts:99-105 — chỉ authenticated (cả recruiter và candidate đều gọi được).
app\api\auth\change-password\route.ts:17-18 — chỉ authenticated, nhưng kiểm tra thêm `provider === "LOCAL"` để chặn user Google đổi MK (change-password/route.ts:61-69).
Pattern 2 — per-resource ownership (qua interview_participants hoặc HOST role):

app\api\interviews\[meetingCode]\end\route.ts:69-92 — chỉ participant_role IN ('HOST','CO_HOST') mới end được.
app\api\interviews\[meetingCode]\recordings\route.ts:89-113 — verifyParticipant(interviewId, auth):
RECRUITER/ADMIN: có row trong interview_participants cho interview này.
CANDIDATE: interview_candidates.user_id = auth.id.
app\api\interviews\[meetingCode]\participants\route.ts:67-82 — tương tự.
app\api\interviews\[meetingCode]\verify-password\route.ts:94-118 — check role rồi mới check participant (cho HOST bypass password).
app\api\recordings\route.ts:57-67 — CANDIDATE bị filter callCid qua interview_participants.user_id = auth.id.
app\api\recordings\[callCid]\route.ts:59-85 — CANDIDATE phải có row trong interview_participants với meeting_code của callCid.
Pattern 3 — chỉ kiểm tra HOST trên toàn bộ list:

app\api\interviews\route.ts:103, 135 — JOIN interview_participants WHERE ip.user_id = $1 AND ip.participant_role = 'HOST' (chỉ filter theo HOST, không bao gồm INTERVIEWER).
app\api\interviews\upcoming\route.ts:77 — tương tự chỉ HOST.
app\api\recordings\latest\route.ts:79 — IN ('HOST','INTERVIEWER') (rộng hơn).
5.6. Quyết định quan trọng cho feature report
Với report của 1 interview, cần verify quyền:

User phải authenticated → getAuthUserFromRequest(req) → unauthorized() nếu thiếu.
User phải là RECRUITER/ADMIN → check auth.role.
User phải là participant của interview → check interview_participants:
SELECT 1 FROM interview_participants
WHERE interview_id = (SELECT id FROM interviews WHERE meeting_code = $1)
AND user_id = $2
(xem pattern app\api\interviews\[meetingCode]\recordings\route.ts:93-101).
Không cần password gate cho API endpoint (chỉ áp dụng cho việc vào room).
5.7. JWT rotation sau đổi mật khẩu
Mục đích: invalidate token cũ sau khi user đổi mật khẩu, tránh kẻ gian chiếm token trước đó dùng tiếp.

Cơ chế (token rotation, không phải server-side blacklist):
DB thêm column `users.password_changed_at TIMESTAMPTZ NOT NULL` (migration 019).
Khi sign JWT, gắn thêm claim `pwd` = epoch seconds của password_changed_at (lib\auth.ts:67-92, signAuthToken).
Khi change-password thành công (route.ts:89-114), UPDATE password_changed_at = NOW() và response trả về token MỚI kèm `pwd` claim mới.
FE (ChangePasswordModal.tsx:78-81) nhận token mới → ghi đè localStorage.token → mọi request sau dùng token mới.
Token cũ (không có `pwd`) vẫn valid cho tới khi expire 7 ngày hoặc user login/đổi MK lại. Đây là trade-off chấp nhận được để giữ getAuthUserFromRequest sync (không phá 30+ route); nếu muốn invalidate ngay, cần chuyển helper sang async + query DB mỗi request (nằm ngoài scope hiện tại).
Login route (login/route.ts:84-89) và Google routes (google/route.ts:81-86, google/callback/route.ts:100-105) cũng ký token với `pwd` claim lấy từ DB → user mới/re-login đều nhận token có `pwd`.
Register route (register/route.ts:155-158) dùng `Math.floor(Date.now() / 1000)` làm pwdVersion (vì user vừa tạo, password_changed_at vừa set = NOW()).

6. DB MIGRATION CONVENTION
6.1. Danh sách migrations (db\migrations\)
db\migrations\002_add_chat_enhancements.sql
db\migrations\003_add_interview_questions_realtime.sql
db\migrations\004_add_code_executions.sql
db\migrations\005_add_ai_code_reviews.sql
db\migrations\006_add_ai_review_execution_mode.sql
db\migrations\007_add_ai_verified_flag.sql
db\migrations\010_recordings_by_callcid.sql
db\migrations\012_recordings_dedupe_by_filename.sql
db\migrations\013_add_interview_title.sql
db\migrations\014_room_presence.sql
db\migrations\015_interview_participation_log.sql
db\migrations\016_interview_reports.sql
db\migrations\017_snapshot_submission_candidate_name.sql
db\migrations\018_interview_reports_multi.sql
db\migrations\019_password_changed_at.sql
(Số 001, 008, 009, 011 thiếu — chỉ nhảy số, không có file.)

6.2. Convention phổ biến (xem các file mới nhất: 013, 014, 015)
Yếu tố Convention Ví dụ
Header comment
-- Migration: <mục đích> + -- Created: YYYY-MM-DD + nhiều dòng -- giải thích bối cảnh/quyết định thiết kế.
db\migrations\015*interview_participation_log.sql:1-37
Naming file
<3-digit-số>*<snake*case>.sql
015_interview_participation_log.sql
Extension bắt buộc
CREATE EXTENSION IF NOT EXISTS pgcrypto; (cho gen_random_uuid()).
db\migrations\015_interview_participation_log.sql:38
Primary key
UUID PRIMARY KEY DEFAULT gen_random_uuid()
db\migrations\015_interview_participation_log.sql:41
Timestamps
TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP cho created_at; TIMESTAMP (nullable) cho started_at, ended_at, left_at.
db\migrations\015_interview_participation_log.sql:53-60
FK references
REFERENCES <table>(id) ON DELETE CASCADE cho data thuộc về parent; ON DELETE SET NULL cho audit/snapshot.
db\migrations\015_interview_participation_log.sql:43-49
CHECK constraint
Dùng cho enum (status, end_reason, execution_mode, ...).
db\migrations\015_interview_participation_log.sql:57-58
Indexes
CREATE INDEX IF NOT EXISTS idx*<table>\_<col> ON <table>(...); partial index WHERE <condition> khi cần. Composite index cho composite query.
db\migrations\015_interview_participation_log.sql:64-75
Idempotency
ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DROP INDEX IF EXISTS.
db\migrations\013_add_interview_title.sql:29-35, db\migrations\012_recordings_dedupe_by_filename.sql:22
Backfill trước khi enforce constraint
ALTER TABLE ... ADD COLUMN IF NULLABLE → UPDATE ... SET ... → CREATE INDEX.
db\migrations\013_add_interview_title.sql:29-55
Dedupe strategy
DELETE rows thừa bằng self-join trước khi tạo unique index.
db\migrations\012_recordings_dedupe_by_filename.sql:27-35
Snapshot pattern
Có ý thức lưu snapshot (interview_title, candidate_name) thay vì JOIN để giữ lịch sử.
db\migrations\013_add_interview_title.sql:21-23, db\migrations\015_interview_participation_log.sql:50
Append-only pattern
Không có UNIQUE constraint khi cho phép nhiều row cùng key (vd participation log).
db\migrations\015_interview_participation_log.sql:31-32
Unique index dạng partial
CREATE UNIQUE INDEX ... WHERE <col> IS NOT NULL cho phép NULL mà vẫn unique.
db\migrations\012_recordings_dedupe_by_filename.sql:40-42
ON CONFLICT
Khi INSERT từ route, dùng ON CONFLICT (col) DO NOTHING hoặc DO UPDATE SET ... để idempotent.
app\api\interviews\[meetingCode]\recordings\route.ts:144-150
6.3. Đề xuất pattern cho bảng report (tham khảo, không implement)
Nếu tạo bảng interview_reports, convention sẽ là:

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS interview_reports (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
interview_id UUID NOT NULL
REFERENCES interviews(id)
ON DELETE CASCADE,
-- optional FK creator FK users(id), nhưng convention hiện KHÔNG có
-- updated_by / created_by → cân nhắc có thêm hay không.
content JSONB NOT NULL, -- lưu full AI-generated + recruiter edits
summary TEXT, -- phần text ngắn dễ hiển thị list
overall_score NUMERIC(5,2),
status VARCHAR(20) DEFAULT 'DRAFT'
CHECK (status IN ('DRAFT','FINAL')),
ai_model VARCHAR(100), -- vd 'qwen2.5-coder:3b'
generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_interview_reports_interview
ON interview_reports(interview_id)
WHERE deleted_at IS NULL;
Cần quyết định:

Có lưu nhiều version (UNIQUE interview_id, hoặc append-only)? Hiện tại schema KHÔNG có pattern nào multi-version.
Có soft-delete (deleted_at)? Hầu hết bảng recruiter-facing có (users, interviews, recordings), nhưng code_submissions, messages thì không.
Có created_by / updated_by? Hiện chưa có bảng nào có — sẽ là convention mới nếu thêm vào.
6.4. db\schema.sql tổng quan
File db\schema.sql:1-378 là canonical schema declaration (được apply lên DB), còn migrations trong db\migrations/ là incremental diffs (số 002 trở đi). Cấu trúc:

Toàn bộ CREATE TABLE dùng UUID PRIMARY KEY DEFAULT gen_random_uuid().
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ở hầu hết bảng.
updated_at có ở users, recordings, ai_reviews.reviewed_at, code_executions.completed_at, interview_reports.updated_at (migration 016).
deleted_at (soft delete) ở users, companies, interviews, recordings. Không có ở interview_participants, interview_candidates, code_submissions, ai_reviews, evaluations, messages, interview_reports.
Tất cả FK đều REFERENCES ... ON DELETE CASCADE hoặc SET NULL.
Không có RLS policies — phân quyền 100% ở application layer.
Các bảng / cột quan trọng đã được thêm qua migration gần đây:
interview_reports (migration 016_interview_reports.sql:15-) — bảng báo cáo AI cho mỗi interview, content JSONB lưu 8 sections (candidate_name, position, summary, strengths, weaknesses, skill_evaluation, improvement_suggestions, hiring_conclusion). UNIQUE(interview_id) — 1 report / interview. Constraint UNIQUE này bị bỏ ở migration 018_interview_reports_multi.sql:12-13 để cho phép recruiter sinh nhiều phiên bản báo cáo (nhiều report trên 1 interview).
code_submissions.candidate_name (migration 017_snapshot_submission_candidate_name.sql:20-26) — snapshot tên candidate tại thời điểm submit, tránh takeover rename. submissions GET route ưu tiên snapshot này thay vì JOIN interview_candidates.
users.password_changed_at TIMESTAMPTZ NOT NULL (migration 019_password_changed_at.sql:17-25) — track rotate JWT sau khi user đổi mật khẩu (xem mục 5.7). 7. CÁC FILE CHƯA CÓ (gợi ý vị trí cho feature mới, KHÔNG implement)
app\api\interviews\[meetingCode]\report\route.ts — endpoint generate + GET/PATCH report (chưa có).
app\recruiter\interviews\[meetingCode]\page.tsx — page detail cho 1 interview (chưa có).
app\recruiter\interviews\[meetingCode]\report\page.tsx — page xem/chỉnh sửa report (chưa có).
Bảng hiện KHÔNG có trong schema: interview_notes, interview_feedback, interview_summaries. Bảng interview_reports ĐÃ CÓ (migration 016 + 018 cho phép multi-version). 8. ĐIỂM CẦN LƯU Ý KHI THIẾT KẾ
Token 3 nguồn: API endpoint MỚI phải dùng getAuthUserFromRequest(req) (hỗ trợ Bearer header + cookie). Server component/page mới phải dùng getAuthedUser() (cookie only).

Auth 2 lớp cho report:

Lớp 1: auth.role === "RECRUITER" | "ADMIN".
Lớp 2: SELECT trong interview_participants để xác nhận user thuộc interview (xem pattern recordings/route.ts:93-101).
JWT secret: process.env.JWT_SECRET (lib\auth.ts:26-29) — throw nếu thiếu. Không hardcode.

JWT rotation: API endpoint MỚI liên quan đến user identity nên dùng signAuthToken(user, pwdVersion) thay vì jwt.sign thủ công để đảm bảo token mới có `pwd` claim. Endpoint đổi mật khẩu / đăng nhập / đăng ký / Google OAuth đều trả token mới trong response (kèm field `provider` trong user object); FE phải ghi đè localStorage.token và localStorage.user.

Timezone: queries dùng AT TIME ZONE 'Asia/Ho_Chi_Minh' (xem app\api\interviews\upcoming\route.ts:79-80). Múi giờ cứng.

API base URL: env APP_BASE_URL / NEXT_PUBLIC_APP_URL cho self-call (xem submissions/route.ts:16-19). Dùng cho fire-and-forget như code-review.

Socket server URL: env SOCKET_SERVER_URL (mặc định http://localhost:3001). Dùng cho event realtime. Không bắt buộc cho report (chỉ cần nếu muốn notify recruiter real-time).

Sandbox: env SANDBOX_SERVICE_URL (mặc định http://localhost:3002). Không liên quan tới report trừ khi muốn auto-run code khi generate report.

Ollama: env OLLAMA_HOST (mặc định http://127.0.0.1:11434) + AI_REVIEW_MODEL (mặc định qwen2.5-coder:3b). Có thể tái sử dụng để generate report.

Provider events: RecruiterDashboardProvider (DashboardContext.tsx) chỉ có subscribeInterviewCreated / subscribeInterviewFinished. Cần mở rộng nếu muốn notify các dashboard component khi report được tạo/cập nhật.

Cursor schema cache: Tham khảo db\migrations\015_interview_participation_log.sql:38 — luôn CREATE EXTENSION IF NOT EXISTS pgcrypto; ở đầu file.

Đổi mật khẩu: route /api/auth/change-password chỉ nhận user đã auth (Bearer token) và provider === "LOCAL". Reject user Google đổi MK với message rõ ràng.

Hết báo cáo. Nếu cần làm rõ thêm đoạn nào hoặc cần đọc file cụ thể, vui lòng cho biết.
