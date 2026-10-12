import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

/** Drops and recreates the public schema, then applies db/schema.sql. DEV ONLY. */
const here = path.dirname(fileURLToPath(import.meta.url));
const sql = await readFile(path.resolve(here, '../../db/schema.sql'), 'utf8');
await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
await pool.query(sql);
console.log('Schema applied.');
await pool.end();
