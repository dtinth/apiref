import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export interface Logger {
  log(message: string): void;
  getLogPath(): string;
}

export function createLogger(packageSpec: string): { logger: Logger; tmpDir: string } {
  // Sanitize package name for filename (e.g., @scope/name -> scope-name)
  const sanitized = packageSpec.replace(/[@/]/g, "-").replace(/\s+/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const runId = `${sanitized}-${timestamp}`;
  const logFileName = `apiref-publish-${runId}.log`;
  const baseDir = join(tmpdir(), `apiref-publish-${runId}`);
  const logPath = join(baseDir, logFileName);

  // Ensure directories exist
  mkdirSync(baseDir, { recursive: true });
  mkdirSync(dirname(logPath), { recursive: true });

  // Write header
  appendFileSync(
    logPath,
    `apiref-worker publish ${packageSpec}\n` +
      `Started: ${new Date().toISOString()}\n` +
      `Work dir: ${baseDir}\n` +
      `Log: ${logPath}\n` +
      `\n`,
  );

  const logger: Logger = {
    log(message: string) {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      appendFileSync(logPath, logEntry);
      console.log(message);
    },
    getLogPath() {
      return logPath;
    },
  };

  return { logger, tmpDir: baseDir };
}
