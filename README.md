# Assessment Platform Backend

Production-grade, modular Node.js + Express + TypeScript backend implementing secure JWT authentication, refresh token rotation with reuse detection, role-based access control, bilingual content catalogs (en/hi), admin CRUD with transaction-level audit logging, assessment attempts with server-side timers and auto-save, pluggable pure scoring engines, and Razorpay payment integration with idempotent webhooks and tamper-proof server-side pricing.

## Setup Instructions

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in your database credentials and secret keys:
```bash
cp .env.example .env
```
Ensure secrets are properly populated:
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 32 characters)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (from Razorpay Dashboard -> Settings -> API Keys)
- `RAZORPAY_WEBHOOK_SECRET` (from Razorpay Dashboard -> Settings -> Webhooks)

### 2. Database Migration
Deploy the database schema using Prisma:
```bash
npm run prisma:migrate
```

### 3. Database Seeding
Seed the initial administrative user, 2 sample bilingual assessments (5-question OBJECTIVE, 4-question MIXED with TEXT), and 3 products (1 free, 2 paid in integer paise):
```bash
npm run prisma:seed
```

### 4. Running the Server
- **Development mode** (with auto-reload):
  ```bash
  npm run dev
  ```
- **Build production bundle**:
  ```bash
  npm run build
  ```
- **Start production server**:
  ```bash
  npm run start
  ```

### 5. Running Tests
Run all unit and integration tests via Vitest:
```bash
npm test
```

---

## Razorpay Test-Mode & Webhook Setup (ngrok)

### A. Razorpay Test Credentials
1. Log into your [Razorpay Dashboard](https://dashboard.razorpay.com/) and toggle into **Test Mode**.
2. Navigate to **Account & Settings** -> **API Keys** -> **Generate Key**.
3. Copy the Key ID and Key Secret into your `.env`:
   ```env
   RAZORPAY_KEY_ID="rzp_test_..."
   RAZORPAY_KEY_SECRET="your_razorpay_secret_..."
   ```

### B. Setting Up Local Webhook Testing via ngrok
1. Start your backend server:
   ```bash
   npm run dev
   ```
2. In a separate terminal, expose your local port (default 5000) using ngrok:
   ```bash
   ngrok http 5000
   ```
3. Copy the forwarding HTTPS URL (e.g. `https://your-ngrok-subdomain.ngrok-free.app`).
4. In Razorpay Dashboard, navigate to **Account & Settings** -> **Webhooks** -> **Add New Webhook**:
   - **Webhook URL**: `https://your-ngrok-subdomain.ngrok-free.app/api/v1/webhooks/razorpay`
   - **Secret**: Enter a secret string and save it into `.env` as `RAZORPAY_WEBHOOK_SECRET`.
   - **Active Events**: Check `payment.captured`, `order.paid`, and `payment.failed`.
5. Test payments in Razorpay test mode or simulate events via Razorpay's **Send Test Webhook** feature. The endpoint processes the event idempotently using `WebhookEvent` table deduplication and timing-safe HMAC SHA-256 signature verification.

---

## API Endpoints & Example Requests

All endpoints are prefixed with `/api/v1` and return standard JSON payloads:
```json
{
  "success": true,
  "data": { ... }
}
```

---

### Authentication Module (`/api/v1/auth`)

- `POST /api/v1/auth/register`: Register user with `acceptedTerms: true` and optional `preferredLanguage: "EN" | "HI"`.
- `POST /api/v1/auth/login`: Authenticate and receive `httpOnly` secure cookies.
- `POST /api/v1/auth/refresh`: Rotate refresh token with reuse detection.
- `POST /api/v1/auth/logout`: Revoke active session.
- `GET /api/v1/auth/me`: Fetch authenticated user profile.

---

### Public Catalog Module (`/api/v1/products`)
*Public endpoints. Localized via `?lang=en|hi` with automatic English fallback. Strictly sanitized via DTOs to never leak option scores, internal dimensions, or answer keys.*

- `GET /api/v1/products`: List active products with pagination.
- `GET /api/v1/products/:slug`: Get active product by slug.

---

### Assessment Attempts & Scoring (`/api/v1/attempts`)
*Requires authenticated user. Server-enforced timer, auto-saving with idempotent upserts, completeness validation, and pluggable scoring.*

- `POST /api/v1/attempts`: Start or resume attempt. Questions are snapshotted to guarantee version immunity.
- `GET /api/v1/attempts/:id`: View questions and saved responses without score leakage.
- `PUT /api/v1/attempts/:id/answers`: Auto-save answers. Validates question type and constraints.
- `POST /api/v1/attempts/:id/submit`: Validate completeness, enforce server-side timer, lock attempt, and calculate `scoreSummary`.
- `GET /api/v1/attempts`: Paginated list of user's attempts.

---

### Orders & Payments Module (`/api/v1/orders`)
*Requires authenticated user. Tamper-proof server-side pricing derived directly from DB.*

#### 1. Create Order
- **Endpoint**: `POST /api/v1/orders`
- **Rules**:
  - `attemptId` must refer to a `SUBMITTED` attempt owned by the authenticated user.
  - Price is **always** snapshot from the database Product, completely ignoring any client input.
  - If `priceInPaise == 0` (free product): marks order `PAID` immediately without calling gateway, and emits `order.paid` event.
  - If `priceInPaise > 0`: creates an order via Razorpay Gateway (reusing any existing unpaid order).
- **Curl**:
  ```bash
  curl -X POST http://localhost:5000/api/v1/orders \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d '{
      "attemptId": "7b8d8a7c-4a8b-4b2a-8ef1-92b6a22f3cf1"
    }'
  ```
- **Response** (`201 Created` - Paid Product):
  ```json
  {
    "success": true,
    "data": {
      "orderId": "order-uuid-1234",
      "razorpayOrderId": "order_DAq77vQO3eM0n9",
      "amountInPaise": 49900,
      "currency": "INR",
      "keyId": "rzp_test_..."
    }
  }
  ```

#### 2. Verify Payment Signature (Fast Path)
- **Endpoint**: `POST /api/v1/orders/:id/verify`
- **Verification**: Evaluates `crypto.timingSafeEqual` over HMAC SHA-256 signature of `razorpay_order_id + "|" + razorpay_payment_id`.
- **Curl**:
  ```bash
  curl -X POST http://localhost:5000/api/v1/orders/order-uuid-1234/verify \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -d '{
      "razorpay_payment_id": "pay_DAqC1FjB0kL0v2",
      "razorpay_signature": "e674b6b668fa60c...valid_hmac_sha256..."
    }'
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "data": {
      "success": true,
      "message": "Payment verified successfully",
      "orderId": "order-uuid-1234"
    }
  }
  ```

#### 3. List My Orders
- **Endpoint**: `GET /api/v1/orders?page=1&limit=20`
- **Curl**:
  ```bash
  curl -X GET http://localhost:5000/api/v1/orders \
    -b cookies.txt
  ```

#### 4. Get Order By ID
- **Endpoint**: `GET /api/v1/orders/:id`
- **Curl**:
  ```bash
  curl -X GET http://localhost:5000/api/v1/orders/order-uuid-1234 \
    -b cookies.txt
  ```

---

### Webhook Endpoint (`/api/v1/webhooks/razorpay`)
*Public endpoint mounted with `express.raw({ type: 'application/json' })` before the JSON body parser. Source of truth for payment lifecycle.*

- **Endpoint**: `POST /api/v1/webhooks/razorpay`
- **Headers**: `X-Razorpay-Signature: <hex_signature>`
- **Behavior**:
  1. Validates HMAC SHA-256 timing-safe signature against exact raw body bytes.
  2. Ensures event idempotency via `WebhookEvent.eventId`. Returns 200 immediately if event was already processed.
  3. On `payment.captured` / `order.paid`: atomically executes `markOrderPaid` inside a DB transaction, transitions status to `PAID`, records payment details, and emits `order.paid`.
  4. On `payment.failed`: records `Payment` with status `failed` and failure description; order remains retryable (`CREATED`).
  5. Responds with status 200 fast.

---

### Admin Assessment & Catalog Management (`/api/v1/admin`)
*Requires `authenticate` + `authorize(Role.ADMIN)`. Every mutation updates the assessment version and records an immutable `AuditLog` inside the same database transaction.*

- Assessments: `GET /api/v1/admin/assessments`, `POST /api/v1/admin/assessments`, `PATCH /api/v1/admin/assessments/:id`
- Questions: `POST /api/v1/admin/assessments/:assessmentId/questions`, `PATCH /api/v1/admin/questions/:id`, `PATCH /api/v1/admin/questions/:id/deactivate`
- Products: `GET /api/v1/admin/products`, `POST /api/v1/admin/products`, `PATCH /api/v1/admin/products/:id`

---

## Phase 5: AI Report Generation Engine & Worker

The AI report engine asynchronously generates personalized assessment reports upon order payment (`order.paid` event), powered by OpenAI Structured Outputs (via Zod schema), Postgres-backed `pg-boss` job queues with singleton deduplication, prompt-injection defense, and bilingual (English/Devanagari Hindi) generation.

### 1. Environment Variables
Add to your `.env`:
```env
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
AI_MAX_RETRIES=3
AI_TIMEOUT_MS=60000
```

### 2. Running the Standalone Report Worker
Start the background worker in a separate terminal:
```bash
npm run worker
```
The worker connects to Postgres via `pg-boss`, listens for `report.generate` jobs, generates reports with exponential backoff retries, and records audit logs and revision history.

### 3. Report Templates (`/api/v1/admin/report-templates`)
*Requires `authenticate` + `authorize(Role.ADMIN)`.*

- `POST /api/v1/admin/report-templates`: Create a report template with system prompt, user prompt template (`{{candidate_name}}`, `{{assessment_title}}`, `{{answers}}`, etc.), structured JSON output schema, and layout.
- `GET /api/v1/admin/report-templates`: List templates with pagination.
- `GET /api/v1/admin/report-templates/:id`: Get template by ID.
- `PATCH /api/v1/admin/report-templates/:id`: Update template (bumps template version and records `AuditLog`).

### 4. Admin Report Review & Regeneration (`/api/v1/admin/reports`)
*Requires `authenticate` + `authorize(Role.ADMIN)`.*

- `GET /api/v1/admin/reports?status=PENDING_REVIEW`: List reports for manual moderation.
- `GET /api/v1/admin/reports/:id`: Get full report details including prompt/completion tokens, model, revisions, and status.
- `POST /api/v1/admin/reports/:id/release`: Release report to candidate (`status -> RELEASED`, records `releasedAt` and `releasedById`).
- `POST /api/v1/admin/reports/:id/regenerate`: Trigger regeneration (saves current content into `ReportRevision` snapshot, increments revision count, re-enqueues `report.generate`).

### 5. User Reports (`/api/v1/reports`)
*Requires `authenticate` (USER).*

- `GET /api/v1/reports`: List authenticated user's reports.
- `GET /api/v1/reports/:id`: Fetch report. Note: `content` is only returned when report `status === "RELEASED"`. While in `QUEUED`, `GENERATING`, or `PENDING_REVIEW`, `content` is `null` to ensure human review gating when `autoRelease: false`.

### 6. Security & Prompt-Injection Quarantine
All candidate free-text answers are quarantined within `<UNTRUSTED_USER_TEXT_ANSWER question_id="...">` tags in the prompt, and the system prompt instructs the AI model to treat all text inside those tags strictly as data to be evaluated, never as system instructions.

---

## Phase 6: PDF Generation, Storage, Email Delivery & Secure Download

Phase 6 implements a complete, fault-tolerant report delivery pipeline. Upon release, reports are rendered into high-fidelity PDFs with full Hindi (Devanagari) typography support, uploaded to private storage (Local or S3/R2), emailed to the candidate with time-limited download tokens, and served securely without exposing backend filesystem paths or permanent URLs.

### 1. Environment Configuration
Add to your `.env`:
```env
# Storage Driver ('local' for dev/test, 's3' for AWS S3 or Cloudflare R2)
STORAGE_DRIVER="local"
S3_ENDPOINT=""                    # Optional custom endpoint (e.g. https://<account_id>.r2.cloudflarestorage.com or MinIO)
S3_REGION="us-east-1"
S3_BUCKET="assessment-reports"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""

# Email Provider ('console' for dev/test, 'resend', 'smtp', or 'ses')
EMAIL_PROVIDER="console"
EMAIL_API_KEY=""                  # Resend API key
EMAIL_FROM="no-reply@assessment.platform"
APP_PUBLIC_URL="http://localhost:3000"
```

### 2. Storage Setup (Local vs S3-Compatible)
- **Local Driver (`STORAGE_DRIVER=local`)**:
  Files are saved in `./uploads/reports/`. Signed URLs are generated with HMAC SHA-256 tokens (`/api/v1/storage/download?key=...&expires=...&signature=...`). The server verifies the token with `crypto.timingSafeEqual` and streams the file.
- **S3 Driver (`STORAGE_DRIVER=s3`)**:
  Supports AWS S3, Cloudflare R2, and MinIO via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. Generates short-lived presigned URLs pointing directly to your private bucket.

### 3. Email Delivery (Console vs Resend / SMTP)
- **Console (`EMAIL_PROVIDER=console`)**:
  Logs formatted email details and payload directly to Pino logs and keeps delivery history in memory for assertion testing.
- **Resend (`EMAIL_PROVIDER=resend`)**:
  Transmits transactional emails via the official Resend SDK.
- **SMTP (`EMAIL_PROVIDER=smtp`)**:
  Connects to custom SMTP relays (or AWS SES via SMTP credentials) using Nodemailer.

### 4. PDF Rendering & Local Font Bundling
- **Fonts**: The repository bundles `Noto Sans` (Latin) and `Noto Sans Devanagari` directly inside `src/assets/fonts/`. Fonts are embedded into the base stylesheet as base64 data URIs. No external CDN requests are made. Hindi conjuncts, half-characters, and matras render cleanly.
- **Handlebars Engine**: Strict HTML autoescaping is enforced on all dynamic AI and candidate content. Partials (`summary`, `sections`, `breakdown`) are organized under `src/modules/reports/templates/` without duplicated markup.
- **Puppeteer Concurrency Pool**: Single Puppeteer browser instance initialized with connection pooling (up to 4 concurrent page slots) and safe sandboxing flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`). All external network requests are aborted via request interception during rendering.
- **Visual Check Script**: Run the visual test script to generate sample PDFs in both English and Hindi:
  ```bash
  npm run pdf:samples
  ```
  This creates `sample-en.pdf` and `sample-hi.pdf` in the backend root directory for manual inspection.

### 5. Docker Deployment & Chromium Dependencies
When running the backend inside a Docker container (e.g. `node:20-slim`), install the required Chromium shared libraries:
```dockerfile
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
```

### 6. Release Pipeline & Idempotency
- **Asynchronous Execution**:
  Calling `releaseReport(reportId, actorId)` (or automated release for products with `autoRelease: true`) enqueues a `report.release` job via `pg-boss`.
- **Idempotency Guarantees**:
  1. **PDF Generation**: Checks `report.pdfKey`. If already present, skips PDF re-generation and re-upload.
  2. **Email Delivery**: Checks `report.emailSentAt`. If already sent, skips sending duplicate emails.
  3. **Fault Tolerance**: If email delivery fails, the error is logged, `emailStatus` is set to `FAILED`, and the job is retried by `pg-boss` with exponential backoff. The retry resumes from the email step without re-creating the PDF.

### 7. Secure Download Endpoints
- **User Download**: `GET /api/v1/reports/:id/download`
  - Requires `authenticate`.
  - Enforces ownership: returns `404 Not Found` if accessed by another user.
  - Requires `status === RELEASED`: returns `400 Bad Request` if unreleased or still generating.
  - Returns a time-limited signed URL (`{ downloadUrl, expiresInSeconds: 3600 }`), or streams the binary PDF when `?stream=true` or `Accept: application/pdf` is provided.
- **Local Storage Download**: `GET /api/v1/storage/download?key=...&expires=...&signature=...`
  - Validates HMAC SHA-256 signature and expiration timestamp.
  - Returns `403 Forbidden` if signature is expired or tampered with.

---

## Phase 7: Comprehensive Admin APIs & OpenAPI Specification

All admin endpoints reside under `/api/v1/admin`, protected by strict `authenticate` and `authorize(Role.ADMIN)` middleware. Database mutations write immutable audit logs within the same database transaction.

### 1. Admin Users Management (`/api/v1/admin/users`)
- `GET /api/v1/admin/users`: Paginated user list with `search` (name or email), `role` (`USER` | `ADMIN`), and `isActive` (`true` | `false`) filters. Sensitive password hashes are never exposed.
- `GET /api/v1/admin/users/:id`: Comprehensive user detail with recent order history, attempt progress, and terms consent timestamp.
- `PATCH /api/v1/admin/users/:id/status`: Activate or deactivate accounts (`{ isActive: boolean }`). Admin accounts are strictly protected from self-deactivation (`CANNOT_DEACTIVATE_SELF`). Mutations record `USER_ACTIVATED` or `USER_DEACTIVATED` audit logs.

### 2. Orders, Payments & CSV Export (`/api/v1/admin/orders`)
- `GET /api/v1/admin/orders`: Filterable by `status`, `productId`, `from`/`to` date ranges, and user email / Razorpay order ID search. Includes payment attempts count.
- `GET /api/v1/admin/orders/:id`: Full order detail with complete Razorpay payment history and attempt references.
- `GET /api/v1/admin/orders/export`: Streamed CSV export supporting the same filters. Automatically applies formula-injection sanitization (`sanitizeCsvCell`) by prefixing formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a single quote (`'`).

### 3. Attempts Support Review (`/api/v1/admin/attempts`)
- `GET /api/v1/admin/attempts`: List candidate attempts with status, assessment, product, and user filters.
- `GET /api/v1/admin/attempts/:id`: Detailed response inspection formatted for customer support and review. Shows question text in the candidate's preferred attempt language, chosen option labels, candidate open-text answers, duration, and score summary.

### 4. Report Review Workflow (`/api/v1/admin/reports`)
- `GET /api/v1/admin/reports`: Filter by status (especially `PENDING_REVIEW` and `FAILED`) and language.
- `GET /api/v1/admin/reports/:id`: Full report content along with its complete chronological `ReportRevision` edit history.
- `PATCH /api/v1/admin/reports/:id/content`: Manual content moderation (`{ content, reason }`). Automatically archives previous content into `ReportRevision` and writes an audit log with before/after snapshots.
- `POST /api/v1/admin/reports/:id/release`: Manually approve and release reports to candidates, triggering PDF generation, storage upload, and email delivery via `releaseReport`.
- `POST /api/v1/admin/reports/:id/regenerate`: Re-enqueue report generation (`{ reason }`) while archiving current content in revision history.
- `POST /api/v1/admin/reports/:id/reject`: Mark report `REJECTED` (`{ reason }`) with audit trail.

### 5. Real-Time Analytics Dashboard (`/api/v1/admin/dashboard/summary`)
- `GET /api/v1/admin/dashboard/summary?from=&to=`:
  - Total revenue (sum of `amountInPaise` for `PAID` orders only).
  - Order counts and conversion metrics (`paidOrdersCount`, `failedOrdersCount`).
  - Free vs. paid report ratios (`freeReportsCount`, `paidReportsCount`).
  - Operational queues (`reportsPendingReview`, `reportsFailed`).
  - Revenue breakdown per product (`revenuePerProduct`).
  - Daily time-series trends (`revenuePerDay`, `newUsersPerDay`).
  - **Performance Caching**: Employs in-memory caching with a 15-second TTL to deliver instant real-time metrics without overloading PostgreSQL.

### 6. Audit Logs & System Health (`/api/v1/admin/audit-logs`, `/api/v1/admin/system/status`)
- `GET /api/v1/admin/audit-logs`: Paginated view of system mutations with `actorId`, `entityType`, `action`, and date range filters.
- `GET /api/v1/admin/system/status`: Real-time system health returning report queue backlog, failed jobs count, timestamp of last successful report release, process uptime, and memory statistics.

### 7. OpenAPI / Swagger Documentation (`/api/docs`)
- Interactive Swagger UI available in development and testing at `http://localhost:5000/api/docs`.
- Machine-readable OpenAPI 3.0 specification available at `http://localhost:5000/api/docs.json`.
- Automatically disabled in production (`NODE_ENV=production`) for security.
