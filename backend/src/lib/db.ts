import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️  POSTGRES_URL or DATABASE_URL not set. Database connections will fail.');
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
    ? false
    : { rejectUnauthorized: false }, // Required for Vercel Postgres/Neon in production and dev
});

// Helper function to execute queries
export const query = (text: string, params?: any[]) => pool.query(text, params);
