import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const sourceFiles = [...walk(path.join(root, "src")), ...walk(path.join(root, "prisma"))].map((file) => ({
  file: path.relative(root, file),
  text: readFileSync(file, "utf8"),
}));

const isServerActionFile = (text: string) => /^\s*["']use server["']/.test(text);
const isRouteHandler = (file: string) => /(^|\/)route\.ts$/.test(file);

/** Mock sign-in has no actor yet; it is gated by isMockAuthEnabled() instead. See AGENTS.md. */
const UNAUTHENTICATED_ACTION_ALLOWLIST = new Set(["src/platform/auth/actions.ts"]);

describe("repo conventions", () => {
  it("never updates or deletes AuditEvent rows", () => {
    const offenders = sourceFiles
      .filter(({ file }) => file !== "src/platform/db.ts")
      .filter(({ text }) => /auditEvent\.(update|updateMany|upsert|delete|deleteMany)\b/.test(text) || /(UPDATE|DELETE\s+FROM)\s+"?AuditEvent/i.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("every exported server action and route handler calls requirePermission()", () => {
    const offenders: string[] = [];
    for (const { file, text } of sourceFiles) {
      if (UNAUTHENTICATED_ACTION_ALLOWLIST.has(file)) continue;
      const chunks = isServerActionFile(text) || isRouteHandler(file) ? text.split(/export\s+async\s+function\s+/).slice(1) : [];
      for (const chunk of chunks) {
        if (!/\b(requirePermission|revealPII)\(/.test(chunk)) offenders.push(`${file}: ${chunk.split("(")[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only server actions and route handlers write to the database", () => {
    const write = /\b(db|tx)\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw/;
    const offenders = sourceFiles
      .filter(({ file }) => file.startsWith("src/"))
      .filter(({ file, text }) => !isServerActionFile(text) && !isRouteHandler(file))
      .filter(({ text }) => write.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("seed data contains no SSN-shaped values and only example.com emails", () => {
    for (const { file, text } of sourceFiles.filter(({ file }) => file.startsWith("prisma/seed"))) {
      expect(text, file).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
      for (const email of text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []) expect(email, file).toMatch(/@example\.com$/);
    }
  });
});
