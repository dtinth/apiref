import { Logger } from "./logger.js";

export interface PipelineContext {
  packageSpec: string;
  logger: Logger;
  tmpDir: string;
}

export interface PipelineStep {
  name: string;
  run(context: PipelineContext): Promise<void>;
}

export interface PipelineResult {
  success: boolean;
  failedStep?: string;
  error?: string;
  logPath: string;
}

export async function runPipeline(
  context: PipelineContext,
  steps: PipelineStep[],
): Promise<PipelineResult> {
  const { logger, packageSpec } = context;

  logger.log(`Starting publish pipeline for ${packageSpec}`);
  logger.log(`Running ${steps.length} steps: ${steps.map((s) => s.name).join(" → ")}`);
  logger.log("");

  for (const step of steps) {
    try {
      logger.log(`[${step.name}] Starting...`);
      await step.run(context);
      logger.log(`[${step.name}] ✓ Success`);
      logger.log("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.log(`[${step.name}] ✗ Failed: ${errorMessage}`);
      logger.log("");

      return {
        success: false,
        failedStep: step.name,
        error: errorMessage,
        logPath: logger.getLogPath(),
      };
    }
  }

  logger.log(`✓ Pipeline completed successfully`);
  return {
    success: true,
    logPath: logger.getLogPath(),
  };
}
