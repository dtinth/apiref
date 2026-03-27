import { execa } from "execa";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
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

    // Install the package
    console.log(`📦 Installing ${packageSpec}...`);
    await execa("pnpm", ["add", "--ignore-scripts", packageSpec], {
      cwd: tempDir,
      stdio: "inherit",
    });

    // Extract package name from packageSpec (e.g., "elysia@1.4.28" -> "elysia")
    const packageName = packageSpec.split("@")[0] || packageSpec;

    // Run typedoc to generate JSON
    console.log(`📄 Generating TypeDoc JSON...`);
    const docFile = join(tempDir, "doc.json");
    const entryPoints = join(tempDir, "node_modules", packageName, "dist", "index.d.ts");

    await execa(
      "pnpm",
      [
        "dlx",
        "typedoc",
        "--entryPoints",
        entryPoints,
        "--json",
        docFile,
        "--name",
        packageName,
        "--skipErrorChecking",
      ],
      {
        cwd: tempDir,
        stdio: "inherit",
      },
    );

    // Read the generated JSON
    const typedocJson = await readFile(docFile, "utf-8");

    // Write output file
    const outputPath = resolve(outFile);
    await writeFile(outputPath, typedocJson, "utf-8");
    console.log(`✅ Generated: ${outputPath}`);

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
