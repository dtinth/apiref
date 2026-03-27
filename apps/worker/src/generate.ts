import { execa } from "execa";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

export interface GenerateOptions {
  packageSpec: string;
  outFile?: string;
}

export async function generate(options: GenerateOptions): Promise<string> {
  const { packageSpec, outFile = "typedoc.json" } = options;

  // Create a temporary directory for installation
  const tempDir = resolve(
    tmpdir(),
    `apiref-generate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  try {
    await mkdir(tempDir, { recursive: true });

    // Install the package using pnpm
    console.log(`📦 Installing ${packageSpec}...`);
    await execa("pnpm", ["add", "--ignore-scripts", packageSpec], {
      cwd: tempDir,
      stdio: "inherit",
    });

    // Run typedoc to generate JSON
    console.log(`📄 Generating TypeDoc JSON...`);
    const result = await execa("pnpm", ["exec", "typedoc", "--json", "-"], {
      cwd: tempDir,
      stdio: ["pipe", "pipe", "inherit"],
    });

    const typedocJson = result.stdout;

    // Write output file
    await writeFile(outFile, typedocJson, "utf-8");
    console.log(`✅ Generated: ${outFile}`);

    return typedocJson;
  } finally {
    // Cleanup temp directory
    try {
      await execa("rm", ["-rf", tempDir]);
    } catch {
      console.warn(`⚠️  Failed to cleanup temp directory: ${tempDir}`);
    }
  }
}
