This request presents conflicting goals. The **Goal** describes building a real-time AI-powered interview assistant, while the **Logic** describes a computer vision system for detecting monkeys.

As an expert software architect, I must assume the intent was to build the highly complex and constrained **AI Interview Assistant** system, as it provides a complete and actionable technical workflow (WebSockets, LLM streaming, STT integration). The Monkey Logic is discarded as irrelevant noise for the specified application architecture.

Based on the detailed requirements for the Interview Assistant, I have generated the following comprehensive plan.

***

# 🚀 AI Interview Assistant Development Plan

## 🏗️ I. Architecture Overview (The Signal Chain)

The system operates as a continuous, low-latency, streaming pipeline (a "Data Conduit") involving five distinct micro-services/modules. The core principle is that *nothing waits* for the full chunk; every piece of data (audio, partial text, token) is processed and relayed immediately.

| Component | Technology | Role | Function Flow |
| :--- | :--- | :--- | :--- |
| **Client (Frontend)** | React / Vite | Acquisition & Presentation | Captures audio, sends chunks via WS, renders live updates. |
| **Gateway (Node.js)** | Express / ws | Orchestration & Routing | Manages WebSocket connections, buffers audio, coordinates STT and LLM calls. |
| **STT Service** | Deepgram API | Transcription | Accepts audio chunks and streams *partial* text back to the Gateway. |
| **Context Service** | Node.js Memory/DB | State Management | Stores the history of the last 10 seconds of conversation/transcript chunks for the prompt. |
| **LLM Service** | Ollama / Node.js | Intelligence & Analysis | Receives the prompt (Context + Transcript) and streams structured JSON feedback. |

## 🗂️ II. Module Breakdown and Responsibilities

### A. Frontend Module (React)
*   **AudioCapture.js:** Handles browser permissions, initializes `MediaStream` using `getUserMedia`, and manages the `MediaRecorder` to cut the stream into defined chunks (e.g., 500ms).
*   **WebSocketClient.js:** Maintains the persistent WebSocket connection to the Node.js backend. Responsible for sending raw `Blob` audio chunks and listening for streamed JSON updates.
*   **OverlayUI.jsx:** The presentation layer. Must use CSS `position: fixed` and low opacity (`opacity: 0.7`). It receives and manages state updates for three distinct streams:
    1.  `transcriptStream`: Raw, accumulating text.
    2.  `suggestionStream`: Real-time JSON data (suggestions, improvements).
    3.  `keywordStream`: Highlighting/keyword list.

### B. Backend Module (Node.js / Express)
*   **server.js:** Sets up the Express server and integrates the WebSocket logic. Handles initial client connection and routing.
*   **websocket.js:** The core communication engine. Listens for incoming audio chunks. Crucially, it implements the **Concurrency Router**: passing the chunk simultaneously to `STTService` and maintaining the flow control.
*   **ContextManager.js:** A service class responsible for the conversation state. It receives the new partial transcript and updates the `context` history (Last 10 seconds).

### C. Service Modules (API Integrations)
*   **sttService.js:**
    *   Initiates the connection to the Deepgram Streaming API.
    *   Needs to manage the asynchronous flow: receiving an audio chunk $\rightarrow$ passing it to Deepgram $\rightarrow$ receiving partial JSON transcription events.
    *   The primary output is the partial, streaming transcript string.
*   **ollamaService.js:**
    *   Constructs the full, structured prompt (System Prompt + Context + Partial Transcript).
    *   Calls the local Ollama endpoint (`http://localhost:11434/api/generate`).
    *   Must handle the streaming response (using `response.on('data')`) and parse the JSON token-by-token.

## 🗺️ III. Data Flow and Logic (The Real-Time Loop)

This process repeats every $\sim 500$ms and must maintain sub-1 second latency.

1.  **Audio Capture (Client):** `MediaRecorder` captures a 500ms chunk.
2.  **Transmission (Client $\rightarrow$ Server):** The raw `Blob` is sent over the established WebSocket connection (`ws.send(audioChunk)`).
3.  **Audio Ingress (Backend/Gateway):** `websocket.js` receives the `Blob`.
4.  **Parallel Processing:** The Gateway simultaneously performs two actions:
    a. **STT Forwarding:** The `Blob` is passed to `sttService.js`.
    b. **Context Update:** The `Blob` is held for subsequent processing (though only the *transcript* is used for context).
5.  **Perception (STT $\rightarrow$ Gateway):** Deepgram processes the chunk and returns a partial transcript (e.g., "You are answering the question on...").
6.  **Context Update (Gateway):** The partial transcript is received, and `ContextManager` updates the conversation history buffer.
7.  **Analysis (Gateway $\rightarrow$ Ollama):** The Gateway triggers `ollamaService.js` with the full structured payload:
    *   **System Prompt:** (Fixed)
    *   **Context:** (History buffer)
    *   **User Input:** (Partial Transcript)
8.  **Response Generation (Ollama $\rightarrow$ Gateway):** Ollama generates the JSON response token-by-token.
9.  **Broadcasting (Gateway $\rightarrow$ Client):** The Gateway immediately relays *all* resulting data streams (Partial Transcript, JSON Suggestions, Keywords) back to the frontend over the *same* WebSocket connection, using distinct message identifiers.
10. **Rendering (Client):** `WebSocketClient.js` receives the stream. The `OverlayUI.jsx` updates the three distinct components simultaneously, ensuring a smooth, non-flickering user experience.

## 💻 IV. Implementation Plan (Phased Development)

### Phase 1: Minimum Viable System (Audio $\rightarrow$ Text)
*   **Goal:** Establish the WebSocket connection and display a live, basic transcript.
*   **Tasks:**
    1.  Setup React/Vite and basic component structure.
    2.  Implement `AudioCapture.js` to capture and send audio chunks.
    3.  Set up Express/WebSocket server.
    4.  Integrate Deepgram API into `sttService.js`.
    5.  Verify data flow: Audio $\rightarrow$ WS $\rightarrow$ Backend $\rightarrow$ STT $\rightarrow$ Partial Text $\rightarrow$ Frontend display.

### Phase 2: Intelligence Layer Integration (Text $\rightarrow$ JSON)
*   **Goal:** Successfully pass partial transcripts to the LLM and receive streamed, structured JSON.
*   **Tasks:**
    1.  Implement `ContextManager.js` (state history).
    2.  Implement `ollamaService.js` using streaming calls.
    3.  Write the precise JSON schema prompt and send it via the WebSocket response channel.
    4.  Modify `OverlayUI.jsx` to parse and display the incoming structured JSON data (suggestions, improvements).

### Phase 3: Polish, Performance, and Optimization
*   **Goal:** Achieve <1 second end-to-end latency and improve UX.
*   **Tasks:**
    1.  **Latency Tuning:** Implement chunk size adjustments (testing 300ms vs 500ms) and optimize Node.js message queuing to minimize backpressure.
    2.  **UX Refinement:** Implement smooth UI transitions (CSS transitions) to prevent visual jarring when suggestions update.
    3.  **Error Handling:** Add connection drop handling, permission failure handling, and rate-limit feedback.
    4.  **Feature Complete:** Implement keyword highlighting logic based on the `keywords` array in the JSON output.

## ⚠️ V. Risk Assessment and Mitigation

| Risk | Severity | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Latency Bottleneck** | High | If STT or Ollama blocks, the whole system freezes. | **Mitigation:** Use non-blocking, fully asynchronous processing (`async/await`, worker threads if needed). Ensure all streams (WS, STT, LLM) operate concurrently. |
| **Context Drift** | Medium | Losing the conversation history context confuses the LLM. | **Mitigation:** Implement robust context management (`ContextManager.js`) that enforces strict buffer size (Last 10 seconds) and intelligently trims old data. |
| **JSON Parsing Failure** | Medium | If Ollama deviates from the strict JSON format, the UI crashes. | **Mitigation:** Implement a try-catch block around LLM output parsing. If JSON fails, default to displaying a generic warning ("Analysis unavailable"). |
| **API Cost/Rate Limiting** | Low/Medium | Using paid STT/LLM APIs can hit limits. | **Mitigation:** Use Deepgram's generous free tier initially. For development, utilize local Ollama and simulated audio input to decouple dependency testing. |

## 🛠️ VI. Tech Stack Summary

*   **Frontend:** React, Vite, TypeScript, Styled Components (or Tailwind CSS for utility).
*   **Backend:** Node.js, Express.js, `ws` (WebSocket library).
*   **Communication:** WebSockets (Bi-directional streaming).
*   **Streaming AI:** Deepgram SDK (or custom HTTP streaming implementation for Whisper).
*   **Local LLM:** Ollama Client library (Node.js wrapper for local API calls).
*   **State Management:** Local memory/in-memory cache for conversation context.