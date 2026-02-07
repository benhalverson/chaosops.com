import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg'
  }),
  emailAndPassword: {
    enabled: true
  },
  secret: process.env.BETTER_AUTH_SECRET || 'dev_secret_min_32_chars_change',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000'
});

export type AuthSession = typeof auth.$Infer.Session;
