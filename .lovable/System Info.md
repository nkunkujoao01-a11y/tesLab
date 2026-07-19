\# Refined PRD: Mobile-First AI-Powered Offline Learning Platform

\## 1. Executive Summary

\### 1.1 Revised Strategy

Based on the mobile-first design approach, we will prioritize developing the platform as a \*\*Progressive Web Application (PWA) optimized for mobile devices\*\* first, then progressively enhance for desktop experiences. This aligns with the research findings that 84.3% of Namibian university students use WhatsApp daily for academic purposes, indicating strong mobile adoption.

\### 1.2 Core Value Proposition

\- \*\*Offline-first\*\* - Download modules once, study anywhere

\- \*\*AI-powered\*\* - Local summarization without internet

\- \*\*Mobile-optimized\*\* - Designed for phones with limited storage

\- \*\*Data-light\*\* - Minimized data usage for download and sync

\---

\## 2. Revised System Architecture

\### 2.1 Mobile-First Architecture

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ MOBILE-FIRST LAYER │

│ │

│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │

│ │ Phone │ │ Tablet │ │ Desktop │ │

│ │ (PWA) │ │ (PWA) │ │ (PWA) │ │

│ └──────────┘ └──────────┘ └──────────┘ │

│ │ │

│ ▼ │

│ ┌─────────────────────┐ │

│ │ Mobile-First UI │ │

│ │ (React Components) │ │

│ └─────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

│

▼

┌─────────────────────────────────────────────────────────────┐

│ APPLICATION LAYER │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ Service Worker + Cache Storage │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ IndexedDB Storage │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Modules │ │ Summary │ │ Progress │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ TensorFlow Lite + DistilBART Model │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ PDF.js Text Extractor │ │

│ └─────────────────────────────────────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

│

(Sync when online)

▼

┌─────────────────────────────────────────────────────────────┐

│ BACKEND LAYER │

│ │

│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │

│ │ Auth │ │ Content │ │ Sync │ │

│ │ API │ │ API │ │ API │ │

│ └──────────┘ └──────────┘ └──────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ PostgreSQL Database │ │

│ └─────────────────────────────────────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\---

\## 3. Refined User Interface Design

\### 3.1 Design Principles

Based on the UI references provided:

| Principle | Implementation |

|-----------|----------------|

| \*\*Neumorphic Soft UI\*\* | Subtle shadows, rounded corners, card-based layouts |

| \*\*Dark/Light Mode\*\* | Dark charcoal accents with purple primary colors |

| \*\*Minimalist\*\* | Clean sans-serif typography, organized grid |

| \*\*Mobile-First\*\* | Thumb-friendly touch targets, bottom navigation |

| \*\*Visual Hierarchy\*\* | Bold headings, subtle accents for secondary info |

\### 3.2 Screen-by-Screen Design

\#### 3.2.1 Onboarding Screens

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ ◉ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📱 Smartphone Mockup │ │

│ │ ┌─────────────────────────────────────────────┐ │ │

│ │ │ ●●●●●●● │ │ │

│ │ │ ┌──────────────┐ │ │ │

│ │ │ │ 3D Icon │ │ │ │

│ │ │ │ (Play/ │ │ │ │

│ │ │ │ Chat/ │ │ │ │

│ │ │ │ Notify) │ │ │ │

│ │ │ └──────────────┘ │ │ │

│ │ │ │ │ │

│ │ │ 📖 "Learn anywhere, │ │ │

│ │ │ even without internet" │ │ │

│ │ │ │ │ │

│ │ │ 📚 Download courses on campus Wi-Fi │ │ │

│ │ │ Study offline at home │ │ │

│ │ │ │ │ │

│ │ │ \[Skip\] \[Next →\] │ │ │

│ │ └─────────────────────────────────────────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●│

└─────────────────────────────────────────────────────────────┘

\`\`\`

\*\*Onboarding Screens Content:\*\*

1\. \*\*Screen 1: Offline Learning\*\* - "Learn anywhere, even without internet" with 3D book/play icon

2\. \*\*Screen 2: AI Summaries\*\* - "Get AI summaries of your lectures instantly" with chat/mentor icon

3\. \*\*Screen 3: Track Progress\*\* - "Never lose track of your learning journey" with notification/achievement icon

\#### 3.2.2 Dashboard (Home Screen)

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ 📱 9:41 │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ ☰ eLearn 🔍 👤 │ │

│ ────────────────────────────────────────────────────── │ │

│ │ Hello, \[Student Name\] 👋 │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ 📚 │ │ 🤖 │ │ 📊 │ │ │

│ │ │ 3 Modules │ │ 5 Summary│ │ 65% │ │ │

│ │ │ Downloaded│ │ Generated│ │ Complete │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ │ │

│ │ 📖 Continue Learning │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📘 Software Engineering │ │ │

│ │ │ Week 3 - API Design │ │ │

│ │ │ ██████████░░░░ 65% │ │ │

│ │ │ \[Continue →\] │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ 📥 Available for Download │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ Database Systems - Week 4 │ │ │

│ │ │ 4.2 MB \[Download\] │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ Web Development - Week 2 │ │ │

│ │ │ 3.8 MB \[Download\] │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ ────────────────────────────────────────────────────── │ │

│ │ 💾 Storage: 520 MB / 2.0 GB used │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ \[Home\] \[Course\] \[Summary\] \[Progress\] \[Profile\] │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\#### 3.2.3 Module Detail View

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ 📱 9:41 │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ ← Software Engineering │ │

│ ────────────────────────────────────────────────────── │ │

│ │ │ │

│ │ 📘 Module Detail │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ Week 3: API Design & Microservices │ │

│ │ Dr. T. Mataranyika │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ │ │

│ │ 📄 Lecture Materials │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📕 Lecture Slides (12 pages) │ │ │

│ │ │ 4.2 MB ✅ Downloaded │ │ │

│ │ │ \[View →\] │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📗 Reading Notes (8 pages) │ │ │

│ │ │ 2.1 MB \[Download\] │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ 🤖 AI Summary │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ ──────────────────────────────────────── │ │ │

│ │ │ This lecture covers microservices │ │ │

│ │ │ architecture and API design principles │ │ │

│ │ │ including service boundaries, data │ │ │

│ │ │ consistency, and deployment strategies. │ │ │

│ │ │ ──────────────────────────────────────── │ │ │

│ │ │ \[🔄 Regenerate\] \[📋 Copy\] │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ 📊 Progress: 4/12 pages read ████░░░░░░ 33% │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ \[Home\] \[Course\] \[Summary\] \[Progress\] \[Profile\] │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\#### 3.2.4 PDF Viewer (Reading Mode)

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ 📱 9:41 │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ ← API Design Page 4/12 │ │

│ ────────────────────────────────────────────────────── │ │

│ │ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📄 PDF Content │ │ │

│ │ │ ┌─────────────────────────────────────┐ │ │

│ │ │ │ ───────────────────────────── │ │ │

│ │ │ │ Microservices │ │ │

│ │ │ │ ───────────────────────────── │ │ │

│ │ │ │ Small, independent services │ │ │

│ │ │ │ that communicate via APIs... │ │ │

│ │ │ │ │ │ │

│ │ │ │ Key Principles: │ │ │

│ │ │ │ • Service boundaries │ │ │

│ │ │ │ • Data consistency │ │ │

│ │ │ │ • Deployment strategies │ │ │

│ │ │ └─────────────────────────────────────┘ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ ┌──────────────┐ ┌──────────────┐ │ │

│ │ │ ◀ Previous │ │ Next ▶ │ │ │

│ │ └──────────────┘ └──────────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ \[Home\] \[Course\] \[Summary\] \[Progress\] \[Profile\] │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\#### 3.2.5 Progress Dashboard

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ 📱 9:41 │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ ← Progress │ │

│ ────────────────────────────────────────────────────── │ │

│ │ │ │

│ │ 📊 Your Learning Progress │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ │ │

│ │ Software Engineering ████████░░░░ 65% │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ Database Systems ████░░░░░░░░ 32% │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ Web Development ██████████░░ 85% │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ Computer Networks ██░░░░░░░░░░ 15% │ │

│ │ ─────────────────────────────────────────────────── │ │

│ │ │ │

│ │ 📈 Study Statistics │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📚 8 modules downloaded │ │ │

│ │ │ 🤖 12 summaries generated │ │ │

│ │ │ ⏱️ 4h 32m total study time │ │ │

│ │ │ 🔥 5 day streak │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ 🔄 Last sync: 2 hours ago │ │

│ │ \[Sync Now\] │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ \[Home\] \[Course\] \[Summary\] \[Progress\] \[Profile\] │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\#### 3.2.6 Profile/Settings

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ 📱 9:41 │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ ← Profile │ │

│ ────────────────────────────────────────────────────── │ │

│ │ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 👤 User Avatar │ │ │

│ │ │ John Doe │ │ │

│ │ │ Student ID: 223068209 │ │ │

│ │ │ Faculty: Computing & Informatics │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ ⚙️ Settings │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📱 Storage Management │ │ │

│ │ │ ████████████░░░░ 520 MB / 2.0 GB │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 🤖 AI Settings │ │ │

│ │ │ Model: DistilBART (400 MB) │ │ │

│ │ │ Status: ✅ Downloaded │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 🔔 Notifications │ │ │

│ │ │ \[✓\] Download completed │ │ │

│ │ │ \[✓\] Summary ready │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ 📶 Data Usage │ │ │

│ │ │ Total downloaded: 1.8 GB │ │ │

│ │ │ Data saved vs online: 70% │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ │ │ │

│ │ \[Logout\] │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ \[Home\] \[Course\] \[Summary\] \[Progress\] \[Profile\] │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\---

\## 4. Refined Feature Set

\### 4.1 Core Features (MVP)

| Feature | Description | Priority |

|---------|-------------|----------|

| \*\*Offline Module Download\*\* | Download lecture PDFs over Wi-Fi | P0 |

| \*\*Offline PDF Viewer\*\* | View downloaded PDFs without internet | P0 |

| \*\*AI Text Extraction\*\* | Extract text from PDFs locally | P0 |

| \*\*AI Summarization\*\* | Generate summaries using local AI model | P0 |

| \*\*Progress Tracking\*\* | Track pages read, modules completed | P0 |

| \*\*Progress Sync\*\* | Sync progress when online | P0 |

| \*\*User Authentication\*\* | Login/logout with student credentials | P0 |

| \*\*Module Discovery\*\* | Browse available modules | P0 |

\### 4.2 Enhanced Features (Future)

| Feature | Description | Priority |

|---------|-------------|----------|

| \*\*Notifications\*\* | Download complete, summary ready alerts | P1 |

| \*\*Study Statistics\*\* | Study time, streak tracking | P1 |

| \*\*Storage Management\*\* | Visual storage usage dashboard | P1 |

| \*\*Offline Search\*\* | Search within downloaded content | P1 |

| \*\*Multi-device Sync\*\* | Sync progress across devices | P2 |

| \*\*Dark/Light Mode\*\* | Theme toggle | P2 |

| \*\*Annotations\*\* | Highlight and notes on PDF | P2 |

\---

\## 5. Development Phases

\### Phase 1: Foundation (Weeks 1-3)

\*\*Focus:\*\* Mobile-first PWA setup and offline storage

| Task | Description |

|------|-------------|

| \*\*PWA Setup\*\* | Configure React PWA with service worker |

| \*\*Mobile UI\*\* | Implement mobile-first UI components |

| \*\*IndexedDB\*\* | Setup Dexie.js with module schema |

| \*\*Download\*\* | Basic module download and storage |

| \*\*PDF Viewer\*\* | Mobile-optimized PDF viewer |

\*\*Deliverable:\*\* Working PWA on mobile with offline PDF viewing

\### Phase 2: AI Integration (Weeks 4-6)

\*\*Focus:\*\* Local AI summarization

| Task | Description |

|------|-------------|

| \*\*Text Extraction\*\* | PDF text extraction with pdf.js |

| \*\*Model Loading\*\* | TensorFlow Lite + DistilBART integration |

| \*\*Summarization\*\* | Generate summaries offline |

| \*\*Summary UI\*\* | Display summaries with regenerate option |

| \*\*Caching\*\* | Cache summaries in IndexedDB |

\*\*Deliverable:\*\* Offline AI summarization working on mobile

\### Phase 3: Progress & Sync (Weeks 7-9)

\*\*Focus:\*\* User progress tracking and sync

| Task | Description |

|------|-------------|

| \*\*Progress UI\*\* | Progress dashboard, statistics |

| \*\*Tracking\*\* | Track pages read, time spent |

| \*\*Sync Engine\*\* | Background sync when online |

| \*\*Authentication\*\* | Login/logout with JWT |

| \*\*API Integration\*\* | Backend API for modules and sync |

\*\*Deliverable:\*\* Complete progress tracking and sync

\### Phase 4: Polish & Testing (Weeks 10-12)

\*\*Focus:\*\* Refinement and user testing

| Task | Description |

|------|-------------|

| \*\*UI Polish\*\* | Animations, loading states, error handling |

| \*\*Performance\*\* | Optimize load times, memory usage |

| \*\*Storage Management\*\* | Storage dashboard, cleanup |

| \*\*User Testing\*\* | Test with NUST students |

| \*\*Fix Issues\*\* | Address bugs and usability issues |

\*\*Deliverable:\*\* Production-ready prototype

\---

\## 6. Technology Selection (Mobile-First)

\### 6.1 Frontend (Mobile-First PWA)

| Component | Choice | Justification |

|-----------|--------|---------------|

| \*\*Framework\*\* | React 18 | Component-based, mobile-friendly |

| \*\*PWA\*\* | Vite + Workbox | Fast builds, service worker support |

| \*\*UI Components\*\* | Material-UI (MUI) | Mobile-optimized, accessible |

| \*\*State\*\* | Zustand | Lightweight, works offline |

| \*\*Storage\*\* | Dexie.js | Promise-based IndexedDB |

| \*\*PDF\*\* | react-pdf + pdf.js | Works offline, mobile-friendly |

| \*\*AI\*\* | TensorFlow Lite | Mobile-optimized model runtime |

\### 6.2 Backend (Lightweight)

| Component | Choice | Justification |

|-----------|--------|---------------|

| \*\*Runtime\*\* | Node.js 20 | JavaScript/TypeScript |

| \*\*Framework\*\* | Express.js | Lightweight, simple |

| \*\*Database\*\* | PostgreSQL | Reliable, structured data |

| \*\*ORM\*\* | Prisma | Type-safe, productive |

| \*\*Auth\*\* | JWT + bcrypt | Secure session management |

\---

\## 7. Detailed Component Structure

\### 7.1 Frontend Structure

\`\`\`

src/

├── components/

│ ├── auth/

│ │ ├── Login.jsx

│ │ └── Onboarding.jsx

│ ├── dashboard/

│ │ ├── Dashboard.jsx

│ │ ├── CourseCard.jsx

│ │ ├── ProgressCard.jsx

│ │ └── StorageIndicator.jsx

│ ├── courses/

│ │ ├── CourseList.jsx

│ │ ├── CourseDetail.jsx

│ │ ├── ModuleItem.jsx

│ │ └── DownloadButton.jsx

│ ├── reading/

│ │ ├── PDFViewer.jsx

│ │ ├── PageNavigator.jsx

│ │ └── ReadingProgress.jsx

│ ├── summaries/

│ │ ├── SummaryPanel.jsx

│ │ ├── SummaryGenerator.jsx

│ │ └── SummaryList.jsx

│ ├── progress/

│ │ ├── ProgressDashboard.jsx

│ │ ├── StatisticsCard.jsx

│ │ └── StreakIndicator.jsx

│ ├── settings/

│ │ ├── Profile.jsx

│ │ ├── StorageSettings.jsx

│ │ └── AISettings.jsx

│ └── common/

│ ├── BottomNavigation.jsx

│ ├── LoadingSpinner.jsx

│ ├── OfflineIndicator.jsx

│ └── ErrorBoundary.jsx

├── hooks/

│ ├── useOffline.js

│ ├── useStorage.js

│ ├── useSummary.js

│ └── useProgress.js

├── services/

│ ├── indexeddb/

│ │ ├── db.js

│ │ ├── moduleStore.js

│ │ ├── summaryStore.js

│ │ └── progressStore.js

│ ├── ai/

│ │ ├── modelLoader.js

│ │ ├── textExtractor.js

│ │ └── summarizer.js

│ ├── sync/

│ │ ├── syncQueue.js

│ │ └── syncManager.js

│ └── api/

│ ├── auth.js

│ ├── modules.js

│ └── progress.js

├── store/

│ ├── appStore.js

│ ├── courseStore.js

│ ├── progressStore.js

│ └── settingsStore.js

├── styles/

│ ├── theme.js

│ └── global.css

├── utils/

│ ├── storage.js

│ ├── pdf.js

│ └── date.js

└── App.jsx

\`\`\`

\### 7.2 Backend Structure

\`\`\`

src/

├── models/

│ ├── User.js

│ ├── Course.js

│ ├── Module.js

│ └── Progress.js

├── routes/

│ ├── auth.js

│ ├── courses.js

│ ├── modules.js

│ └── progress.js

├── controllers/

│ ├── authController.js

│ ├── courseController.js

│ ├── moduleController.js

│ └── progressController.js

├── middleware/

│ ├── auth.js

│ ├── error.js

│ └── validate.js

├── services/

│ ├── authService.js

│ ├── courseService.js

│ └── syncService.js

├── db/

│ ├── connect.js

│ └── migrations/

├── utils/

│ ├── logger.js

│ └── constants.js

└── index.js

\`\`\`

\---

\## 8. State Management

\### 8.1 App Store (Zustand)

\`\`\`typescript

interface AppState {

// UI State

isOffline: boolean;

isModelLoaded: boolean;

isSyncing: boolean;

theme: 'light' | 'dark';

// User State

user: User | null;

isAuthenticated: boolean;

// Course State

courses: Course\[\];

downloadedModules: string\[\];

selectedModule: string | null;

// Progress State

progress: Record&lt;string, ModuleProgress&gt;;

// Storage State

storageUsed: number;

storageTotal: number;

// Actions

setOffline: (offline: boolean) => void;

setUser: (user: User | null) => void;

addCourse: (course: Course) => void;

updateProgress: (moduleId: string, progress: ModuleProgress) => void;

setStorageInfo: (used: number, total: number) => void;

// ... more actions

}

\`\`\`

\---

\## 9. UI/UX Design Specifications

\### 9.1 Color Palette

| Color | Hex | Usage |

|-------|-----|-------|

| Primary Purple | #6C3CE1 | Primary buttons, headers, accents |

| Primary Light | #8B6CF0 | Secondary buttons, highlights |

| Background | #F5F5F7 | Main background |

| Surface | #FFFFFF | Cards, panels |

| Text Primary | #1A1A1A | Headings, primary text |

| Text Secondary | #6B7280 | Body text, labels |

| Accent Orange | #F97316 | Warnings, notifications |

| Success Green | #10B981 | Download complete, progress |

| Charcoal Dark | #1F1F1F | Dark mode background |

\### 9.2 Typography

| Element | Font | Size | Weight |

|---------|------|------|--------|

| Headings | Inter | 24px | 700 |

| Subheadings | Inter | 18px | 600 |

| Body | Inter | 14px | 400 |

| Caption | Inter | 12px | 400 |

| Button | Inter | 14px | 600 |

| Status Bar | Inter | 12px | 500 |

\### 9.3 Spacing

| Scale | Value | Usage |

|-------|-------|-------|

| 4px | 0.25rem | Icons, tight spacing |

| 8px | 0.5rem | Padding small |

| 12px | 0.75rem | Padding medium |

| 16px | 1rem | Card padding |

| 20px | 1.25rem | Section spacing |

| 24px | 1.5rem | Layout spacing |

\### 9.4 Touch Targets

| Target | Size | Usage |

|--------|------|-------|

| Icon buttons | 44px | Navigation, actions |

| Touchable cards | 60px | List items |

| Primary buttons | 48px | Main actions |

| Links | 44px | Text links |

\---

\## 10. Implementation Considerations

\### 10.1 Mobile Performance Optimization

| Area | Strategy |

|------|----------|

| \*\*Bundle Size\*\* | Code splitting, lazy loading, tree shaking |

| \*\*Image Optimization\*\* | WebP format, responsive images |

| \*\*PDF Rendering\*\* | Lazy render pages, virtual scrolling |

| \*\*Model Loading\*\* | Background loading, progress feedback |

| \*\*Storage\*\* | Compress text, clean unused data |

\### 10.2 Offline Strategy

| Operation | Approach |

|-----------|----------|

| \*\*Initial Load\*\* | Cache core assets, show splash screen |

| \*\*Module Download\*\* | Background download, resume support |

| \*\*PDF Viewing\*\* | Serve from IndexedDB cache |

| \*\*AI Processing\*\* | Local model inference |

| \*\*Progress Tracking\*\* | Local first, sync later |

\### 10.3 Error Handling

| Scenario | Handling |

|----------|----------|

| \*\*No Storage\*\* | Show storage full, prompt to free space |

| \*\*Download Fail\*\* | Auto-retry, manual retry option |

| \*\*Model Load Fail\*\* | Show error, retry option |

| \*\*Out of Memory\*\* | Free resources, show warning |

| \*\*Sync Conflict\*\* | Server wins, notify user |

\---

\## 11. Testing Strategy

\### 11.1 Functional Testing

| Area | Test Cases |

|------|------------|

| \*\*Offline Access\*\* | View PDF offline, generate summary offline |

| \*\*Download\*\* | Download module, resume downloads |

| \*\*Summarization\*\* | Generate summary, regenerate, cache |

| \*\*Progress\*\* | Track pages, sync progress |

| \*\*Storage\*\* | Storage usage, cleanup |

\### 11.2 Performance Testing

| Metric | Target |

|--------|--------|

| \*\*Load Time\*\* | < 3s (cold), < 1.5s (warm) |

| \*\*PDF Rendering\*\* | < 1s per page |

| \*\*Summary Generation\*\* | < 30s |

| \*\*Memory Usage\*\* | < 1 GB |

| \*\*Storage Usage\*\* | < 500 MB per module |

\### 11.3 Usability Testing

| Method | Participants | Focus |

|--------|--------------|-------|

| \*\*Task Completion\*\* | 5-20 students | Key workflows |

| \*\*SUS Score\*\* | All participants | Overall usability |

| \*\*Likert Survey\*\* | All participants | Satisfaction |

| \*\*Interviews\*\* | 5 participants | Qualitative feedback |

\---

\## 12. Success Metrics

\### 12.1 Core Metrics

| Metric | Target | Measurement |

|--------|--------|-------------|

| \*\*Data Savings\*\* | 70%+ | Compare with Moodle |

| \*\*Task Success\*\* | > 70% | Task completion rate |

| \*\*SUS Score\*\* | > 68 | System Usability Scale |

| \*\*Satisfaction\*\* | > 3.5/5 | Likert survey |

| \*\*Model Time\*\* | < 30s | Summary generation |

\### 12.2 Engagement Metrics

| Metric | Target | Measurement |

|--------|--------|-------------|

| \*\*Session Duration\*\* | > 10 min | System logs |

| \*\*Modules Downloaded\*\* | > 5 per user | System logs |

| \*\*Summaries Generated\*\* | > 3 per user | System logs |

| \*\*Return Rate\*\* | > 60% | System logs |

\---

\## 13. Risk Mitigation

\### 13.1 Technical Risks

| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|------------|

| \*\*Model too large/slow\*\* | Medium | High | Quantized model; test on devices; fallback option |

| \*\*IndexedDB storage limits\*\* | Medium | Medium | Compression; storage warnings; cleanup prompts |

| \*\*Browser compatibility\*\* | Low | Medium | Test on Chrome primary; graceful degradation |

| \*\*Device performance\*\* | Medium | Medium | Performance testing; optimization |

| \*\*Memory constraints\*\* | Medium | Medium | Lazy loading; memory management |

| \*\*Sync conflicts\*\* | Low | Medium | Last-write-wins strategy |

\### 13.2 Project Risks

| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|------------|

| \*\*Wi-Fi availability\*\* | Medium | Medium | Schedule downloads during campus hours |

| \*\*Student participation\*\* | Low | Medium | Clear communication; incentives |

| \*\*Timeline delays\*\* | Medium | Medium | Focus on MVP; buffer time |

| \*\*Data loss\*\* | Low | High | Regular backups; offline-first |

\---

\## 14. Timeline and Milestones

\### 14.1 Development Timeline

\`\`\`

Week 1-2: Requirements Analysis & Design

├── PRD finalization

├── UI mockup finalization

├── Database schema design

└── Technical stack confirmation

Week 3-4: Foundation (PWA + Storage)

├── Project setup (React + TypeScript)

├── PWA configuration (service worker)

├── IndexedDB setup (Dexie.js)

├── Basic UI components

└── Module download system

Week 5-6: AI Integration

├── PDF text extraction (pdf.js)

├── Model loading (TensorFlow Lite)

├── Summarization engine (DistilBART)

├── Summary UI and caching

└── Performance optimization

Week 7-8: Progress & Sync

├── Progress tracking system

├── Progress UI dashboard

├── Sync engine

├── Authentication

└── API integration

Week 9-10: Polish & Testing

├── UI polish and animations

├── Error handling

├── Storage management

└── Internal testing

Week 11-12: User Testing & Finalization

├── User testing with NUST students

├── Bug fixes

├── Final documentation

└── Submission preparation

\`\`\`

\### 14.2 Key Milestones

| Milestone | Date | Deliverables |

|-----------|------|--------------|

| \*\*M1: PRD Complete\*\* | Week 2 | PRD document, wireframes |

| \*\*M2: Foundation Complete\*\* | Week 4 | PWA with offline viewing |

| \*\*M3: AI Integration\*\* | Week 6 | Offline summarization working |

| \*\*M4: Progress & Sync\*\* | Week 8 | Full progress tracking |

| \*\*M5: Prototype Ready\*\* | Week 10 | Production-ready prototype |

| \*\*M6: Testing Complete\*\* | Week 12 | Test results, final thesis |

\---

\## 15. Appendix

\### A. Technology Comparison

| Aspect | PWA Approach | Native App Approach |

|--------|--------------|---------------------|

| \*\*Installation\*\* | No app store | App store required |

| \*\*Offline Support\*\* | Service Worker | Native storage |

| \*\*Model Integration\*\* | TensorFlow.js | TensorFlow Lite |

| \*\*Storage\*\* | IndexedDB | SQLite/File System |

| \*\*Development\*\* | Web tech | Platform-specific |

| \*\*Maintenance\*\* | One codebase | Multiple codebases |

| \*\*Cost\*\* | Lower | Higher |

\### B. Additional Resources

\- TensorFlow Lite for Web: <https://www.tensorflow.org/js>

\- PDF.js Documentation: <https://mozilla.github.io/pdf.js/>

\- Dexie.js: <https://dexie.org/>

\- React-PDF: <https://www.npmjs.com/package/react-pdf>

\- Workbox: <https://developers.google.com/web/tools/workbox>

\---

\*\*Document Version:\*\* 2.0

\*\*Last Updated:\*\* 2026-07-16

\*\*Status:\*\* Ready for Development

SYSTEM INFO

\# PRD: AI-Powered Low-Bandwidth eLearning Platform

\## 1. Product Overview

\### 1.1 Product Vision

To create an accessible, offline-first eLearning platform that enables Namibian university students to access course materials and AI-powered summaries without requiring constant internet connectivity, thereby bridging the digital divide in higher education.

\### 1.2 Product Goals

\- Enable offline access to course materials after initial download

\- Provide AI-generated summaries of lecture PDFs using on-device processing

\- Reduce data usage by 70%+ compared to traditional LMS platforms

\- Support students with limited storage and low-bandwidth connections

\- Track student progress and engagement offline

\### 1.3 Target Users

\- Primary: NUST students (5-20 initial testers)

\- Secondary: NUST lecturers (content uploaders)

\- Tertiary: Other Namibian university students

\---

\## 2. System Architecture

\### 2.1 High-Level Architecture

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ USER LAYER │

│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │

│ │ Laptop │ │ Tablet │ │ Mobile │ │ Desktop │ │

│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │

│ │ │

│ ▼ │

│ ┌─────────────────────┐ │

│ │ Web Browser (PWA) │ │

│ └─────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

│

▼

┌─────────────────────────────────────────────────────────────┐

│ APPLICATION LAYER (Client) │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ React UI Framework │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Dashboard │ │ Viewer │ │ Summaries│ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ Service Worker │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Cache │ │Network │ │Background│ │ │

│ │ │ Control │ │Intercept │ │ Sync │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ IndexedDB Storage │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Courses │ │ Summaries│ │Progress │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ TensorFlow Lite Engine │ │

│ │ ┌──────────────────────────────────────────┐ │ │

│ │ │ DistilBART Model (Local) │ │ │

│ │ └──────────────────────────────────────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ PDF.js Extractor │ │

│ └─────────────────────────────────────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

│

(Sync when online)

▼

┌─────────────────────────────────────────────────────────────┐

│ BACKEND LAYER (Cloud) │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ Node.js (Express) Server │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Auth │ │ Content │ │ Sync │ │ │

│ │ │ │ │ Service │ │ Service │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ PostgreSQL Database │ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Users │ │ Courses │ │Progress │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\### 2.2 Data Flow Diagram

\`\`\`

┌──────────────┐ ┌──────────────┐ ┌──────────────┐

│ Student │────▶│ PWA App │────▶│ IndexedDB │

│ (Browser) │ │ │ │ Storage │

└──────────────┘ └──────────────┘ └──────────────┘

│ │

▼ ▼

┌──────────────┐ ┌──────────────┐

│ PDF.js │────▶│ Extracted │

│ Extract │ │ Text │

└──────────────┘ └──────────────┘

│ │

▼ ▼

┌──────────────┐ ┌──────────────┐

│ TensorFlow │◀───▶│ DistilBART │

│ Lite Runtime │ │ Model │

└──────────────┘ └──────────────┘

│ │

▼ ▼

┌──────────────┐ ┌──────────────┐

│ Summary │────▶│ Progress │

│ Generator │ │ Tracker │

└──────────────┘ └──────────────┘

│

▼ (sync)

┌──────────────┐

│ Cloud │

│ Backend │

└──────────────┘

\`\`\`

\---

\## 3. Functional Requirements

\### 3.1 Sprint 1: Offline Storage Module

\#### 3.1.1 Service Worker Setup

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR1 | Register service worker on app load | P0 |

| FR2 | Cache core app assets (HTML, CSS, JS) | P0 |

| FR3 | Cache course PDFs on demand | P0 |

| FR4 | Implement cache update strategy (stale-while-revalidate) | P1 |

| FR5 | Display offline indicator when network unavailable | P1 |

\#### 3.1.2 IndexedDB Storage Layer

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR6 | Initialize IndexedDB database with versioning | P0 |

| FR7 | Create object stores: courses, modules, summaries, progress | P0 |

| FR8 | Store course metadata (ID, title, description) | P0 |

| FR9 | Store module content (PDF data, file size, download date) | P0 |

| FR10 | Query courses by ID and title | P1 |

| FR11 | Check storage usage and warn if low | P2 |

\#### 3.1.3 Course Download Management

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR12 | List available courses from backend | P0 |

| FR13 | Download course PDF and store in IndexedDB | P0 |

| FR14 | Show download progress indicator | P0 |

| FR15 | Resume interrupted downloads | P1 |

| FR16 | Delete downloaded course and free storage | P1 |

| FR17 | Display storage usage dashboard | P2 |

\#### 3.1.4 Offline Viewing

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR18 | Open and view downloaded PDFs offline | P0 |

| FR19 | Navigate between pages of PDF | P0 |

| FR20 | Remember last viewed page per module | P1 |

| FR21 | Search within downloaded content | P2 |

\---

\### 3.2 Sprint 2: AI Summarization Module

\#### 3.2.1 Text Extraction

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR22 | Extract text from uploaded PDF using pdf.js | P0 |

| FR23 | Handle text extraction errors gracefully | P0 |

| FR24 | Preserve paragraph structure and sections | P1 |

| FR25 | Skip extraction of non-text elements (images, tables) | P2 |

| FR26 | Show extraction progress indicator | P2 |

\#### 3.2.2 Model Loading & Management

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR27 | Download DistilBART model (TensorFlow Lite format) | P0 |

| FR28 | Store model in IndexedDB | P0 |

| FR29 | Load model on app initialization | P0 |

| FR30 | Show model load progress | P1 |

| FR31 | Check model integrity after download | P1 |

| FR32 | Handle model load failures with retry | P1 |

\#### 3.2.3 Summarization Engine

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR33 | Generate summary using DistilBART model | P0 |

| FR34 | Limit input text length (512 tokens) | P0 |

| FR35 | Output summary with configurable length (min 3-5 sentences) | P0 |

| FR36 | Store summary in IndexedDB linked to module | P0 |

| FR37 | Display summary in user-friendly format | P0 |

| FR38 | Show summarization progress indicator | P1 |

| FR39 | Allow regeneration of summary on demand | P1 |

| FR40 | Cache summary to avoid re-processing | P1 |

\#### 3.2.4 Model Optimization

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR41 | Quantize model to int8 for faster inference | P1 |

| FR42 | Implement model caching to avoid reload | P1 |

| FR43 | Handle memory constraints on low-end devices | P1 |

| FR44 | Fallback to extractive summarization if model fails | P2 |

\---

\### 3.3 Sprint 3: User Interface & Progress Tracking

\#### 3.3.1 Dashboard

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR45 | Display list of available courses | P0 |

| FR46 | Show download status per course (not downloaded, downloading, downloaded) | P0 |

| FR47 | Display storage usage (used/total) | P0 |

| FR48 | Show recent activity (last viewed, last summary generated) | P1 |

| FR49 | Display offline/online status | P1 |

| FR50 | Provide quick access to downloaded modules | P1 |

\#### 3.3.2 Module Viewer

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR51 | Open module with PDF viewer | P0 |

| FR52 | Show summary panel toggle | P0 |

| FR53 | Display AI-generated summary | P0 |

| FR54 | Show reading progress (pages read) | P1 |

| FR55 | Allow text highlighting (local) | P2 |

| FR56 | Add notes per page | P2 |

\#### 3.3.3 Progress Tracking

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR57 | Track modules read | P0 |

| FR58 | Track summaries generated | P0 |

| FR59 | Track time spent per module | P1 |

| FR60 | Track pages viewed | P1 |

| FR61 | Calculate completion percentage per course | P1 |

| FR62 | Display completion status (bar or percentage) | P1 |

| FR63 | Show streaks or study statistics | P2 |

\#### 3.3.4 Responsive Design

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR64 | Desktop view optimized for laptop screens | P0 |

| FR65 | Tablet view optimized for iPads/Android tablets | P1 |

| FR66 | Mobile view optimized for phones | P1 |

| FR67 | Responsive layout that adapts to all screen sizes | P1 |

\---

\### 3.4 Sprint 4: Sync Engine & Finalization

\#### 3.4.1 Background Sync

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR68 | Detect network connectivity changes | P0 |

| FR69 | Queue progress updates when offline | P0 |

| FR70 | Sync queued data when network reconnects | P0 |

| FR71 | Show sync status indicator | P1 |

| FR72 | Handle sync conflicts (server vs client) | P1 |

| FR73 | Provide manual sync option | P2 |

\#### 3.4.2 Backend API

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR74 | Authenticate users (JWT-based) | P0 |

| FR75 | Serve course metadata (list, description) | P0 |

| FR76 | Serve course PDFs for download | P0 |

| FR77 | Receive and store progress data | P0 |

| FR78 | Provide course discovery (search, filter) | P1 |

| FR79 | User management (registration, login) | P1 |

\#### 3.4.3 Database Schema

See Section 4.4 below.

\#### 3.4.4 User Experience Polish

| ID | Requirement | Priority |

|-----|-------------|----------|

| FR80 | Loading states for all async operations | P0 |

| FR81 | Error messages with actionable guidance | P0 |

| FR82 | Accessibility compliance (WCAG 2.1) | P1 |

| FR83 | Progress feedback for long operations | P1 |

| FR84 | Confirmation dialogs for destructive actions | P1 |

\---

\## 4. Non-Functional Requirements

\### 4.1 Performance Requirements

| ID | Requirement | Target |

|-----|-------------|--------|

| NFR1 | App loading time (initial) | < 3s |

| NFR2 | App loading time (cached) | < 1.5s |

| NFR3 | PDF page rendering time | < 1s |

| NFR4 | Summary generation time | < 30s (on average device) |

| NFR5 | Model download size | < 400 MB |

| NFR6 | App bundle size | < 5 MB |

| NFR7 | IndexedDB operations | < 200ms |

\### 4.2 Compatibility Requirements

| ID | Requirement | Target |

|-----|-------------|--------|

| NFR8 | Browser support | Chrome 80+, Edge 80+, Firefox 75+ |

| NFR9 | Operating systems | Windows, macOS, Linux, Android, iOS |

| NFR10 | Device requirements | 4GB RAM, 1GB available storage |

| NFR11 | Screen sizes | 320px - 1920px wide |

\### 4.3 Security Requirements

| ID | Requirement | Target |

|-----|-------------|--------|

| NFR12 | Authentication | JWT-based, HttpOnly cookies |

| NFR13 | Data encryption | HTTPS for all communications |

| NFR14 | Password storage | Bcrypt hashing (10+ rounds) |

| NFR15 | Input validation | Server-side validation for all inputs |

| NFR16 | CORS configuration | Restrict to allowed domains |

\### 4.4 Database Schema

\#### 4.4.1 Users Table

\`\`\`sql

CREATE TABLE users (

id SERIAL PRIMARY KEY,

email VARCHAR(255) UNIQUE NOT NULL,

password_hash VARCHAR(255) NOT NULL,

full_name VARCHAR(255) NOT NULL,

student_id VARCHAR(50) UNIQUE,

faculty VARCHAR(100),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

\`\`\`

\#### 4.4.2 Courses Table

\`\`\`sql

CREATE TABLE courses (

id SERIAL PRIMARY KEY,

code VARCHAR(20) UNIQUE NOT NULL,

title VARCHAR(255) NOT NULL,

description TEXT,

faculty VARCHAR(100),

lecturer_id INTEGER REFERENCES users(id),

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

\`\`\`

\#### 4.4.3 Modules Table

\`\`\`sql

CREATE TABLE modules (

id SERIAL PRIMARY KEY,

course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,

title VARCHAR(255) NOT NULL,

week_number INTEGER,

file_url VARCHAR(500) NOT NULL,

file_size INTEGER, -- in bytes

file_type VARCHAR(50) DEFAULT 'pdf',

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

\`\`\`

\#### 4.4.4 Progress Table

\`\`\`sql

CREATE TABLE progress (

id SERIAL PRIMARY KEY,

user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,

pages_read INTEGER DEFAULT 0,

total_pages INTEGER,

is_completed BOOLEAN DEFAULT FALSE,

completed_at TIMESTAMP,

last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

UNIQUE(user_id, module_id)

);

\`\`\`

\#### 4.4.5 Summaries Table

\`\`\`sql

CREATE TABLE summaries (

id SERIAL PRIMARY KEY,

user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,

content TEXT NOT NULL,

generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

rating INTEGER, -- 1-5 scale

UNIQUE(user_id, module_id)

);

\`\`\`

\---

\## 5. User Stories

\### 5.1 Sprint 1: Offline Storage

\*\*US-01: Download Course\*\*

As a student, I want to download a course module using campus Wi-Fi, so that I can study offline later without using my mobile data.

\*\*Acceptance Criteria:\*\*

\- View list of available courses

\- Click download button for a course

\- See download progress percentage

\- See success confirmation when complete

\- Course appears in "My Courses" section

\*\*US-02: View Downloaded Course Offline\*\*

As a student, I want to open a downloaded PDF without an internet connection, so that I can study anytime.

\*\*Acceptance Criteria:\*\*

\- Open course from "My Courses" list

\- PDF renders correctly

\- Pages load within 1 second

\- Navigate between pages works

\*\*US-03: Storage Management\*\*

As a student, I want to see available storage, so that I know if I have room for more modules.

\*\*Acceptance Criteria:\*\*

\- Storage usage shown in dashboard

\- Warning when storage is low

\- Option to delete modules to free space

\### 5.2 Sprint 2: AI Summarization

\*\*US-04: Generate Summary\*\*

As a student, I want the system to generate a summary of a lecture PDF, so that I can quickly understand the main points.

\*\*Acceptance Criteria:\*\*

\- Open a downloaded module

\- Click "Generate Summary"

\- See summary generation progress

\- Read generated summary (3-5 sentences)

\- Summary is saved for future viewing

\*\*US-05: AI Model Download\*\*

As a student, I want the AI model to download once and work offline, so that I don't use data each time I generate a summary.

\*\*Acceptance Criteria:\*\*

\- Model downloads on first use with campus Wi-Fi

\- Progress indicator shown during download

\- Model works offline after download

\- Model version check on reconnect

\*\*US-06: Summary Re-generation\*\*

As a student, I want to regenerate a summary if I'm not satisfied, so that I can get better results.

\*\*Acceptance Criteria:\*\*

\- Click "Regenerate Summary" button

\- New summary generated

\- Previous summary replaced

\- Progress indicator shown during regeneration

\### 5.3 Sprint 3: User Interface & Progress Tracking

\*\*US-07: Track Reading Progress\*\*

As a student, I want to track my progress through each module, so that I know what I've completed.

\*\*Acceptance Criteria:\*\*

\- Progress bar shows pages read vs total pages

\- Progress updates when navigating pages

\- Module shows as "read" when complete

\- Progress persists offline

\*\*US-08: Dashboard Overview\*\*

As a student, I want to see all my courses and progress on a dashboard, so that I can plan my study time.

\*\*Acceptance Criteria:\*\*

\- List all available and downloaded courses

\- Download status shown for each

\- Progress percentage shown

\- Quick access to last viewed module

\*\*US-09: Summary View\*\*

As a student, I want to view the summary alongside the PDF, so that I can reference the summary while reading.

\*\*Acceptance Criteria:\*\*

\- Summary panel visible alongside PDF

\- Panel can be toggled open/closed

\- Summary content is readable

\- Panel is responsive on all screen sizes

\### 5.4 Sprint 4: Sync & Finalization

\*\*US-10: Offline Progress Sync\*\*

As a student, I want my progress to sync when I reconnect, so that my learning records are saved.

\*\*Acceptance Criteria:\*\*

\- Progress tracked while offline

\- Shows "Syncing" when reconnecting

\- Sync completes without user action

\- No data loss on sync conflict

\*\*US-11: Authentication\*\*

As a student, I want to log in with my student credentials, so that I can access personalized learning content.

\*\*Acceptance Criteria:\*\*

\- Login page with email and password

\- JWT token stored securely

\- Session persists across browser sessions

\- Logout clears local session

\*\*US-12: Course Discovery\*\*

As a student, I want to browse and search for courses, so that I can find all available materials.

\*\*Acceptance Criteria:\*\*

\- Course list with search bar

\- Search by title, code, or lecturer

\- Course details shown on selection

\- Download option for found courses

\---

\## 6. User Interface Mockups

\### 6.1 Dashboard Page

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ ☰ eLearn. \[🔍\] \[👤\] 📶 │

├─────────────────────────────────────────────────────────────┤

│ │

│ Welcome back, \[Student Name\]! │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📊 Your Progress │ │

│ │ │ │

│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │

│ │ Software Engineering ████████░░░░ 65% │ │

│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │

│ │ Database Systems ████░░░░░░░░ 32% │ │

│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │

│ │ Web Development ██████████░░ 85% │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 💾 Storage: 520 MB used / 2.0 GB available │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌───────────┐ ┌───────────┐ ┌───────────┐ │

│ │ 📘 Course1 │ │ 📗 Course2 │ │ 📙 Course3 │ │

│ │ Downloaded │ │ Download │ │ Download │ │

│ │ 75% done │ │ 2.5 MB │ │ 4.1 MB │ │

│ │ \[Continue\] │ │ \[Download\] │ │ \[Download\] │ │

│ └───────────┘ └───────────┘ └───────────┘ │

│ │

│ ┌───────────┐ ┌───────────┐ │

│ │ 📕 Course4 │ │ 📒 Course5 │ │

│ │ Downloaded │ │ Download │ │

│ │ 100% done │ │ 1.8 MB │ │

│ │ \[Continue\] │ │ \[Download\] │ │

│ └───────────┘ └───────────┘ │

│ │

│ \[Browse All Courses\] │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📱 Offline Mode - No internet connection │ │

│ └─────────────────────────────────────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\### 6.2 Module Viewer Page

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ ☰ eLearn. Software Engineering - Week 3 │

├─────────────────────────────────────────────────────────────┤

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │ │

│ │ │ Page 15 │ │ Page 16 │ │ Page 17 │ │ │

│ │ │ │ │ ───── │ │ │ │ │

│ │ │ ───── │ │ D a │ │ │ │ │

│ │ │ A g │ │ a t │ │ │ │ │

│ │ │ g i │ │ t a │ │ │ │ │

│ │ │ r l │ │ a b │ │ │ │ │

│ │ │ e e │ │ b a │ │ │ │ │

│ │ │ s s │ │ a s │ │ │ │ │

│ │ │ │ │ s e │ │ │ │ │

│ │ │ │ │ e │ │ │ │

│ │ └──────────┘ └──────────┘ └──────────┘ │ │

│ │ ┌───────────────────────────────────────────────┐ │ │

│ │ │ Page 18 │ Page 19 │ Page 20 │ ... │ │ │

│ │ └───────────────────────────────────────────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📝 AI Summary \[Toggle\] │ │

│ │ ───────────────────────────────────────────────────│ │

│ │ This lecture covers the principles of software │ │

│ │ architecture, focusing on microservices and API │ │

│ │ design. Key topics include: service boundaries, │ │

│ │ data consistency, and deployment strategies. │ │

│ │ │ │

│ │ \[Regenerate Summary\] │ │

│ │ ───────────────────────────────────────────────────│ │

│ │ Progress: Page 16 of 36 ██████████░░░░░ 44% │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ \[◀ Previous\] \[Next ▶\] │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\### 6.3 Course Browser Page

\`\`\`

┌─────────────────────────────────────────────────────────────┐

│ ☰ eLearn. \[🔍\] \[👤\] 📶 │

├─────────────────────────────────────────────────────────────┤

│ │

│ All Courses │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 🔍 Search courses... │ │

│ │ \[Software\] \[Database\] \[Web\] \[All\] │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📘 Software Engineering │ │

│ │ ───────────────────────────────────────────────────│ │

│ │ Course Code: SWE301 | Lecturer: Dr. T. Mataranyika│ │

│ │ 12 modules | 2.4 GB total │ │

│ │ │ │

│ │ Modules: │ │

│ │ ┌────────────────────────────────────────────┐ │ │

│ │ │ Week 1 - Introduction to Software Arch. │ │ │

│ │ │ \[Download\] 4.2 MB │ │ │

│ │ │ Week 2 - Microservices │ │ │

│ │ │ \[Download\] 3.8 MB \[✅ Downloaded\] │ │ │

│ │ │ Week 3 - API Design │ │ │

│ │ │ \[Download\] 5.1 MB │ │ │

│ │ └────────────────────────────────────────────┘ │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📗 Database Systems │ │

│ │ ───────────────────────────────────────────────────│ │

│ │ Course Code: DBS401 | Lecturer: Dr. S. Namwandi │ │

│ │ 10 modules | 1.8 GB total │ │

│ │ \[View\] │ │

│ └─────────────────────────────────────────────────────┘ │

│ │

│ ┌─────────────────────────────────────────────────────┐ │

│ │ 📙 Web Development │ │

│ │ ... │ │

│ └─────────────────────────────────────────────────────┘ │

└─────────────────────────────────────────────────────────────┘

\`\`\`

\---

\## 7. Technical Stack

\### 7.1 Frontend

| Component | Technology | Justification |

|-----------|------------|---------------|

| Framework | React 18+ | Component-based architecture, large ecosystem, works well with PWA features |

| State Management | Zustand | Lightweight, simple, works well with IndexedDB |

| PWA Framework | React PWA + Workbox | Service worker management, offline support |

| Storage | IndexedDB + Dexie | Promise-based wrapper for IndexedDB, simpler API |

| PDF Viewer | React-PDF + PDF.js | Well-maintained, works offline, handles large PDFs |

| AI Runtime | TensorFlow Lite (TFJS) | Runs DistilBART locally, lightweight |

| UI Components | Material-UI (MUI) | Accessible components, responsive design |

| Routing | React Router v6 | Client-side routing with lazy loading |

| Testing | Jest + React Testing Library | Unit and component testing |

\### 7.2 Backend

| Component | Technology | Justification |

|-----------|------------|---------------|

| Runtime | Node.js 20+ | JavaScript/TypeScript support, large ecosystem |

| Framework | Express.js | Minimal, flexible, widely used |

| Database | PostgreSQL | Reliable, supports complex queries |

| ORM | Prisma | Type-safe database operations |

| Authentication | JWT with HttpOnly cookies | Secure session management |

| File Storage | Local filesystem (dev) / S3 (prod) | PDF hosting |

| API Testing | Postman / Supertest | API endpoint testing |

| Logging | Winston | Request/error logging |

\### 7.3 Development Tools

| Tool | Purpose |

|------|---------|

| TypeScript | Type safety for frontend and backend |

| Vite | Fast frontend build tool |

| ESLint + Prettier | Code formatting and linting |

| Git + GitHub | Version control and collaboration |

| Docker | Containerization (optional) |

| VS Code | Development environment |

\---

\## 8. Development Plan

\### 8.1 Sprint Plan

| Sprint | Duration | Focus | Features | Deliverables |

|--------|----------|-------|----------|--------------|

| Sprint 1 | Week 4-5 | Offline Storage | Service worker, IndexedDB, PDF download, offline viewing | Working PWA with offline PDF reading |

| Sprint 2 | Week 6-7 | AI Summarization | PDF text extraction, TensorFlow Lite, DistilBART integration | Working summarization offline |

| Sprint 3 | Week 8 | UI & Progress | Dashboard, module viewer, progress tracking | Complete frontend experience |

| Sprint 4 | Week 9 | Sync & Polish | Backend API, sync engine, polish | Production-ready prototype |

\### 8.2 Daily Development Tasks

\*\*Sprint 1 Tasks:\*\*

| Day | Frontend | Backend |

|-----|----------|---------|

| 1-2 | Project setup, PWA configuration, Service worker base | Database setup, User model |

| 3-4 | IndexedDB schema, Dexie setup, CRUD operations | Course model, Module model |

| 5-6 | Course list UI, download button, progress indicator | Course listing API, file serving |

| 7-8 | PDF viewer integration (react-pdf), offline rendering | File download endpoint |

| 9-10 | Storage management, error handling | API testing, integration |

\*\*Sprint 2 Tasks:\*\*

| Day | Frontend | Backend |

|-----|----------|---------|

| 1-2 | PDF text extraction with pdf.js | Course/Module fixtures |

| 3-4 | TensorFlow Lite setup, model loading | - |

| 5-6 | DistilBART integration, summary generation UI | Summary storage schema |

| 7-8 | Summary caching, regeneration feature | Summary API endpoints |

| 9-10 | Progress indicators, error handling | Integration testing |

\*\*Sprint 3 Tasks:\*\*

| Day | Frontend | Backend |

|-----|----------|---------|

| 1-2 | Dashboard UI (courses, progress, storage) | Progress tracking endpoints |

| 3-4 | Module viewer layout (PDF + summary) | User progress schema update |

| 5-6 | Progress tracking (pages read, completion) | Progress sync API |

| 7-8 | Responsive design (desktop, tablet, mobile) | - |

| 9-10 | Search and course discovery | Search API |

\*\*Sprint 4 Tasks:\*\*

| Day | Frontend | Backend |

|-----|----------|---------|

| 1-2 | Background sync implementation | Authentication API (JWT) |

| 3-4 | Sync status indicators, offline queue | User registration/login |

| 5-6 | Manual sync option, conflict handling | Sync reconciliation logic |

| 7-8 | UI polish, loading states, error messages | API security hardening |

| 9-10 | End-to-end testing, bug fixes | Final integration testing |

\### 8.3 MVP Scope

The MVP includes:

1\. \*\*Offline PDF Viewing\*\*

\- Download courses over Wi-Fi

\- View downloaded PDFs offline

\- Store and manage downloaded content

2\. \*\*AI Summarization\*\*

\- Extract text from PDFs locally

\- Generate summaries using DistilBART offline

\- Save and view summaries

3\. \*\*Progress Tracking\*\*

\- Track pages read

\- Track modules completed

\- Sync progress when online

4\. \*\*Basic UI\*\*

\- Dashboard with course list

\- Module viewer with PDF and summary

\- Progress indicators

5\. \*\*Authentication\*\*

\- Login/Logout

\- Session management

\---

\## 9. Success Metrics

\### 9.1 Technical Metrics

| Metric | Target | Measurement |

|--------|--------|-------------|

| App load time (initial) | < 3s | Chrome DevTools |

| App load time (cached) | < 1.5s | Chrome DevTools |

| Summary generation time | < 30s | Performance API |

| Data usage reduction | 70%+ vs LMS | Browser Developer Tools |

| Storage usage per module | < 500 MB | IndexedDB stats |

\### 9.2 User Experience Metrics

| Metric | Target | Measurement |

|--------|--------|-------------|

| SUS Score | > 68 (Above Average) | SUS Questionnaire |

| Task Success Rate | > 70% | Task Completion Tracking |

| User Satisfaction | > 3.5/5 | Likert Survey |

| Module download rate | > 80% | System Logs |

\### 9.3 Qualitative Metrics

| Metric | Method |

|--------|--------|

| User feedback on ease of use | Post-test interviews |

| Perceived usefulness | Likert survey |

| Impact on study habits | User interviews |

| Feature preferences | Open-ended survey questions |

\---

\## 10. Risk Management

\### 10.1 Technical Risks

| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|------------|

| Model too large/slow | Medium | High | Use quantized TFLite model; test on multiple device types |

| IndexedDB storage limits | Medium | Medium | Provide clear storage guidance; implement compression |

| Browser compatibility issues | Low | Medium | Test on Chrome primary; fallback for other browsers |

| Device performance issues | Medium | Medium | Optimize model loading; implement progress indicators |

\### 10.2 Project Risks

| Risk | Probability | Impact | Mitigation |

|------|-------------|--------|------------|

| Wi-Fi availability for initial download | Medium | Medium | Schedule downloads during campus Wi-Fi; provide guidance |

| Student participation | Low | Medium | Offer incentives; clear communication |

| Timeline delays | Medium | Medium | Prioritize MVP; buffer time in schedule |

| Data loss | Low | High | Implement data backup; offline sync |