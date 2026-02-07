import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Types
interface Pose {
  x: number;
  y: number;
  yaw: number;
}

interface TaskSuccess {
  maxTimeSec: number;
  maxCollisions: number;
}

interface TaskSpec {
  taskId: string;
  worldId: string;
  seed: number;
  startPose: Pose;
  goalPose: Pose;
  success: TaskSuccess;
}

interface Fault {
  atSec: number;
  type: string;
  durationSec: number;
  severity: number;
  target?: string;
}

interface FaultProfile {
  profileId: string;
  faults: Fault[];
}

interface Event {
  runId: string;
  seq: number;
  t: number;
  type: string;
  payload: Record<string, unknown>;
}

interface Run {
  id: string;
  taskSpec: TaskSpec;
  faultProfile: FaultProfile;
  status: string;
}

export interface RCAResult {
  rootCause: string;
  evidence: Array<{ t: number; seq: number; eventType: string; note: string }>;
  recommendedFix: string[];
  generatedBy: 'gemini' | 'fallback';
}

/**
 * Analyze a simulation run and generate root cause analysis using Gemini
 */
export async function analyzeRunWithGemini(
  run: Run,
  events: Event[]
): Promise<RCAResult> {
  try {
    // Filter relevant events for analysis
    const relevantEvents = events.filter(
      (e) =>
        e.type.startsWith('fault.') ||
        e.type.startsWith('violation.') ||
        e.type === 'run.started' ||
        e.type === 'run.ended'
    );

    if (relevantEvents.length === 0) {
      return fallbackAnalysis(run, events);
    }

    // Build prompt with context
    const taskSpec = run.taskSpec;
    const faultProfile = run.faultProfile;

    const prompt = `You are a robotics simulation expert. Analyze this autonomous robot simulation failure and provide root cause analysis.

TASK:
- Navigate from (${taskSpec.startPose.x}, ${taskSpec.startPose.y}) to (${taskSpec.goalPose.x}, ${taskSpec.goalPose.y})
- Seed: ${taskSpec.seed}
- Max time: ${taskSpec.success.maxTimeSec}s
- Max collisions: ${taskSpec.success.maxCollisions}

INJECTED FAULTS:
${
  faultProfile.faults && faultProfile.faults.length > 0
    ? faultProfile.faults
        .map(
          (f: Fault) =>
            `- ${f.type} at ${f.atSec}s (severity: ${(f.severity * 100).toFixed(0)}%, duration: ${f.durationSec}s)`
        )
        .join('\n')
    : '- None'
}

EVENT TIMELINE:
${relevantEvents.map((e) => `[t=${e.t.toFixed(1)}s, seq=${e.seq}] ${e.type}: ${JSON.stringify(e.payload)}`).join('\n')}

ANALYSIS REQUIRED:
1. Root Cause (1-2 sentences): What caused the failure?
2. Evidence (list 2-3 key events by seq number that support this)
3. Fixes (list 2-3 specific changes to prevent this failure)

Format your response as JSON with keys: rootCause (string), evidence (array of {seq, note}), fixes (array of strings).`;

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in Gemini response, using fallback');
      return fallbackAnalysis(run, events);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Map evidence seq numbers to actual events
    const evidenceMap = new Map<
      number,
      { t: number; seq: number; eventType: string }
    >();
    relevantEvents.forEach((e) => {
      evidenceMap.set(e.seq, { t: e.t, seq: e.seq, eventType: e.type });
    });

    const evidence: RCAResult['evidence'] = (parsed.evidence || [])
      .slice(0, 5)
      .map((ev: { t?: number; seq?: number; note?: string }) => {
        const seq = ev.seq ?? 0;
        const eventData = evidenceMap.get(seq);
        return {
          t: ev.t ?? eventData?.t ?? 0,
          seq,
          eventType: eventData?.eventType ?? 'unknown',
          note: ev.note ?? ''
        };
      });

    return {
      rootCause: parsed.rootCause || 'Unknown failure cause',
      evidence,
      recommendedFix: (parsed.fixes || []).slice(0, 3),
      generatedBy: 'gemini'
    };
  } catch (err) {
    console.error('Gemini API error:', err);
    return fallbackAnalysis(run, events);
  }
}

/**
 * Fallback analysis when Gemini is unavailable
 */
function fallbackAnalysis(run: Run, events: Event[]): RCAResult {
  const violations = events.filter((e) => e.type.startsWith('violation.'));
  const faults = events.filter((e) => e.type === 'fault.injected');
  const lastViolation = violations[violations.length - 1];

  let rootCause = 'Simulation ended without reaching goal';
  let evidence: RCAResult['evidence'] = [];
  let recommendedFix: string[] = [];

  if (lastViolation) {
    rootCause = `${lastViolation.payload.reason || 'Collision'} at t=${lastViolation.t}s`;
    evidence = [
      {
        t: lastViolation.t,
        seq: lastViolation.seq,
        eventType: lastViolation.type,
        note: 'Violation occurred'
      }
    ];

    // Add fault info if present
    if (faults.length > 0) {
      const closestFault = faults.reduce((prev, curr) =>
        Math.abs(curr.t - lastViolation.t) < Math.abs(prev.t - lastViolation.t)
          ? curr
          : prev
      );
      evidence.push({
        t: closestFault.t,
        seq: closestFault.seq,
        eventType: closestFault.type,
        note: `${closestFault.payload.faultType} triggered`
      });
    }

    recommendedFix = [
      'Reduce fault severity in profile',
      'Increase planning horizon',
      'Add constraint buffer around obstacles'
    ];
  }

  return {
    rootCause,
    evidence,
    recommendedFix,
    generatedBy: 'fallback'
  };
}
