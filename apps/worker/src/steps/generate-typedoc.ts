import { join } from "node:path";
import { PipelineContext, PipelineStep } from "../pipeline.js";
import { generate } from "../generate.js";

export const generateTypedocStep: PipelineStep = {
  name: "generate-typedoc",
  async run(context: PipelineContext) {
    const { logger, packageSpec, tmpDir } = context;

    logger.log(`Generating TypeDoc JSON from ${packageSpec}...`);

    const outFile = join(tmpDir, "doc.json");
    await generate({ packageSpec, outFile });

    logger.log(`TypeDoc JSON written to ${outFile}`);
  },
};
