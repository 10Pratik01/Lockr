// lib/prisma.ts
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// allow global var in Node for dev hot reloads
declare global {
  var db: PrismaClient | undefined;
  var pool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create a connection pool with extended timeout settings for Neon
const pool = global.pool ?? new Pool({ 
  connectionString,
  connectionTimeoutMillis: 180000, // 3 minutes for Neon wake-up (increased)
  idleTimeoutMillis: 60000, // 1 minute idle timeout (increased)
  max: 5, // Reduced max connections for Neon free tier
  statement_timeout: 120000, // 2 minutes for query execution (increased)
  query_timeout: 120000, // 2 minutes query timeout
  keepAlive: true, // Keep connections alive
  keepAliveInitialDelayMillis: 10000, // 10 seconds
});

// Add error handler to prevent unhandled pool errors
pool.on('error', (err: Error) => {
  console.error('Unexpected pool error:', err);
});

if (process.env.NODE_ENV !== "production") {
  global.pool = pool;
}

const createClient = () => new PrismaClient({
  adapter: new PrismaPg(pool),

});

export const db =
  global.db ??
  createClient();

if (process.env.NODE_ENV !== "production") {
  global.db = db;
}