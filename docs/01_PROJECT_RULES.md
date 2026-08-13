# PROJECT RULES & CONVENTIONS

## 1. Tech Stack
- **Frontend:** HTML5 / CSS3 / Vanilla JavaScript (ES Modules)
- **Backend/BaaS:** Firebase (Authentication, Cloud Firestore, Cloud Storage)
- **Calendar Library:** FullCalendar 6.x (CDN)
- **Rich Text Editor:** Quill.js (used in program management)
- **Excel Processing:** ExcelJS (for settlement exports)
- **PDF:** Browser print API (`window.print()`) for program PDFs
- **Dev Server:** `npx serve -p 8000`
- **Testing:** Puppeteer (ad-hoc E2E tests)
- **Node.js Dependencies:** `express ^5.2.1`, `firebase-admin ^13.8.0`, `jsdom ^29.1.1`, `puppeteer ^25.3.0` (from `package.json`)
- **Build Step:** No build step / No bundler — static file serving

## 2. Directory Structure Convention
```text
school_manager/
├── index.html                  # Main entry: Login + Calendar dashboard
├── package.json                # Node dependencies & scripts
├── template.xlsx               # Excel template for settlement exports
├── test.js                     # Puppeteer E2E test script
├── css/
│   ├── common.css              # Shared styles, header, toast, loading
│   ├── calendar.css            # Calendar page styles
│   ├── forms.css               # Form & modal shared styles
│   ├── login.css               # Login screen styles
│   ├── input-form.css          # Schedule input page styles
│   ├── manage-style.css        # Instructor management styles
│   ├── school-manage.css       # School management styles
│   ├── program-manage.css      # Program management styles
│   └── availability.css        # Availability dashboard styles
├── js/
│   ├── firebase_config.js      # Firebase initialization (ESM)
│   ├── auth-check.js           # Auth guard for sub-pages
│   ├── auth_handler.js         # Login/logout for main page
│   ├── api-handler.js          # Calendar event CRUD controller
│   ├── db_service.js           # Central Firestore data-access layer
│   ├── utils.js                # Global DOM & formatting utilities
│   ├── calendar-main.js        # FullCalendar initialization & rendering
│   ├── input-handler.js        # Schedule input form handler
│   ├── manage-handler.js       # Instructor management controller
│   ├── program-manage-handler.js # Program management controller
│   ├── school-manage-handler.js  # School management controller
│   ├── settlement-handler.js   # Payment settlement controller
│   ├── availability-handler.js # Instructor availability dashboard
│   ├── storage-service.js      # Firebase Storage wrapper
│   └── program-pdf.js          # Program PDF print utility
├── pages/
│   ├── input.html              # Schedule input form page
│   ├── manage.html             # Instructor management page
│   ├── school-manage.html      # School management page
│   ├── program-manage.html     # Program management page
│   ├── availability.html       # Instructor availability page
│   └── settlement.html         # Payment settlement page
├── scripts/
│   ├── migrate_schools.js      # One-time school data migration
│   ├── generate_aliases.js     # Auto-generate school search aliases
│   ├── analyze_aliases.js      # Alias analysis utility
│   ├── find_hyphen_instructors.js  # Find instructor name variations
│   ├── clear_hyphen_subinstructor.js # Clean sub-instructor data
│   ├── delete_past_unassigned.js    # Cleanup past unassigned schedules
│   └── patch_gender_aliases.js      # Gender alias patching
├── docs/                       # Internal technical documentation
├── dev_report/                 # Development logs & roadmap
├── favicon_images/             # Favicon assets
└── DOCS/                       # Structured project documentation
```

## 3. Naming Conventions
- **HTML IDs/CSS Classes:** kebab-case (e.g., `edit-modal`, `login-screen`)
- **JS Variables/Functions:** camelCase (e.g., `loadInstructors`, `mainInstructor`)
- **Firestore Collection Names:** lowercase plural (e.g., `instructors`, `schedules`, `schools`, `programs`, `payment_rules`)
- **Date Format:** `YYYY-MM-DD` (string)
- **Time Format:** `HH:mm` (string)
- **File Naming:** kebab-case for multi-word files (e.g., `auth-check.js`, `manage-handler.js`)

## 4. Security Rules
### 4.1 No Real Secrets
- All API keys, OAuth secrets, DB passwords, JWT secrets MUST be stored in environment variables.
- Reference format: `process.env.VARIABLE_NAME` or `<REDACTED_SECRET>`
- Firebase config values: loaded from environment, never hardcoded in production.
- Service account keys: stored in gitignored paths (`json/*-serviceAccountKey.json`).

### 4.2 No Real PII
- No real email addresses, phone numbers, personal names, or bank accounts in documentation or test data.
- Use dummy data: `user@example.com`, `010-0000-0000`, `test-uuid-1234`
- Seed data and test fixtures must use anonymized placeholders.

### 4.3 No Private Infrastructure Details
- No private IPs, internal staging URLs, or cloud resource IDs in docs.
- Use `https://api.example.com` or `<YOUR_HOST>` as placeholders.
- Firebase project IDs: reference as `process.env.FIREBASE_PROJECT_ID`.

### 4.4 Git-Ignored Sensitive Files
The following patterns must be git-ignored to prevent leaking sensitive information:
- `.env`, `.env.local`, `.env.*` (except `.env.example`)
- `json/*-serviceAccountKey.json`
- Firebase service account keys

### 4.5 Authentication Architecture
- Firebase Email/Password authentication
- Session timeout: 2 hours (enforced via localStorage timestamp)
- Auth guard pattern: `auth-check.js` for sub-pages, `auth_handler.js` for main page
- `onAuthStateChanged` listener pattern for reactive auth state

## 5. Module Loading Order
- `utils.js` loaded as global script (non-module) BEFORE module scripts.
- `firebase_config.js` must be imported first in all ESM modules.
- `auth-check.js` / `auth_handler.js` loaded before page-specific handlers.
- FullCalendar loaded via CDN before `calendar-main.js`.

## 6. Development Workflow
- Dev server: `npm run start` (`npx serve -p 8000`)
- No build/bundle step required.
- Admin scripts (`scripts/` directory) use `firebase-admin` SDK, run via Node.js.
- Version cache busting: `?v=N` query params on script tags.

## 7. External APIs
- Firebase SDK: loaded from CDN (`https://www.gstatic.com/firebasejs/`)
- Korean Public Holiday API: `https://apis.data.go.kr/B090041/...` (API key required, stored as env var)
- FullCalendar: loaded from CDN (`https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/`)

## 8. CSS Architecture
- No CSS preprocessor or framework.
- `common.css`: shared layout, header, toast, loading overlay.
- Page-specific CSS files loaded per page.
- Color palette: Primary `#3498db`, Secondary `#2c3e50`, Success `#2ecc71`, Warning `#f39c12`, Danger `#e74c3c`.
- Responsive breakpoints: Mobile < 768px, Tablet 768-1024px, Desktop > 1024px.
- Mobile-first hamburger menu pattern.
