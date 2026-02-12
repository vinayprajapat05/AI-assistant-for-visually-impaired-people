# 🧿 AI Assistant for Visually Impaired People

An intelligent, local-only assistant that helps visually impaired users understand their surroundings by capturing images, extracting text via **OCR**, and delivering spoken summaries powered by a **local LLM** — all through voice commands and a fully accessible interface.

---

## 📑 Table of Contents

- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Usage](#-usage)
- [Troubleshooting](#-troubleshooting)

---

## 🛠 Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | ^18.2.0 | Core UI library for building a component-based, reactive user interface (camera view, result screens, voice command UI). |
| **TypeScript** | ^5.2.2 | Adds static typing to the codebase for improved code quality, better IDE support, and fewer runtime errors. |
| **Vite** | ^5.2.0 | Lightning-fast build tool and dev server used for bundling the frontend, providing instant HMR (Hot Module Replacement) during development. |
| **@vitejs/plugin-react** | ^4.2.1 | Official Vite plugin that enables React Fast Refresh and JSX/TSX compilation within the Vite build pipeline. |
| **CSS (Vanilla)** | — | Custom styling for the application layout, camera overlay, processing spinner, result display, and responsive design. |

### Frontend — Browser APIs

| API | Purpose |
|---|---|
| **Web Speech API — `SpeechRecognition`** | Enables continuous, hands-free voice command recognition (e.g., "Open Camera", "Retake Image", "Replay", "Stop") so users can control the app entirely with their voice. |
| **Web Speech API — `SpeechSynthesis`** | Converts the generated text summaries into spoken audio output, reading results aloud for the visually impaired user. |
| **MediaDevices API (`getUserMedia`)** | Accesses the device camera (preferring the rear/environment camera on mobile) to capture live video for image processing. |
| **Canvas API** | Captures a still frame from the live video feed, converts it to a JPEG blob, and sends it to the backend for processing. |
| **Fetch API** | Handles HTTP `POST` requests to send the captured image to the backend and receive the JSON summary response. |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.x | Core programming language for the entire backend pipeline — OCR, text cleaning, summarization, and API server. |
| **FastAPI** | latest | High-performance, async-ready web framework used to expose the `/process-image` REST API endpoint that receives uploaded images and returns JSON summaries. |
| **Uvicorn** | latest | ASGI server that runs the FastAPI application, supporting async request handling and hot-reload during development. |
| **python-multipart** | latest | Enables FastAPI to parse `multipart/form-data` requests, which is required for handling image file uploads from the frontend. |

### OCR & Image Processing

| Technology | Version | Purpose |
|---|---|---|
| **Tesseract OCR** | latest | Open-source OCR engine that extracts raw text from product label images and other printed/handwritten text. Runs fully offline — no cloud API required. |
| **pytesseract** | latest | Python wrapper around the Tesseract OCR engine, used to call `image_to_data()` for word-level text extraction with bounding-box coordinates and confidence scores. |
| **Pillow (PIL)** | latest | Python imaging library used for image preprocessing before OCR — including image opening, RGB conversion, 2× upscaling (bicubic), contrast enhancement (1.5×), sharpness enhancement (2×), and drawing OCR bounding-box highlights. |

### AI / Summarization

| Technology | Version | Purpose |
|---|---|---|
| **Ollama** | latest | Local LLM runtime that hosts and serves the AI model on your machine. Ensures complete privacy — no data is sent to external servers. |
| **Llama 3 (via Ollama)** | llama3 | The large language model used for intelligent text summarization. It analyzes the cleaned OCR text, detects the content type (product label, document, receipt, sign, etc.), and generates a clear, spoken-friendly summary. For product labels, it provides detailed breakdowns (name, ingredients, nutritional info, expiry date, warnings, etc.). |
| **ollama (Python SDK)** | latest | Python client library for communicating with the locally running Ollama server via the `ollama.chat()` method to send system/user prompts and retrieve model responses. |

### Text Processing

| Technology | Purpose |
|---|---|
| **`re` (Python Regex)** | Rule-based text cleaning module that removes OCR noise — strips non-alphanumeric garbage characters, collapses repeated symbols, filters single-letter noise, and normalizes whitespace to produce cleaner input for the LLM. |

### Dev Tools & Configuration

| Technology | Purpose |
|---|---|
| **npm** | Package manager for installing and managing frontend JavaScript/TypeScript dependencies. |
| **pip** | Package manager for installing Python backend dependencies from `requirements.txt`. |
| **CORS Middleware (FastAPI)** | Configured with `CORSMiddleware` to allow cross-origin requests from the frontend dev server (`localhost:5173`) to the backend API (`localhost:8000`). |
| **Base64 Encoding** | After OCR processing, the highlighted image (with bounding boxes drawn around detected text) is Base64-encoded and sent back to the frontend for inline display. |

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
│   Voice Commands ↔ Speech Recognition / Speech Synthesis        │
│   Camera Feed → Canvas Capture → Image Blob                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP POST (multipart/form-data)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (:8000)                      │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  OCR Engine   │──▶│ Text Cleaner │──▶│ Summarizer (Llama 3) │ │
│  │ (Tesseract +  │   │   (Regex)    │   │   (via Ollama)       │ │
│  │   Pillow)     │   └──────────────┘   └──────────────────────┘ │
│  └──────────────┘                                                │
└──────────────────────────┬───────────────────────────────────────┘
                           │  JSON Response
                           ▼    (summary + highlighted image)
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                        │
│           Display Summary → Speak Aloud via TTS                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
AI-assistant-for-visually-impaired-people/
├── backend/
│   ├── config.py            # Tesseract path & Ollama model configuration
│   ├── ocr_engine.py        # Image preprocessing + Tesseract OCR extraction
│   ├── text_cleaner.py      # Regex-based text cleaning pipeline
│   ├── summarizer.py        # Ollama/Llama 3 summarization logic
│   ├── server.py            # FastAPI app with /process-image endpoint
│   ├── requirements.txt     # Python dependencies
│   └── temp_uploads/        # Temporary storage for uploaded images
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React component (camera, capture, results)
│   │   ├── App.css          # Application styles
│   │   ├── speechService.ts # Voice recognition & text-to-speech service
│   │   └── main.tsx         # React entry point
│   ├── index.html           # HTML shell
│   ├── package.json         # Node.js dependencies & scripts
│   ├── tsconfig.json        # TypeScript configuration
│   └── vite.config.ts       # Vite build configuration
├── main.py                  # CLI entry point (standalone usage without server)
├── requirements.txt         # Root-level Python dependencies
└── README.md
```

---

## ✅ Prerequisites

1. **Tesseract OCR**
   - Download and install from [UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki).
   - Ensure it is installed at `C:\Program Files\Tesseract-OCR\tesseract.exe` **OR** update the path in `backend/config.py`.

2. **Ollama**
   - Download and install from [ollama.com](https://ollama.com).
   - Pull the `llama3` model (or update `backend/config.py` with your preferred model):
     ```bash
     ollama pull llama3
     ```

3. **Node.js & npm**
   - Required for the frontend. Download from [nodejs.org](https://nodejs.org).

4. **Python 3.x & pip**
   - Required for the backend. Download from [python.org](https://www.python.org).

---

## 🚀 Installation & Setup

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Start the Backend Server

```bash
cd backend
python -m uvicorn server:app --reload
```

The API server will run at `http://localhost:8000`.

### 4. Start the Frontend Dev Server

Open a **new terminal**:

```bash
cd frontend
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🎯 Usage

1. **Grant Permissions** — Allow camera and microphone access when prompted by the browser.
2. **Voice Commands** — Control the app entirely with your voice:
   | Command | Action |
   |---|---|
   | "Open Camera" / "Start" | Opens the camera view |
   | "Retake Image" / "Take Again" | Re-opens the camera for a new capture |
   | "Replay" / "Repeat" | Replays the spoken summary |
   | "Stop" / "Quiet" | Stops the current speech output |
3. **Capture** — Tap anywhere on the screen while the camera is active to capture an image.
4. **Result** — The app will process the image, display the OCR-highlighted image, and speak the summary aloud.

---

## 🔧 Troubleshooting

| Issue | Solution |
|---|---|
| **Camera / Microphone not working** | Ensure browser permissions are granted. HTTPS may be required on mobile devices (localhost works for development). |
| **Ollama connection error** | Ensure `ollama serve` is running in the background and the `llama3` model is pulled via `ollama pull llama3`. |
| **Tesseract not found** | Verify that Tesseract is installed at the path specified in `backend/config.py`. |
| **CORS errors in browser console** | The backend is configured to allow all origins for local development. Make sure the backend is running on port `8000`. |
| **No text detected (blank summary)** | Ensure the image has clear, readable text. Try bringing the label/text closer to the camera and ensure good lighting. |
