import { pgTable, text, integer, real, jsonb, serial, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Users table (managed by better-auth)
export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified').notNull().default(0),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().default(sql`now()`),
  updatedAt: timestamp('updatedAt').notNull().default(sql`now()`)
});

export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
});

export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  expiresAt: timestamp('expiresAt'),
  password: text('password')
});

export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull()
});

// ChaosOps tables

export const runs = pgTable('runs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  taskSpec: jsonb('task_spec').notNull().$type<{
    taskId: string;
    worldId: string;
    seed: number;
    startPose: { x: number; y: number; yaw: number };
    goalPose: { x: number; y: number; yaw: number };
    constraints?: { noGoZones?: Array<Array<{ x: number; y: number }>> };
    success: { maxTimeSec: number; maxCollisions: number };
  }>(),
  faultProfile: jsonb('fault_profile').notNull().$type<{
    profileId: string;
    faults: Array<{
      atSec: number;
      type: string;
      durationSec: number;
      severity: number;
      target?: string;
    }>;
  }>(),
  status: text('status').notNull().default('pending'),
  result: text('result'),
  kpis: jsonb('kpis').$type<{
    distanceTraveled?: number;
    timeToGoal?: number;
    violationCount?: number;
    collisions?: number;
  }>(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at').notNull().default(sql`now()`)
});

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  t: real('t').notNull(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().default(sql`now()`)
});

export const rcaAnalysis = pgTable('rca_analysis', {
  id: serial('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => runs.id, { onDelete: 'cascade' })
    .unique(),
  rootCause: text('root_cause').notNull(),
  evidence: jsonb('evidence').notNull().$type<Array<{
    t: number;
    seq: number;
    eventType: string;
    note: string;
  }>>(),
  recommendedFix: jsonb('recommended_fix').notNull().$type<string[]>(),
  generatedBy: text('generated_by').notNull().default('fallback'),
  createdAt: timestamp('created_at').notNull().default(sql`now()`)
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type RCAAnalysis = typeof rcaAnalysis.$inferSelect;
export type NewRCAAnalysis = typeof rcaAnalysis.$inferInsert;
