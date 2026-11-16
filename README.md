# InterviewAce AI - Professional AI-Powered Interview Preparation Platform

A full-stack, production-grade AI interview preparation web application tailored for first-year B.Tech students and freshers in India.

InterviewAce provides realistic mock interviews, objective 6-criteria AI grading, voice narration and speech-to-text recognition, PDF/DOCX resume intelligence, dynamic progress analytics, a curated 35+ question bank, and personalized 7-day preparation roadmaps.

---

## 🌟 Key Features

### 1. 🤖 Secure AI Evaluation Engine
- **Powered by Google Gemini Flash** (`gemini-2.5-flash`, with automatic zero-delay candidate fallback to `gemini-flash-latest` and `gemini-3-flash-preview`).
- **Strict 6-Criteria Rubric** scored on integer 0-2 scales:
  1. **Relevance**: Direct focus on the question prompt.
  2. **Technical Accuracy**: Factually sound definitions and terminology.
  3. **Clarity**: Simplicity and articulateness of explanation.
  4. **Depth**: Inclusion of core principles or concrete project examples.
  5. **Structure**: Logical sequence (definition → explanation → example).
  6. **Communication**: Clean delivery, vocabulary, and confidence.
- **Honest Scoring Guard**: Short, vague answers (<20 words, or <8 words for quick-fire) are capped at a maximum score of 7 to ensure genuine feedback.
- **Detailed Diagnostic Feedback**: Every response receives concrete feedback on what went well, actionable areas to improve, specific missing technical concepts, a benchmark sample answer, and follow-up probing questions.

### 2. 📄 Resume Intelligence & Contextual Probing
- **Zero-Dependency Resume Parser**: Supports `.pdf`, `.docx`, and `.txt`/`.md` formats using native stream decompression (`zlib`).
- **Skill & Project Extraction**: Automatically identifies technical skills (JavaScript, Python, C++, SQL, Git, etc.), academic coursework, and project highlights.
- **Contextual Interview Questions**: At least 2 interview questions dynamically probe specific technologies and projects mentioned on the candidate's resume.
- **Privacy Controls**: Resume text and parsed skills can be inspected, updated, or wiped with a single click.

### 3. 🎙️ Voice & Quick-Fire Rounds
- **Realistic Voice Narration**: Automated speech synthesis (Web Speech API) reads questions aloud.
- **Hands-Free Speech Recognition**: Real-time microphone capture with live transcription and filler word detection (`um`, `like`, `basically`, `actually`, `you know`).
- **60-Second Quick-Fire Rounds**: Countdown timer testing rapid conceptual clarity on technical basics.

### 4. 📊 Performance Analytics & Dashboard
- **Radar & SVG Metric Visualizations**: Tracks categorical mastery across HR, Technical, Behavioral, Situational, and Resume-based questions.
- **Historical Session Records**: Stores full interview transcripts, timestamps, scores, and verdicts.
- **Achievement Milestones**: Unlocks badges for completing sessions, achieving high scores, maintaining clean delivery, and demonstrating continuous improvement.

### 5. 📅 Personalized 7-Day Preparation Plan
- Diagnostic report generates a day-by-day customized improvement roadmap based on specific weak areas detected during the interview.
- Interactive checkboxes persist progress in both browser storage and the backend SQLite database.

### 6. 📚 Curated Question Bank
- **35+ Fresher-Level Questions** covering HR, Technical (HTML/CSS, JavaScript, OOP, SQL, Python, Data Structures), Behavioral, Situational, Resume-based, and Quick-fire.
- **Multi-Filter Controls**: Filter by category, target role (Web Developer, Data Analyst, AI/ML, Software Tester, HR), difficulty, or search keywords.
- **Individual Question Practice**: Click "Practice This Question" on any card to launch an immediate, single-question practice session with full AI feedback.
- **Persistent Bookmarks**: Save essential questions for rapid revision.

---

## 🔒 Security & Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│   (HTML5 + Vanilla JavaScript + CSS - Zero API Keys Stored) │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / CORS (Port 5000)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express Backend Server                   │
│  - Input Sanitization & XSS Stripping                       │
│  - Sliding-Window Rate Limiting (General & AI Endpoints)    │
│  - Security Headers (CSP, X-Content-Type, X-Frame-Options)  │
│  - Secure Environment Access: process.env.GEMINI_API_KEY    │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐ ┌─────────────▼───────────────┐
│     SQLite / JSON Database  │ │    Google Gemini API Engine │
│  - Profiles & Sessions      │ │  - gemini-2.5-flash         │
│  - Bookmarks & 7-Day Plans  │ │  - Multi-model failover     │
│  - Candidate Resumes        │ │  - Structured JSON schema   │
└─────────────────────────────┘ └─────────────────────────────┘
```

- **Zero Client Credential Leakage**: The Gemini API key is read solely on the Node.js backend from `backend/.env`. It is never exposed in frontend scripts, network requests, or localStorage.
- **Rate Limiting**: AI evaluation endpoints are protected by a sliding-window limiter (25 requests/min) to prevent abuse and quota exhaustion.
- **Safe Input Processing**: All incoming payloads undergo recursive sanitization, removing control characters and HTML script tags.
- **Graceful Error Masking**: Backend internal errors and raw SDK stack traces are sanitized before sending responses to clients.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
- A Google Gemini API Key (get a free key from [Google AI Studio](https://aistudio.google.com/))

### 1. Installation
Clone or navigate to the project directory:
```bash
cd "d:/final project"
```

Install backend dependencies (if not already installed):
```bash
cd backend
npm install
cd ..
```

### 2. Configure Your API Key
Open `backend/.env` (or copy `backend/.env.example` to `backend/.env`) and add your Gemini API key:
```env
PORT=5000
NODE_ENV=development
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Launch the Application

#### Option A: One-Click Windows Launcher
Double-click **`run-app.bat`** in the project root. This starts the backend server and automatically opens your browser to:
```
http://localhost:5000
```

#### Option B: Terminal Command
From the project root:
```bash
npm start
```
Then open `http://localhost:5000` in any web browser.

---

## 📡 API Endpoints Specification

### Interview Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/interview/generate-question` | Generates an adaptive interview question based on role, difficulty, and resume context. |
| `POST` | `/api/interview/evaluate-answer` | Evaluates candidate answer across 6 criteria, detecting filler words, missing concepts, and follow-up probes. |
| `POST` | `/api/interview/generate-report` | Analyzes full transcript to generate diagnostic scoring, strengths, weaknesses, and 7-day roadmap. |

### Resume Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/resume/parse` | Accepts base64 PDF, DOCX, or TXT file and extracts technical skills, projects, and education. |
| `GET` | `/api/resume/latest` | Retrieves the currently active candidate resume. |
| `DELETE` | `/api/resume` | Deletes stored resume and clears extracted skill context. |

### Data & Persistence Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config-status` | Returns backend connection status and active model (without revealing API keys). |
| `GET` / `PUT` | `/api/profile` | Reads or updates user preferences and target role settings. |
| `GET` / `POST` | `/api/history` | Fetches historical interview sessions or records a completed round. |
| `DELETE` | `/api/history/:id` | Deletes a specific session record from the SQLite database. |
| `GET` / `POST` | `/api/bookmarks` | Manages saved questions from the Question Bank. |
| `GET` / `PUT` | `/api/plan` | Reads and updates 7-day improvement plan checkbox states. |
| `GET` | `/api/data/export` | Downloads a complete JSON backup of all user data. |
| `DELETE` | `/api/data/reset` | Permanently wipes all stored profile, history, and resume data. |

---

## 🧪 Testing & Verification Report

### Automated & Manual Test Coverage
- **Server Health Check**: `GET /api/health` returns HTTP 200 with database status and key confirmation.
- **Security Check**: Verified that no client-side script contains raw API keys or tokens.
- **Model Fallback**: Verified that HTTP 404 responses trigger automatic candidate rotation (`gemini-2.5-flash` → `gemini-flash-latest` → `gemini-3-flash-preview`).
- **Short Answer Capping**: Verified that responses under 20 words (or 8 words for quick-fire) are constrained to a maximum score of 7.
- **Cross-Browser Speech Synthesis**: Verified Web Speech API triggers with fallback for non-supported browsers.
- **Resume Extraction**: Successfully verified text and skill extraction from sample PDF, DOCX, and TXT files.

---

## 📄 License
MIT License. Built for students, engineers, and educational interview preparation.
