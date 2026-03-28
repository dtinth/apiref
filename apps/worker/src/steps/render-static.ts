import { execa } from "execa";
import { join } from "node:path";
import { PipelineContext, PipelineStep } from "../pipeline.js";

export const renderStaticStep: PipelineStep = {
  name: "render-static",
  async run(context: PipelineContext) {
    const { logger, tmpDir, resolvedPackageName, resolvedVersion } = context;

    const docJsonPath = join(tmpDir, "doc.json");
    const outputDir = join(tmpDir, "site");
    const renderLogFile = join(tmpDir, "render.log");

    logger.log(`Rendering TypeDoc JSON to static HTML...`);
    logger.log(`Input: ${docJsonPath}`);
    logger.log(`Output: ${outputDir}`);

    const versionArg = resolvedVersion ? ["--version", resolvedVersion] : [];
    const baseUrlArg =
      resolvedPackageName && resolvedVersion
        ? ["--base-url", `/package/${resolvedPackageName}/v/${resolvedVersion}/`]
        : [];

    const rendererCliPath = join(import.meta.dirname, "../../../packages/renderer/dist/cli.mjs");

    await execa({
      stdout: { file: renderLogFile },
      stderr: { file: renderLogFile },
    })`node ${rendererCliPath} ${docJsonPath} --out ${outputDir} ${versionArg} ${baseUrlArg}`;

    logger.log(`✓ Static site rendered to ${outputDir}`);
  },
};
