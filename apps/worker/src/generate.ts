import { execa } from "execa";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export interface GenerateOptions {
  packageSpec: string;
  outFile?: string;
}

async function findEntryPointsFallback(packageDir: string, packageName: string): Promise<string[]> {
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

      // Check for typedoc conditional export first (vanilla TypeDoc way)
      let types: string | undefined;
      if (typeof value === "object" && value !== null) {
        types = (value as Record<string, unknown>).typedoc as string | undefined;
        if (!types) {
          types = (value as Record<string, unknown>).types as string | undefined;
        }
      }

      if (types) {
        const entryPoint = join(packageDir, "node_modules", packageName, types);
        entryPoints.push(entryPoint);
      }
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
    const packagePath = join(tempDir, "node_modules", packageName);
    const packageJsonPath = join(packagePath, "package.json");

    // Read package.json to extract git info
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    const version = packageJson.version as string | undefined;
    const repository = packageJson.repository as { type: string; url: string } | string | undefined;

    // Extract git remote and revision
    let gitRemote: string | undefined;
    let gitRevision: string | undefined;
    let gitDirectory: string | undefined;

    if (typeof repository === "object" && repository?.type === "git") {
      const url = repository.url as string;
      // Remove git+ prefix and .git suffix
      gitRemote = url.replace(/^git\+/, "").replace(/\.git$/, "");
      if (version) gitRevision = `v${version}`;
      // Support monorepo structure via repository.directory field
      gitDirectory = (repository as Record<string, unknown>).directory as string | undefined;
    }

    // Generate TypeDoc JSON with vanilla TypeDoc (auto-discovers via typedoc export)
    console.log(`📄 Generating TypeDoc JSON (vanilla)...`);
    const docFile = join(tempDir, "doc.json");

    try {
      const typedocArgs = [
        "dlx",
        "typedoc",
        "--json",
        docFile,
        "--name",
        packageName,
        "--skipErrorChecking",
        "--disableGit",
      ];

      if (gitRemote && gitRevision) {
        const pathPrefix = gitDirectory ? `${gitDirectory}/` : "";
        typedocArgs.push(
          "--sourceLinkTemplate",
          `${gitRemote}/blob/${gitRevision}/${pathPrefix}{path}#L{line}`,
        );
      }

      await execa("pnpm", typedocArgs, {
        cwd: packagePath,
        stdio: "inherit",
      });
    } catch {
      // Fallback: use explicit entry points if vanilla approach fails
      console.log(`⚠️  Vanilla TypeDoc failed, using explicit entry points...`);
      const entryPoints = await findEntryPointsFallback(tempDir, packageName);
      if (entryPoints.length === 0) {
        throw new Error(
          `Failed to generate TypeDoc: vanilla approach failed and no fallback entry points found`,
        );
      }

      console.log(`   Found ${entryPoints.length} entry point(s)`);
      const typedocArgs = ["dlx", "typedoc"];
      for (const ep of entryPoints) {
        typedocArgs.push("--entryPoints", ep);
      }
      typedocArgs.push(
        "--json",
        docFile,
        "--name",
        packageName,
        "--skipErrorChecking",
        "--disableGit",
      );

      if (gitRemote && gitRevision) {
        const pathPrefix = gitDirectory ? `${gitDirectory}/` : "";
        typedocArgs.push(
          "--sourceLinkTemplate",
          `${gitRemote}/blob/${gitRevision}/${pathPrefix}{path}#L{line}`,
        );
      }

      await execa("pnpm", typedocArgs, {
        cwd: tempDir,
        stdio: "inherit",
      });
    }

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
