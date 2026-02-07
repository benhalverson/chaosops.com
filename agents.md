# agents.md — ChaosOps (Angular + Unity)

## Project
**Name:** ChaosOps  
**One-liner:** Deterministic simulation runner + fault injection + black-box recorder with “Why did it fail?” analysis.  
**Primary hackathon track:** Track 2 (Sim-to-Real Training & Evaluation Pipelines)

### Hard requirements (do not violate)
- **Vultr VM is the central system of record + control plane** (runs API, DB, orchestrator, stores runs/events).
- **Public web app** (Angular) with clear user flows.
- **Simulation-first** (Unity), controllable from Vultr backend.
- Demo must show: **TaskSpec → run → inject faults → fail → replay → explanation → rerun**.

---

## Stack
- **Frontend:** Angular (standalone components OK), WebSocket + REST
- **Simulator:** Unity WebGL (runs in browser, built from your PC)
- **Backend (Vultr):** Node.js (TypeScript) API + orchestrator
- **DB:** Postgres (JSONB for events), optional object storage for artifacts (not required)
- **AI/RCA:** Google Gemini API (`@google/generative-ai` SDK)

**Architecture:** Unity WebGL embedded in Angular app, connects to backend via WebSocket. Backend calls Gemini API for RCA analysis. No server-side Unity needed.

---

## Deliverables (Definition of Done)
1. **Public URL**: Angular app accessible in browser.
2. **Backend on Vultr VM**: REST + WebSocket live stream.
3. **Unity simulation**:
   - deterministic seeded runs
   - emits telemetry events to backend
   - supports fault injection from config
4. **Black-box recorder**:
   - event stream persisted
   - replay from stored events
5. **RCA (“Why did it fail?”)**:
   - produces human-readable explanation using run evidence (timestamps + event IDs)
6. **Demo script**: 90 seconds, shows before/after with the same seed.

---

## Repo layout (recommended)
/
agents.md
README.md
docker-compose.yml
/apps
/web # Angular
/api # TS backend (REST+WS, orchestrator)
/sim
/unity # Unity project
/specs
task-spec.schema.json
fault-profile.schema.json
event.schema.json
/scripts
deploy-vultr.sh (optional)


---

## Product scope (MVP only)
### Worlds
- Single “2D-ish” top-down environment rendered by Unity (simple corridors + obstacles).
- One robot (AMR) navigating start→goal using a simple controller.

### Faults (implement 2–3)
- `sensor_dropout` (e.g., “lidar unavailable”)
- `latency_spike` (delay control loop / observation updates)
- `wheel_slip` (reduce effective velocity / add noise)

### Failure conditions
- timeout
- collision
- constraint violation (enter no-go zone)

### UI (Angular, 4 views max)
1) Runs list (status, pass/fail, KPIs)  
2) Create run (TaskSpec + FaultProfile + seed)  
3) Replay (timeline scrub + map + event inspector)  
4) RCA (explanation + evidence links + “rerun”)

---

## Core contracts (do not change without updating schemas)

### TaskSpec (minimal)
Fields (MVP):
- `taskId: string`
- `worldId: string`
- `seed: number`
- `startPose: {x,y,yaw}`
- `goalPose: {x,y,yaw}`
- `constraints: { noGoZones?: polygon[] }`
- `success: { maxTimeSec, maxCollisions }`

### FaultProfile (minimal)
- `profileId: string`
- `faults: Array<{ atSec, type, durationSec, severity, target?: string }>`

### Event envelope (append-only)
All events emitted by Unity and stored by backend use this envelope:
- `runId: string`
- `seq: number` (monotonic)
- `t: number` (seconds since start, float)
- `type: string`
- `payload: object`

Minimum event types:
- `run.started`
- `state.pose` (x,y,yaw,v)
- `planner.candidates` (optional; keep small)
- `decision.chosen` (optional)
- `fault.injected` (type + params)
- `violation.*` (collision, no_go_zone, timeout)
- `run.ended` (status, summary KPIs)

**Important:** Keep payload sizes small. Prefer summaries over raw sensor dumps.

---

## Vultr deployment assumptions
- Single VM with Docker Compose
- Ports:
  - 443: Nginx → Angular static (includes Unity WebGL) + API reverse proxy + WS
  - 5432 internal: Postgres
- Services:
  - `api` (REST+WS)
  - `db` (Postgres)
  - `web` (Angular + Unity WebGL build served via Nginx)

**Unity runs client-side in browser** - no server-side Unity execution needed.

---

# Agents (roles + exact responsibilities)

## Agent 0 — Project Owner (scope police)
**Goal:** Ship the smallest demo that wins.  
**Responsibilities:**
- Freeze MVP scope by end of Day 1.
- Ensure every feature supports the demo script.
- Enforce “no rabbit holes” (no fancy perception, no huge physics).

**Acceptance criteria**
- A written “Golden Path Demo” checklist exists and is used daily.
- Any feature not on the checklist is deferred.

---

## Agent 1 — Backend/API Agent (Vultr control plane)
**Goal:** Central system of record + orchestration.
**Build**
- REST endpoints:
  - `POST /runs` (create run from TaskSpec + FaultProfile)
  - `POST /runs/{id}/start`
  - `POST /runs/{id}/stop`
  - `GET /runs` (list)
  - `GET /runs/{id}` (details + KPIs)
  - `GET /runs/{id}/events` (paged)
- WebSocket:
  - `/ws` for live events and run status updates
- Persistence:
  - Postgres tables: `runs`, `events`, `artifacts` (optional)

**Constraints**
- Must be robust to Unity disconnects.
- Must support deterministic replay (events are source of truth).

**Definition of done**
- Create run → start → receives events → ends → replay events via API.

---

## Agent 2 — Unity Simulation Agent (deterministic runner + telemetry)
**Goal:** Unity produces deterministic runs and streams events.
**Build**
- Headless run mode:
  - reads config (TaskSpec + FaultProfile + runId + endpoint URL)
  - sets deterministic seed:
    - `Random.InitState(seed)`
    - fixed timestep: `Time.fixedDeltaTime` locked
- Robot controller:
  - simple nav (A* on grid OR waypoint-following)
  - emits pose at fixed rate (e.g., 10 Hz)
- Fault injection system:
  - scheduler triggers faults by sim time
  - faults modify controller/observations/physics consistently

**Telemetry**
- POST/WS to backend:
  - `run.started`
  - regular `state.pose`
  - `fault.injected`
  - `violation.*`
  - `run.ended`

**Definition of done**
- A single CLI launch (from Vultr runner or local) produces a complete run with events stored in DB.

---

## Agent 3 — Angular Frontend Agent (product UX)
**Goal:** Minimal product UX that makes judges instantly “get it.”
**Build**
- Runs list: status, KPIs, pass/fail badges
- Create run: editors (JSON/YAML textarea OK) + validate
- Unity WebGL embed:
  - `<iframe>` or Unity loader in Angular component
  - Pass TaskSpec+FaultProfile to Unity via JavaScript bridge
  - Show loading progress (Unity takes 5-30s to load)
- Replay:
  - timeline scrubber (seq or time)
  - top-down path visualization (canvas/SVG)
  - event inspector panel
- RCA view:
  - show failure point (auto-jump to first `violation.*`)
  - display explanation + evidence links (event seq + timestamps)
  - "rerun with same seed" button

**Constraints**
- Unity WebGL provides the 3D/2D visualization - Angular just embeds it
- Must work on mobile-ish widths (basic responsiveness).
- Unity build must be <50MB (WebGL loading time)

**Definition of done**
- A judge can create a run, watch Unity sim in browser, replay it, and read RCA.

**Angular↔Unity Communication:**
- Angular: `window.unityInstance.SendMessage(objectName, methodName, jsonString)`
- Unity: `Application.ExternalCall("angularFunction", jsonString)` (WebGL only)

---

## Agent 4 — Chaos/RCA Agent (analysis layer)
**Goal:** Produce credible “why it failed” with evidence.
**Approach: Gemini-powered AI analysis**
- Use Google Gemini API to analyze event streams
- Feed filtered events (fault injections, violations, key state changes) to Gemini
- Prompt engineering:
  - "You are a robotics debugging expert. Analyze this simulation failure."
  - Include: TaskSpec, FaultProfile, event timeline, final violation
  - Request: root cause, evidence references (by seq/t), recommended fixes
- Parse structured response from Gemini's natural language output

**Implementation (TypeScript + Gemini SDK)**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

async function analyzeWithGemini(run: Run, events: Event[]) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const relevantEvents = events.filter(e => 
    e.type.startsWith('fault.') || 
    e.type.startsWith('violation.') ||
    e.type === 'run.started' ||
    e.type === 'run.ended'
  );
  
  const prompt = `Analyze this autonomous robot simulation failure:

Task: Navigate from ${run.taskSpec.startPose} to ${run.taskSpec.goalPose}
Faults Injected: ${JSON.stringify(run.faultProfile.faults)}

Event Timeline:
${relevantEvents.map(e => `[t=${e.t}s, seq=${e.seq}] ${e.type}: ${JSON.stringify(e.payload)}`).join('\n')}

Provide:
1. Root Cause (one sentence)
2. Evidence (reference specific events by seq number)
3. Recommended Fix (specific config changes)

Format as JSON.`;
  
  const result = await model.generateContent(prompt);
  return parseRCAFromGemini(result.response.text());
}
```

**Fallback strategy:**
- If Gemini API fails, use simple rule-based fallback (detect collision, timeout, etc.)
- Cache Gemini responses to avoid repeated API calls for same failure pattern

**Output format**
- `rootCause`: string (Gemini-generated)
- `evidence`: array of `{t, seq, eventType, note}` (extracted from Gemini response)
- `recommendedFix`: array of strings (Gemini-suggested)
- `generatedBy`: "gemini" | "fallback"

**Definition of done**
- Gemini produces convincing explanations for at least 2 failure scenarios
- API integration handles errors gracefully (retry + fallback)
- Response parsing extracts structured data from natural language

---

## Agent 5 — Demo/Packaging Agent (win condition)
**Goal:** Make the final submission impossible to misunderstand.
**Build**
- Seeded scenarios:
  - `baseline_ok` passes
  - `faults_fail` fails predictably
  - `fix_ok` passes again
- README:
  - one-command local run
  - architecture diagram (simple)
  - API endpoints list
- Demo script:
  - exactly what to click + what to say + expected outcomes

**Definition of done**
- Someone else can follow README and reproduce the demo in <15 minutes.

---

# Non-goals (explicit)
- No SLAM, no advanced perception pipelines.
- No training large models (Vultr GPUs not available).
- No full ROS2 stack unless already prebuilt and proven (too risky).
- No server-side Unity execution (WebGL runs client-side only).
- No native desktop Unity builds for judges (WebGL is cross-platform).
- No native desktop Unity builds for judges (WebGL is cross-platform).

---

# 8-day execution plan (solo-dev realistic)
**Day 1:** Vultr VM provision + deploy Docker Compose (API+DB+Nginx) + verify public access + domain/SSL  
**Day 2:** Event schema + WS ingest + runs CRUD + DB tables + API deployed and tested  
**Day 3:** Unity WebGL build pipeline + deterministic seed + simple 2D world + test in browser  
**Day 4:** Unity→backend WebSocket connection + emit events + TaskSpec parsing  
**Day 5:** Fault injection (2 faults) + violation events + success/fail logic  
**Day 6:** Angular runs list + create run form + Unity WebGL embed (end-to-end demo works)  
**Day 7:** Angular replay timeline + map rendering + event inspector + RCA view skeleton  
**Day 8:** Gemini API integration + RCA prompt tuning + polish + demo video + README

**Critical:** Infrastructure goes live Day 1. Core demo (create→run→replay) works by Day 7. Gemini polish on Day 8.

---

# Golden Path Demo (must work every time)
1) Create run with `baseline_ok` → pass  
2) Create run with `faults_fail` → fail (visible violation)  
3) Replay + jump to violation → see fault timings + behavior changes  
4) RCA generates explanation with evidence  
5) Apply recommended “fix” (config change) → rerun same seed → pass  
6) Show A/B KPIs

---

# Quality gates (minimum)
- Runs have deterministic results for a given seed + profile.
- Every run ends with `run.ended` even on failure.
- Replay never depends on Unity being online (events are enough).
- Demo uses only “happy path” UI flows (no terminal needed during judging).

---