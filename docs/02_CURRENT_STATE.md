# CURRENT STATE — Implemented Features & Technical Specifications

This document provides a comprehensive overview of the currently implemented features, technical specifications, and system architecture for the '꿈잡끼 출강 관리 시스템' (School Visit Management System).

## 1. System Overview
- **Project**: 꿈잡끼 출강 관리 시스템 (School Visit Management System)
- **Purpose**: Manage instructor dispatch schedules, school/program data, settlements, and availability for an education service company
- **Architecture**: Static SPA with Firebase BaaS (no server-side rendering)
- **Auth**: Firebase Email/Password
- **Database**: Cloud Firestore
- **Storage**: Firebase Cloud Storage (for program images/materials)

## 2. Page & Feature Matrix

| Page | URL | Handler JS | Features |
|------|-----|-----------|----------|
| Login + Calendar | `/index.html` | `auth_handler.js`, `calendar-main.js`, `api-handler.js` | Email/Password login, Monthly calendar view (FullCalendar), Schedule CRUD via modal, Color-coded events, Holiday integration (Korean public data API), Mobile hamburger menu, Unassigned instructor search filter |
| Schedule Input | `/pages/input.html` | `input-handler.js` | New schedule creation form, School/Program autocomplete via datalist, Dynamic sub-instructor rows, Dynamic equipment rows, Time auto-formatting, Availability conflict checking |
| Instructor Management | `/pages/manage.html` | `manage-handler.js` | Instructor profile CRUD, Attendance history table, Payment rule matching & calculation, Settlement preview per instructor, Real-time debounced saving, Availability constraints UI, Alias management, Resigned instructor toggle, Excel export |
| School Management | `/pages/school-manage.html` | `school-manage-handler.js` | School profile CRUD, Search by alias, Grade-level class/student statistics, Dispatch history per school, Inline edit mode |
| Program Management | `/pages/program-manage.html` | `program-manage-handler.js` | Program CRUD, Quill.js rich text editor for education plans, Equipment/Materials management with images, Firebase Storage upload (with canvas resize), Category/audience filtering, PDF print generation, Program-schedule linking statistics |
| Availability Dashboard | `/pages/availability.html` | `availability-handler.js` | Instructor availability grid, Day-of-week filtering, Time overlap visualization, CSS grid-based layout |
| Settlement | `/pages/settlement.html` | `settlement-handler.js` | Date range selection, Per-instructor payment calculation, Main vs. sub instructor rate differentiation, Tax deduction (3.3%), Excel export using ExcelJS + `template.xlsx`, Detail modal per instructor |

## 3. Firestore Collections & Schema

### 3.1 `schedules`
```typescript
interface Schedule {
  id: string;                    // Firestore document ID (auto-generated)
  date: string;                  // 'YYYY-MM-DD'
  startTime: string;             // 'HH:mm'
  endTime: string;               // 'HH:mm'
  institution: string;           // School/institution name
  program: string;               // Program name
  mainInstructor: string;        // Primary instructor name
  subInstructors: string[];      // Array of sub-instructor names
  equipments: Equipment[];       // Array of equipment items
  region: string;                // 'daegu' | 'busan' | 'ulsan' | 'pohang' | 'etc'
  grade: string;                 // e.g., '1-1', '2-3'
  students: string;              // e.g., '25명'
  color: string;                 // Hex color code for calendar display
  note: string;                  // Free-text notes
}
```

### 3.2 `instructors`
```typescript
interface Instructor {
  id: string;                    // Firestore document ID (name-based)
  name: string;
  phone: string;                 // e.g., '010-0000-0000'
  email: string;                 // e.g., 'user@example.com'
  specialization: string;
  region: string;
  gender: string;
  bankName: string;
  accountNumber: string;         // <REDACTED> in production
  accountHolder: string;
  aliases: string[];             // Name variations for matching
  notes: string;
  status: 'active' | 'inactive';
  availability: object;          // Day/time availability constraints
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 `schools`
```typescript
interface School {
  id: string;                    // Firestore document ID
  schoolName: string;            // Official school name
  city: string;                  // City/Region
  address: string;
  type: string;                  // School type
  contactName: string;           // Contact person (use dummy: 'Jane Doe')
  contactPhone: string;          // Contact phone (use dummy: '010-0000-0000')
  contactEmail: string;          // Contact email (use dummy: 'contact@example.com')
  searchAlias: string;           // Short search alias (auto-generated)
  classStats: ClassStats;        // Grade-level class/student counts
  notes: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ClassStats {
  [grade: string]: {             // e.g., 'grade1', 'grade2', ..., 'grade6'
    classes: number;
    students: number;
  };
}
```

### 3.4 `programs`
```typescript
interface Program {
  id: string;                    // Firestore document ID
  name: string;
  category: string;
  description: string;           // Rich text (Quill.js HTML)
  targetAudience: string;
  duration: string;
  maxStudents: number;
  materials: Material[];
  educationPlan: string;         // Rich text HTML content
  photoUrl: string;              // Firebase Storage URL
  notes: string;
  status: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Material {
  id: string;
  name: string;
  quantityPerStudent: number;
  imageUrl: string;              // Firebase Storage URL
  note: string;
}
```

### 3.5 `payment_rules`
```typescript
interface PaymentRule {
  id: string;                    // Firestore document ID
  ruleName: string;
  mainFee: number;               // Main instructor fee
  subFee: number;                // Sub instructor fee
  // Additional rate configuration fields
}
```

## 4. Shared Utility Types
```typescript
interface Equipment {
  type: string;                  // Equipment name
  count: number;                 // Quantity
}

type Region = 'daegu' | 'busan' | 'ulsan' | 'pohang' | 'etc';

interface DayConfig {
  [dayKey: string]: {            // 'mon', 'tue', 'wed', etc.
    label: string;
    active: boolean;
  };
}
```

## 5. Data Access Layer (`db_service.js`)
List of all exported functions grouped by domain:

### Instructors
- `getInstructorProfile(name)` → `Instructor`
- `saveInstructorProfile(name, data)` → `void`
- `getAllInstructors()` → `Instructor[]`
- `deleteInstructor(id)` → `void`
- `checkInstructorAvailability(name, date, time)` → `boolean`

### Schools
- `getSchools()` → `School[]`
- `addSchool(data)` → `DocumentReference`
- `updateSchool(id, data)` → `void`
- `bulkUpdateSchools(updates)` → `void`

### Schedules
- `getSchedulesByDate(date)` → `Schedule[]`
- `getAllSchedules()` → `Schedule[]`
- `addSchedule(data)` → `DocumentReference`
- `updateSchedule(id, data)` → `void`
- `deleteSchedule(id)` → `void`
- `duplicateSchedule(id)` → `DocumentReference`

### Programs
- `getPrograms()` → `Program[]`
- `addProgram(data)` → `DocumentReference`
- `updateProgram(id, data)` → `void`
- `deleteProgram(id)` → `void`
- `getSchedulesByProgramName(name)` → `Schedule[]`

### Payment Rules
- `getPaymentRules()` → `PaymentRule[]`
- `savePaymentRule(data)` → `void`
- `deletePaymentRule(id)` → `void`

## 6. Storage Service (`storage-service.js`)
- `uploadImage(file, folder)` → `downloadURL:string`
  - Performs client-side image resize via HTML5 Canvas before upload
  - Target folders: `'programs/photos'`, `'programs/materials'`
- `deleteImage(url)` → `void`

## 7. Authentication Flow
- **Main page (`index.html`)**: `auth_handler.js` → `signInWithEmailAndPassword` → show calendar
- **Sub pages**: `auth-check.js` → `onAuthStateChanged` → redirect if unauthenticated
- **Session timeout**: 2-hour idle limit via localStorage timestamp
- **Logout**: `signOut()` + redirect to `index.html`

## 8. External Integrations
- **Korean Public Holiday API (`data.go.kr`)**: Fetches national holidays for calendar overlay
  - API Key: stored as `process.env.HOLIDAY_API_KEY`
  - Cached in localStorage to reduce API calls
- **Firebase SDK (CDN)**: Authentication, Firestore, Storage
- **FullCalendar 6.1.8 (CDN)**: Calendar UI component
- **Quill.js (CDN)**: Rich text editing for program education plans
- **ExcelJS**: Excel workbook generation for settlement exports

## 9. Admin/Migration Scripts
| Script | Purpose |
|--------|---------|
| `migrate_schools.js` | Migrate school data from JSON to Firestore (batch 500) |
| `generate_aliases.js` | Auto-generate searchAlias for schools |
| `analyze_aliases.js` | Analyze existing alias data quality |
| `find_hyphen_instructors.js` | Find instructor name variations |
| `clear_hyphen_subinstructor.js` | Clean sub-instructor hyphen data |
| `delete_past_unassigned.js` | Remove past schedules with no assigned instructor |
| `patch_gender_aliases.js` | Patch gender-based alias data |

All scripts use the firebase-admin SDK with service account key from environment.

## 10. Known Active Issues
(From `BUG_TRACKER.md`)
- Settlement calculation rounding for sub-instructors with partial hours
- Availability grid may not reflect same-day schedule changes without page refresh

## 11. Development Phase Status
(From `ROADMAP.md`)
- **Phase 1 ✅**: Core calendar, schedule CRUD, login/auth
- **Phase 2 ✅**: Instructor, school, program management
- **Phase 3 ✅**: Settlement, availability, Excel export
- **Phase 4 🔄**: Performance dashboard, reporting, notifications, PWA
- **Phase 5 📋**: Multi-tenant, RBAC, external API, AI scheduling
