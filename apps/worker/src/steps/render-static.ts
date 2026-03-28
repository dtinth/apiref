import { execa } from "execa";
import { join } from "node:path";
import { PipelineContext, PipelineStep } from "../pipeline.js";

export const renderStaticStep: PipelineStep = {
  name: "render-static",
  async run(context: PipelineContext) {
    const { logger, tmpDir } = context;

    const docJsonPath = join(tmpDir, "doc.json");
    const outputDir = join(tmpDir, "site");
    const renderLogFile = join(tmpDir, "render.log");

    logger.log(`Rendering TypeDoc JSON to static HTML...`);
    logger.log(`Input: ${docJsonPath}`);
    logger.log(`Output: ${outputDir}`);

    await execa({
      stdout: { file: renderLogFile },
      stderr: { file: renderLogFile },
    })`node_modules/.bin/apiref-render ${docJsonPath} --out ${outputDir}`;

    logger.log(`✓ Static site rendered to ${outputDir}`);
  },
};
