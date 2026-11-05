# Hostel In Testing & Quality Assurance Protocol

Whenever working on the `Hostel In` project and asked to test, verify, or audit the application, strictly adhere to the following tool assignments:

1. **Functional, UI & Mobile Testing**:
   - Use **Playwright** (`npx playwright test`).
   - Validate Next.js pages, modal dialogs, booking forms, and Capacitor mobile responsive viewports.

2. **Security & Vulnerability Auditing**:
   - Use **Semgrep**:
     ```powershell
     & "C:\Users\Sudhanshu\AppData\Local\Python\pythoncore-3.14-64\Scripts\semgrep.exe" scan --config "p/default" src
     ```
   - Catch XSS, prototype pollution, insecure regexes, and secret leaks before production deployment.

3. **Backend Authorization & Data Flow**:
   - Ensure `firestore.rules` enforces strict Role-Based Access Control (RBAC).
   - Never allow open rules (`allow read, write: if true;`).
   - Test that students cannot access other students' bookings or financial transactions.
   - Run backend permission verification using the Firebase rules test harness.

