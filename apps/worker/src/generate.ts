import { execa } from "execa";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export interface GenerateOptions {
  packageSpec: string;
  outFile?: string;
}

async function findEntryPoints(packageDir: string, packageName: string): Promise<string[]> {
  try {
    const packageJsonPath = join(packageDir, "node_modules", packageName, "package.json");
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    const exports = packageJson.exports || {};
    const entryPoints: string[] = [];

    for (const [key, value] of Object.entries(exports)) {
      // Skip package.json and wildcard exports
      if (key === "./package.json" || key.includes("*")) {
        continue;
      }

      // value can be string or object with types/import/require
      let types: string | undefined;
      if (typeof value === "string") {
        types = value;
      } else if (typeof value === "object" && value !== null) {
        types = (value as Record<string, unknown>).types as string | undefined;
      }

      if (types) {
        const entryPoint = join(packageDir, "node_modules", packageName, types);
        entryPoints.push(entryPoint);
      }
    }

    // Fallback to main if no exports or no types
    if (entryPoints.length === 0 && (packageJson.main || packageJson.types)) {
      const main = packageJson.types || packageJson.main;
      const entryPoint = join(packageDir, "node_modules", packageName, main);
      entryPoints.push(entryPoint);
    }

    return entryPoints;
  } catch (error) {
    throw new Error(
      `Failed to parse package.json exports for ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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

    // Find all entry points from exports
    console.log(`🔍 Discovering entry points...`);
    const entryPoints = await findEntryPoints(tempDir, packageName);
    console.log(`   Found ${entryPoints.length} entry point(s)`);

    // Run typedoc to generate JSON with all entry points
    console.log(`📄 Generating TypeDoc JSON...`);
    const docFile = join(tempDir, "doc.json");

    const typedocArgs = ["dlx", "typedoc"];
    for (const ep of entryPoints) {
      typedocArgs.push("--entryPoints", ep);
    }
    typedocArgs.push("--json", docFile, "--name", packageName, "--skipErrorChecking");

    await execa("pnpm", typedocArgs, {
      cwd: tempDir,
      stdio: "inherit",
    });

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
