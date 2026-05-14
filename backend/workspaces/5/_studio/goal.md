You are a senior full-stack AI engineer. Build a real-time AI-powered interview assistant web app with the following strict requirements.

## 🎯 Goal

Create a system that captures live microphone audio, converts it to text in real time, sends it to an LLM (local Ollama), and displays live feedback and suggestions in a transparent overlay UI.

The system must feel real-time (latency under ~1 second for visible updates).

---

## 🏗️ Architecture Constraints

### Frontend

* Framework: React (with Vite or Next.js)
* Must:

  * Capture microphone audio using Web APIs (getUserMedia + MediaRecorder)
  * Stream audio chunks continuously (300–800ms chunks)
  * Use WebSocket (NOT HTTP polling)
  * Render:

    * Live transcript
    * AI feedback
    * Suggested answers
  * Display output inside a semi-transparent overlay div (fixed position, bottom or side)

---

### Backend

* Use Node.js (Express + WebSocket server)
* Responsibilities:

  1. Accept streaming audio chunks from frontend
  2. Forward audio to Speech-to-Text API (cloud-based, streaming preferred)
  3. Receive partial transcripts (NOT just final)
  4. Send transcript chunks to LLM (Ollama local API)
  5. Stream LLM responses back to frontend

---

### Speech-to-Text (IMPORTANT)

* Use a real-time or pseudo-streaming API
* Acceptable options:

  * OpenAI Whisper API (streaming or chunked)
  * Deepgram (preferred for real-time)
* Must support partial transcription

---

### LLM Layer (Local)

* Use Ollama running locally
* Model suggestions:

  * llama3
  * mistral
* Use streaming responses (token-by-token)

---

## 🔄 Real-Time Workflow

1. Capture audio chunk (~500ms)
2. Send chunk via WebSocket to backend
3. Backend forwards to STT
4. STT returns partial transcript
5. Backend sends transcript to Ollama
6. Ollama streams response
7. Backend forwards response to frontend
8. Frontend updates UI instantly
9. Repeat continuously

---

## 🧠 AI Prompting Logic (VERY IMPORTANT)

For each transcript chunk, send this structured prompt to Ollama:

SYSTEM PROMPT:
"You are a real-time interview assistant. Provide short, helpful, non-intrusive feedback. Do not repeat the transcript."

USER INPUT:

* Current transcript chunk
* Last 10 seconds of conversation context

OUTPUT FORMAT (STRICT JSON):
{
"suggestion": "...",
"improvement": "...",
"keywords": ["...", "..."],
"confidence": "low|medium|high"
}

---

## 🧩 Features

### Must-have

* Live transcript (streaming)
* AI suggestions updating in real-time
* Transparent overlay UI

### Nice-to-have

* Highlight keywords in UI
* Confidence indicator
* Smooth UI updates (no flickering)

---

## ⚡ Performance Requirements

* End-to-end latency < 1 second
* Use streaming everywhere (WebSocket + LLM streaming)
* Avoid blocking operations
* Use async processing

---

## 🧱 Suggested File Structure

/backend
server.js
websocket.js
sttService.js
ollamaService.js

/frontend
/src
App.jsx
AudioCapture.js
WebSocketClient.js
OverlayUI.jsx

---

## 🔌 API Details

### Ollama

* Endpoint: http://localhost:11434/api/generate
* Use:

  * stream: true

---

## ⚠️ Important Rules

* Do NOT wait for full sentences
* Process partial transcripts immediately
* Keep responses short (1–2 lines)
* System must not freeze if STT delays

---

## 🎨 UI Requirements

* Transparent overlay (opacity ~0.7)
* Fixed position
* Sections:

  * Transcript (top)
  * Suggestions (middle)
  * Keywords (bottom)

---

## 🧪 Deliverables

* Working real-time demo
* Clean modular code
* Instructions to run:

  * start backend
  * start frontend
  * run Ollama

---

Build this step-by-step and ensure each stage works before moving to the next.
