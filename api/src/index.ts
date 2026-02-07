import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Scalar } from '@scalar/hono-api-reference';
import { eq } from 'drizzle-orm';
import { auth } from './auth.js';
import { db, schema } from './db/index.js';
import { listRunsDoc, createRunDoc, getRunDoc, startRunDoc, stopRunDoc } from './docs/runs-docs.js';
import { listEventsDoc, recordEventsDoc } from './docs/events-docs.js';
import { schemas } from './docs/schemas.js';
import { analyzeRunWithGemini } from './services/gemini.js';

type EventInput = {
  seq: number;
  t: number;
  type: string;
  payload: Record<string, unknown>;
};

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4200', 'http://localhost'],
  credentials: true
}));

// OpenAPI spec - modular, maintainable docs
const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'ChaosOps API',
    version: '1.0.0',
    description: 'Deterministic simulation runner with fault injection and RCA analysis',
    contact: {
      name: 'ChaosOps',
      url: 'http://localhost:4200'
    }
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
    { url: '/api', description: 'API root' }
  ],
  paths: {
    'api/runs': {
      get: listRunsDoc,
      post: createRunDoc
    },
    'api/runs/{id}': {
      get: getRunDoc
    },
    'api/runs/{id}/start': {
      post: startRunDoc
    },
    'api/runs/{id}/stop': {
      post: stopRunDoc
    },
    'api/runs/{id}/events': {
      get: listEventsDoc,
      post: recordEventsDoc
    }
  },
  components: {
    schemas
  }
};

// Scalar API Reference endpoint
app.get('/docs', Scalar({ url: '/api-docs.json' }));
app.get('/api-docs.json', (c) => c.json(openAPISpec));

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'ChaosOps API' });
});

// Better Auth routes
app.on(['POST', 'GET'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw);
});

// Runs endpoints
app.get('/api/runs', async (c) => {
  const runs = await db.select().from(schema.runs);
  return c.json(runs);
});

app.post('/api/runs', async (c) => {
  const body = await c.req.json();
  const newRuns = await db.insert(schema.runs).values({
    id: crypto.randomUUID(),
    taskSpec: body.taskSpec,
    faultProfile: body.faultProfile,
    status: 'pending'
  }).returning();
  const newRun = newRuns[0];
  return c.json(newRun, 201);
});

app.get('/api/runs/:id', async (c) => {
  const id = c.req.param('id');
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  if (!run) return c.json({ error: 'Run not found' }, 404);
  return c.json(run);
});

// Mock simulation runner
async function runMockSimulation(runId: string, run: any) {
  try {
    const taskSpec = run.taskSpec;
    const faultProfile = run.faultProfile;
    const maxTime = taskSpec.success.maxTimeSec || 60;
    const goal = taskSpec.goalPose;
    
    let eventSeq = 0;
    const eventInserts: any[] = [];

    // run.started event
    eventInserts.push({
      runId,
      seq: eventSeq++,
      t: 0,
      type: 'run.started',
      payload: { taskId: taskSpec.taskId, seed: taskSpec.seed }
    });

    // Simulate path from start to goal with periodic pose updates (every 1 second)
    let currentPose = { x: taskSpec.startPose.x, y: taskSpec.startPose.y, yaw: taskSpec.startPose.yaw };
    const deltaX = (goal.x - currentPose.x) / maxTime;
    const deltaY = (goal.y - currentPose.y) / maxTime;
    const stateUpdateInterval = 1; // emit state every 1 second

    for (let t = stateUpdateInterval; t <= maxTime; t += stateUpdateInterval) {
      // Update pose towards goal
      currentPose.x = taskSpec.startPose.x + deltaX * t;
      currentPose.y = taskSpec.startPose.y + deltaY * t;
      
      eventInserts.push({
        runId,
        seq: eventSeq++,
        t,
        type: 'state.pose',
        payload: { 
          x: parseFloat(currentPose.x.toFixed(2)), 
          y: parseFloat(currentPose.y.toFixed(2)), 
          yaw: currentPose.yaw, 
          v: 0.5 
        }
      });

      // Inject faults at specified times
      for (const fault of faultProfile.faults || []) {
        if (Math.abs(t - fault.atSec) < stateUpdateInterval) {
          eventInserts.push({
            runId,
            seq: eventSeq++,
            t: parseFloat(fault.atSec.toFixed(1)),
            type: 'fault.injected',
            payload: { 
              faultType: fault.type, 
              severity: fault.severity, 
              durationSec: fault.durationSec 
            }
          });
        }
      }
    }

    // Randomly decide success/failure for demo
    const failureChance = faultProfile.faults && faultProfile.faults.length > 0 ? 0.6 : 0.1;
    const failed = Math.random() < failureChance;

    if (failed) {
      // Add violation event
      eventInserts.push({
        runId,
        seq: eventSeq++,
        t: maxTime * 0.8 + Math.random() * maxTime * 0.2,
        type: 'violation.collision',
        payload: { 
          reason: 'Fault-induced obstacle collision', 
          location: { x: currentPose.x, y: currentPose.y } 
        }
      });
    }

    // run.ended event
    eventInserts.push({
      runId,
      seq: eventSeq++,
      t: maxTime,
      type: 'run.ended',
      payload: { 
        status: failed ? 'failed' : 'completed', 
        reason: failed ? 'violation.collision' : 'reached_goal',
        totalTime: maxTime,
        distToGoal: failed ? 
          Math.sqrt(Math.pow(goal.x - currentPose.x, 2) + Math.pow(goal.y - currentPose.y, 2)) : 
          0
      }
    });

    // Insert all events in batches
    if (eventInserts.length > 0) {
      await db.insert(schema.events).values(eventInserts);
    }

    // Update run status
    await db.update(schema.runs)
      .set({ 
        status: failed ? 'failed' : 'completed', 
        endedAt: new Date()
      })
      .where(eq(schema.runs.id, runId));

    console.log(`✅ Simulation completed for run ${runId}: ${failed ? 'FAILED' : 'SUCCESS'}`);
  } catch (err) {
    console.error(`❌ Simulation error for run ${runId}:`, err);
    await db.update(schema.runs)
      .set({ status: 'failed', endedAt: new Date() })
      .where(eq(schema.runs.id, runId));
  }
}

app.post('/api/runs/:id/start', async (c) => {
  const id = c.req.param('id');
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  
  if (!run) return c.json({ error: 'Run not found' }, 404);

  // Update status immediately
  const [updated] = await db.update(schema.runs)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(schema.runs.id, id))
    .returning();

  // Start mock simulation in background (non-blocking)
  runMockSimulation(id, run).catch(err => console.error('Background sim error:', err));

  return c.json(updated);
});

app.post('/api/runs/:id/stop', async (c) => {
  const id = c.req.param('id');
  const [run] = await db.update(schema.runs)
    .set({ status: 'completed', endedAt: new Date() })
    .where(eq(schema.runs.id, id))
    .returning();
  if (!run) return c.json({ error: 'Run not found' }, 404);
  return c.json(run);
});

// Events endpoints
app.get('/api/runs/:id/events', async (c) => {
  const id = c.req.param('id');
  const events = await db.select().from(schema.events).where(eq(schema.events.runId, id));
  return c.json(events);
});

app.post('/api/runs/:id/events', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  console.log('[Events] Received request body:', JSON.stringify(body, null, 2));
  
  // Support both batch format { items: [...] } and direct array
  let eventsToInsert: EventInput[] = [];
  if (Array.isArray(body)) {
    eventsToInsert = body;
  } else if (body.items && Array.isArray(body.items)) {
    eventsToInsert = body.items;
  } else {
    eventsToInsert = [body];
  }

  console.log('[Events] Events to insert:', JSON.stringify(eventsToInsert, null, 2));

  if (eventsToInsert.length === 0) {
    return c.json({ error: 'No events to insert' }, 400);
  }

  const inserted = await db.insert(schema.events).values(
    eventsToInsert.map((event: EventInput) => {
      console.log('[Events] Processing event:', event);
      return {
        runId: id,
        seq: event.seq,
        t: event.t,
        type: event.type,
        payload: event.payload
      };
    })
  ).returning();
  
  console.log('[Events] Inserted:', inserted);
  
  // Check if run.ended event and update run status
  const hasRunEnded = eventsToInsert.some((e: EventInput) => e.type === 'run.ended');
  if (hasRunEnded) {
    const endEvent = eventsToInsert.find((e: EventInput) => e.type === 'run.ended');
    const payload: Record<string, unknown> = endEvent?.payload 
      ? (typeof endEvent.payload === 'string' ? JSON.parse(endEvent.payload) : endEvent.payload)
      : {};
    
    await db.update(schema.runs)
      .set({
        status: 'completed',
        result: payload.result as string | undefined,
        kpis: payload as any,
        endedAt: new Date()
      })
      .where(eq(schema.runs.id, id));
    
    console.log('[Events] Run completed, status updated');
  }
  
  return c.json(inserted, 201);
});

// RCA Analysis endpoint
app.post('/api/runs/:id/analyze', async (c) => {
  const id = c.req.param('id');
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, id));
  
  if (!run) return c.json({ error: 'Run not found' }, 404);
  
  // Get all events for this run
  const events = await db.select().from(schema.events).where(eq(schema.events.runId, id));
  
  // Analyze with Gemini
  const analysis = await analyzeRunWithGemini(run, events);
  
  return c.json(analysis);
});

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`🚀 ChaosOps API running on http://localhost:${info.port}`);
  console.log(`📊 Database: ${process.env.DATABASE_URL || './data/chaosops.db'}`);
});

