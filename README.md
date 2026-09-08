# Hostel In - Cross-Platform Application

Welcome to the **Hostel In** codebase! This project is a unified, cross-platform monorepo designed with a **"write once, run anywhere"** hybrid architecture. It shares a single core React/Next.js codebase and compiles into three separate targets: Web, Android (APK), and Windows Desktop (EXE).

---

## 🏗️ Repository Architecture

This codebase is structured to keep source files extremely clean and avoid redundant code duplication:

* **`/src`**: **Core Shared Source Code**. Contains all Next.js pages, React components, Tailwind styling, Firestore database hooks, Genkit AI services, and shared business logic. This is the single source of truth for all three platforms.
* **`/android`**: **Android Wrapper (Capacitor)**. The native Android Studio project. Capacitor copies the webapp's compiled static files into this directory to package the mobile app.
* **`main.js`**: **Desktop Wrapper (Electron)**. The entry point for the Electron desktop app. It starts a lightweight local server to serve the compiled web assets in a native Windows BrowserWindow container.
* **`/assets` & `/icons`**: Visual assets, logos, and launcher icons used during the packaging of desktop and mobile builds.
* **`/docs`**: Development blueprints (`blueprint.md`) and data architecture plans (`backend.json`).

---

## 🚀 Build Artifacts (`/dist`)

To keep build results separate from source code, compiled binaries are automatically output to target subfolders inside the `dist/` directory:

* 📱 **`dist/android/`**: Contains the compiled Android package (`Hostel In.apk`) ready for installation on mobile devices.
* 💻 **`dist/desktop/`**: Contains the Windows executable installer (`Hostel In Setup 0.1.0.exe`) and unpacked desktop builds.
* 🌐 **`out/`**: Next.js static production export (used by Capacitor, Electron, and static hostings).
* 🌐 **`.next/`**: Next.js server-rendered build folder (used when deploying to Firebase App Hosting).

---

## 🛠️ Developer Commands

### 1. Web Application Development
Run the local Next.js dev server on port `9002`:
```bash
npm run dev
```

Build the Next.js production files:
```bash
npm run build
```

Deploy the web application to Firebase App Hosting:
```bash
firebase deploy
```

### 2. Android APK Build
Build the Next.js web application, sync assets to the Capacitor Android project, compile via Gradle, and copy the final package to `dist/android/Hostel In.apk`:
```bash
npm run build:android
```

### 3. Windows Desktop (EXE) Build
Build Next.js web assets and compile the Windows executable installer via `electron-builder` into `dist/desktop/`:
```bash
npm run dist
```

---

## 💡 Developer Guidelines
* **Do NOT duplicate components**: If you want to modify a page, style, or logic, update it under `src/`. Changes made to `src/` automatically propagate to the Web, Android App, and Windows Desktop app.
* **Keep inputs standardized**: Ensure input validations (such as the 10-digit limit on mobile numbers) are enforced at the React component layer under `src/` so they take effect across all platforms simultaneously.
* **State & Storage**: User authentication and local preferences are handled using persistent stores that automatically adapt to local storage or native Capacitor storage depending on the runtime platform.
