import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-5'),
  VOYAGE_API_KEY: z.string().optional().default(''),
  VOYAGE_MODEL: z.string().default('voyage-3'),
  RAG_TOP_K: z.coerce.number().default(6),
  RAG_MIN_SCORE: z.coerce.number().default(0.3),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(20),
});

export const config = Env.parse(process.env);
export const EMBED_DIM = 1024;
