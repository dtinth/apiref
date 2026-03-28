import { Command } from "commander";
import { generate } from "./generate.js";
import { createLogger } from "./logger.js";
import { runPipeline, type PipelineContext } from "./pipeline.js";
import { verifyProvenanceStep } from "./steps/verify-provenance.js";
import { generateTypedocStep } from "./steps/generate-typedoc.js";
import { renderStaticStep } from "./steps/render-static.js";
import { uploadStorageStep } from "./steps/upload-storage.js";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("apiref-worker")
    .description("TypeDoc generation and publishing worker for apiref")
    .version("0.0.0");

  program
    .command("generate <package-spec>")
    .description("Generate TypeDoc JSON from an npm package")
    .option("--out <file>", "Output file path", "typedoc.json")
    .action(async (packageSpec: string, options: { out: string }) => {
      try {
        await generate({ packageSpec, outFile: options.out });
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  program
    .command("publish <package-spec>")
    .description("Publish a package: verify provenance, generate docs, render static site, upload")
    .action(async (packageSpec: string) => {
      const { logger, tmpDir } = createLogger(packageSpec);

      const context: PipelineContext = {
        packageSpec,
        logger,
        tmpDir,
      };

      const steps = [
        verifyProvenanceStep,
        generateTypedocStep,
        renderStaticStep,
        uploadStorageStep,
      ];

      const result = await runPipeline(context, steps);

      if (result.success) {
        console.log(`✅ Publish successful for ${packageSpec}`);
        console.log(`Log: ${result.logPath}`);
        console.log(`Work dir: ${tmpDir}`);
      } else {
        console.error(`❌ Publish failed: ${result.failedStep}`);
        console.error(`   ${result.error}`);
        console.error(``);
        console.error(`Full log: ${result.logPath}`);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

void main();
