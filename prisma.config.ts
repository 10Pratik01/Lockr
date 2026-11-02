import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // `prisma generate` never connects, so a missing URL (e.g. a CI build) must not abort it.
    // migrate/deploy still fail loudly on the placeholder rather than touching a wrong DB.
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
});
