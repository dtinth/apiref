import { join } from "node:path";
import { PipelineContext, PipelineStep } from "../pipeline.js";

export const renderStaticStep: PipelineStep = {
  name: "render-static",
  async run(context: PipelineContext) {
    const { logger, tmpDir } = context;

    const docJson = join(tmpDir, "doc.json");
    const outputDir = join(tmpDir, "site");

    logger.log(`Rendering TypeDoc JSON to static HTML...`);
    logger.log(`Input: ${docJson}`);
    logger.log(`Output: ${outputDir}`);

    // TODO: Implement rendering using @apiref/renderer

    throw new Error("render-static not yet implemented");
  },
};
