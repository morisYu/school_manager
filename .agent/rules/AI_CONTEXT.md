---
trigger: always_on
description: "Core Project Context & Architecture (Always read before starting tasks)"
---

# 📚 AI_CONTEXT: Project State & Functionality Report

This file is automatically loaded by the AI agent on every interaction. **Always refer to this context before making any code modifications.**

## 1. Project Overview
- **Name**: 꿈잡끼 출강 관리 시스템 (School Visit Management System)
- **Architecture**: Vanilla JS + HTML/CSS SPA (Single Page Application)
- **Backend/Database**: Firebase (Firestore, Authentication, Storage)
- **No Build Tools**: Directly uses ES Modules (`<script type="module">`) and CDNs.

## 2. Core Tech Stack & Libraries
- **DOM & Logic**: Pure Vanilla JavaScript (ES6+). NO React/Vue/Svelte.
- **Styling**: Pure CSS (No Tailwind, No SASS).
- **Calendar**: FullCalendar (v6.1.8) loaded via CDN.
- **Rich Text**: Quill.js (v1.3.6) loaded via CDN.
- **Excel Export**: ExcelJS (loaded via CDN) & FileSaver.js.

## 3. Directory Structure & Key Files

| Folder / File | Description |
|---------------|-------------|
| `index.html` | Main entry, Calendar UI, Login Screen, Event Edit Modal |
| `pages/*.html` | Sub-pages (Manage, Program, School, Input, Availability, Settlement) |
| `css/*.css` | Feature-specific CSS (e.g., `calendar.css`, `login.css`, `forms.css`) |
| `js/firebase_config.js`| Firebase Initialization |
| `js/db_service.js` | **CRITICAL:** ALL Firestore CRUD operations are located here. |
| `js/storage-service.js`| Firebase Storage upload/delete (handles canvas image resizing). |
| `js/auth_handler.js` | Login & initial Auth logic (used in `index.html`). |
| `js/auth-check.js` | Sub-page Auth checker (redirects if session expired/logged out). |
| `js/api-handler.js` | Handles Calendar Event Save/Delete/Duplicate from `index.html` Modal. |
| `js/*-handler.js` | UI logic for specific pages (e.g., `manage-handler.js`). |

## 4. Key Functional Workflows

- **Authentication & Login**:
  - Email/Password auth via Firebase.
  - Initial load hides login via CSS (`display: none`), Firebase `onAuthStateChanged` quickly resolves and shows `#main-content` or `#login-screen` to prevent flickering.
  - 2-hour idle timeout managed via `localStorage('school_manager_last_activity')`.

- **Schedule Management**:
  - CRUD operations update Firestore (`schedules` collection).
  - Editing from Calendar modal uses `window.myCalendar.refetchEvents()` to update UI instantly without reloading the page.

- **Data Fetching Pattern**:
  - JavaScript files import functions from `js/db_service.js`.
  - **Rule**: Never write raw Firestore queries in UI handler files. Always add a helper function in `db_service.js`.

## 5. AI Agent Development Guidelines (CRITICAL)

1. **NO UI Frameworks**: Keep using Vanilla JS and DOM manipulation (`document.getElementById`, `addEventListener`).
2. **CSS Modularity**: If you add new UI elements, append styles to the relevant `css/*.css` file rather than inline styles.
3. **Database Integrity**: When altering a document schema, ensure you check `js/db_service.js` and any related rendering loops in handler files.
4. **Environment Paths**: Sub-pages in `pages/` must use `../js/...` or `../css/...` relative paths.
5. **Debugging**: Always output `console.error` and `alert` for failed Firebase calls to assist the user in debugging.

## 6. Known Reference Docs
- Read `docs/01_PROJECT_RULES.md` for specific formatting rules.
- Read `docs/02_CURRENT_STATE.md` for detailed data schemas.
- Read `docs/03_FEATURE_SPEC.md` for functional requirements.
