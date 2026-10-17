
# 🌟 DreamCanvas

DreamCanvas is an **AI-powered personal career coach** designed to help users become job-ready through **personalized learning roadmaps, AI guidance, and intelligent job analysis**. It combines **machine learning, large language models, and gamification** to create a complete career development platform.

🌐 **Live Demo:**
[https://dreamcanvas-murex.vercel.app](https://dreamcanvas-murex.vercel.app)

---

## 🚀 Core Features

### 🎯 AI-Generated Learning Roadmap

* Generates a **personalized 30-day roadmap** based on the user’s target role
* Daily topics broken into **actionable subtasks**
* Powered by **GROQ LLM**

---

### 🎥 Smart YouTube Learning Integration

* Automatically fetches **high-quality learning videos** for each subtask
* Combines:

  * Full-course videos for core topics
  * Focused tutorials for individual subtasks
* Avoids low-quality or irrelevant content

---

### 🔥 Streaks, Progress & Gamification

* Daily streak tracking to encourage consistency
* Visual roadmap progress bar
* Achievement badges:

  * Starter Day Badge
  * 3-Day, 7-Day, 14-Day Streak Badges
  * Ultimate Finisher Badge

---

### 🧠 Missing Skills Detection

* Identifies skill gaps based on the user’s target role
* Suggests what to learn next
* Integrated into roadmap generation

---

### 🛡️ Secure Authentication & Persistence

* User authentication with **Supabase**
* Persistent storage of:

  * Roadmaps
  * Progress
  * Badge states
  * User preferences

---

## 🆕 Job Detection & Career Safety Module

DreamCanvas includes an advanced **AI-powered job posting analysis system** to help users avoid fraudulent job listings and make informed career decisions.

---

### 🚨 Job Fraud Detection (ML-Based)

* Uses a **BERT + SVM** machine learning pipeline to classify job postings as:

  * ✅ Real Job Posting
  * ⚠️ Fake Job Posting
* Trained on job posting datasets to detect:

  * Unrealistic salary claims
  * Vague or missing company details
  * Urgency-based and manipulative language

---

### 🔍 Explainable AI (Why the Job is Fake or Real)

* Converts ML predictions into **human-readable explanations**
* Uses **GROQ LLM** to explain:

  * Language patterns
  * Missing information
  * Suspicious promises
* Provides **practical safety advice** instead of just labels

**Example Output:**

```

• Promises unusually high pay with minimal experience
• Lacks clear company or recruiter information
• Uses urgency-based language to pressure applicants

Advice:
Avoid sharing personal details and verify the employer independently.
```

---

### 🤖 AI Career Chatbot (Global Assistant)

* Floating AI assistant available across the app
* Provides:

  * Career guidance
  * Job readiness advice
  * Learning recommendations
* Context-aware:

  * Target role
  * Roadmap
  * Job detection results
* Powered by **GROQ LLM**

---

### 🔗 Integrated Workflow

The job detection system is fully integrated into DreamCanvas:

```
Job Description
   ↓
ML Fraud Detection (BERT + SVM)
   ↓
Explainable AI (GROQ)
   ↓
AI Career Advice & Learning Guidance
```

---

## 🧰 Tech Stack

| Technology               | Purpose                           |
| ------------------------ | --------------------------------- |
| **Next.js (App Router)** | Frontend & API routes             |
| **TypeScript**           | Type safety                       |
| **Tailwind CSS**         | Styling                           |
| **Framer Motion**        | Animations                        |
| **Supabase**             | Authentication & database         |
| **FastAPI**              | ML model serving                  |
| **BERT + SVM**           | Job fraud detection               |
| **GROQ LLM**             | AI roadmap, explanations, chatbot |
| **YouTube Data API**     | Learning resources                |
| **html2pdf.js**          | Roadmap export                    |

---

## 🧑‍💻 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/DreamCanvas.git
cd dreamcanvas
```

### 2️⃣ Install Dependencies

```bash
npm install
# or
yarn
```

### 3️⃣ Configure Environment Variables

Use the existing `.env` file in the project root (do not create a second environment file). Set these values in it:

```env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
REDIS_URL=redis://localhost:6379
GROQ_API_KEY=your-groq-key
YOUTUBE_API_KEY=your-youtube-key
```

The Supabase URL and anon key are required for login. Redis must be running and reachable through `REDIS_URL`; registration fails closed if its shared rate limiter is unavailable. Start the local Redis service with `docker compose up redis`, or run the full stack with `docker compose up --build`. In production, configure `REDIS_URL` for the deployment's shared Redis service and ensure the trusted reverse proxy overwrites `X-Real-IP` with the client address.

In Supabase, enable Email authentication and confirm the email address before logging in if email confirmation is enabled. For breached-password checks, enable Supabase Auth's leaked-password protection in the Dashboard under Authentication → Security and Protection if it is available for the project. DreamCanvas continues to delegate password storage and verification to Supabase Auth; it does not implement custom password hashing. No CAPTCHA provider is currently configured.

### 4️⃣ Run locally

```bash
npm run dev
# or
yarn dev
```

Open `http://localhost:3000`. Run the job-detection API separately if needed:

```bash
cd services/job-detection
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Run all services with Docker Compose

The root `Dockerfile` builds the Next.js app (also used by the worker); `services/job-detection/Dockerfile` builds the Python API. They are separate services, not duplicate app Dockerfiles.

With Docker Desktop running and the Supabase values set in the root `.env` file:

```bash
docker compose up --build
```

Open `http://localhost:3000`. Stop the services with `Ctrl+C`, then run `docker compose down`.

---

## System Health and Heartbeat Monitor

Open `/system-health` from the Profile menu to see live health checks for the frontend/API, AI services, configured database, Redis, and the roadmap worker. The dashboard polls real service endpoints using `HEARTBEAT_INTERVAL` (default 10 seconds); probe timeouts and the failure threshold are configurable with `HEARTBEAT_TIMEOUT` and `HEARTBEAT_FAILURE_THRESHOLD`. The AI/ML card has a development/demo-only failure simulation that changes monitor state only and never stops a service. See [docs/health-monitoring.md](docs/health-monitoring.md) for the protocol, endpoints, status transitions, and limitations.

---

## Lamport Clock Workflow Monitor

Learning-plan requests now carry a correlation ID and Lamport timestamp through the browser, Next.js API, Groq request, optional Redis worker, and actual Supabase save event. Open `/distributed-monitor` to follow the live timeline, filter by process/request ID, and distinguish causal Lamport order from physical time. For a viva demonstration, open `/analyze`, choose **Load DevOps Engineer Lamport-clock demo**, and generate a plan. See [docs/lamport-clocks.md](docs/lamport-clocks.md) for architecture, event meanings, limitations, and the receive rule.

---

## 🧪 Job Detection API (Backend)

The job detection model is served via a **FastAPI backend**, deployed separately.

### Endpoint

```
POST /predict
```

### Request Body

```json
{
  "description": "Job posting text..."
}
```

### Response

```json
{
  "prediction": 1,
  "confidence": 0.84
}
```

---

## 🎯 Why DreamCanvas is Unique

* Combines **ML + LLMs** in a single platform
* Focuses on **trust, explainability, and user safety**
* Not just learning — **career intelligence**
* Built with real-world production practices

---

## 📌 Future Enhancements

* Skill gap analysis vs job requirements
* Resume analyzer with ATS-style feedback
* Job readiness score visualization
* Phrase-level fraud highlighting
* Personalized learning recommendations from job analysis

---

## Distributed Systems Extension

DreamCanvas now includes a practical distributed-systems lab without replacing the original career-learning features:

- Redis queue and background worker for asynchronous roadmap jobs.
- FastAPI `/predict` service reached through a Next.js RPC proxy with validation, retry, timeout, health checks, and graceful failure.
- SSE distributed event monitor at `/distributed-monitor`, including logical clock values.
- WebRTC Study Room at `/study-room` with direct DataChannel chat and camera/microphone media after signaling.
- System status at `/system-status` and Docker Compose for frontend, worker, FastAPI, and Redis.

See [docs/distributed-systems.md](docs/distributed-systems.md) for the Mermaid architecture diagram, syllabus mapping, environment variables, communication mechanisms, and demo flow.

### Distributed demo

1. Copy `.env.example` to `.env.local` and add the existing Supabase, GROQ, and YouTube values.
2. Run `npm install` and `npm run dev`, or run `docker compose up --build`.
3. Use Analyze's Redis-worker button with the worker running.
4. Open `/distributed-monitor` in another tab to observe queue and worker events.
5. Open `/study-room` in two browser windows with the same room ID to test P2P chat and media permissions.
#   D r e a m C a n v a s _ v 2  
 