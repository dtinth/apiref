import { Command } from "commander";
import { generate } from "./generate.js";

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

  await program.parseAsync();
}

void main();
