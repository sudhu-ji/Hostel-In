# Hostel In — Antigravity Project Instructions

## Automated Testing & Quality Assurance Protocol
Whenever asked to test, audit, or verify this project, automatically use the assigned tool:

1. **Functional, UI & Mobile Testing**:
   - Tool: **Playwright** (`npx playwright test`)
   - Scope: Next.js pages, components, booking flows, and Capacitor mobile viewports.

2. **Security & Vulnerability Auditing**:
   - Tool: **Semgrep**
   - Command:
     ```powershell
     & "C:\Users\Sudhanshu\AppData\Local\Python\pythoncore-3.14-64\Scripts\semgrep.exe" scan --config "p/default" src
     ```
   - Checks: OWASP Top 10, secret leaks, XSS, and dangerous patterns.

3. **Backend Authorization & Data Flow**:
   - Strict RBAC: No open Firestore rules (`allow read, write: if true;` is strictly prohibited).
   - Verify permissions: Students cannot touch other students' records or payments; Admins only for management operations.
   - Enforce Zod contract validation on all incoming data payloads before writing to Firestore.

