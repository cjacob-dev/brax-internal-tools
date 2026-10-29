import { PrismaClient } from "@prisma/client";

export class AuditImmutableError extends Error {
  constructor(operation: string) {
    super(`AuditEvent is append-only: ${operation} is not allowed`);
    this.name = "AuditImmutableError";
  }
}

function blocked(operation: string) {
  return () => {
    throw new AuditImmutableError(operation);
  };
}

function createClient() {
  return new PrismaClient().$extends({
    query: {
      auditEvent: {
        update: blocked("update"),
        updateMany: blocked("updateMany"),
        upsert: blocked("upsert"),
        delete: blocked("delete"),
        deleteMany: blocked("deleteMany"),
      },
    },
  });
}

export type Db = ReturnType<typeof createClient>;

const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
