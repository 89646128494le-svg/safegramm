import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

// Provide DATABASE_PROVIDER for prisma (sqlite/postgresql)
if (!process.env.DATABASE_PROVIDER) {
  if ((process.env.DATABASE_URL || '').startsWith('postgres')) {
    process.env.DATABASE_PROVIDER = 'postgresql';
  } else {
    process.env.DATABASE_PROVIDER = 'sqlite';
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'file:./dev.db';
    }
  }
}

export const prisma = new PrismaClient();
