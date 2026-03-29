import { execa } from "execa";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Logger } from "./logger.js";

function createExecaOptions(cwd: string, logFile?: string | null): any {
  const options: any = { cwd };
  if (logFile) {
    const output = { file: logFile, append: true };
    options.stdout = output;
    options.stderr = output;
  } else {
    options.stdio = "inherit";
  }
  return options;
}

/**
 * Options for TypeDoc generation.
 *
 * Either `packageSpec` or `installedPackagePath` must be provided, but not both.
 * - `packageSpec`: Install the package from npm (e.g., "elysia@1.4.28")
 * - `installedPackagePath`: Use an already-installed package directory (skips installation)
 */
export interface GenerateOptions {
  /** Package spec to install (e.g. "pkg@1.0.0"), OR path to already-installed package. Mutually exclusive with installedPackagePath. */
  packageSpec?: string;
  /** Path to already-installed package directory. Mutually exclusive with packageSpec. */
  installedPackagePath?: string;
  outFile?: string;
  logger?: Logger;
  logDir?: string;
}

function buildSourceLinkArgs(
  gitRemote: string | undefined,
  gitRevision: string | undefined,
  gitDirectory: string | undefined,
): string[] {
  if (!gitRemote || !gitRevision) return [];
  return [
    "--sourceLinkTemplate",
    `${gitRemote}/blob/${gitRevision}/${gitDirectory ? `${gitDirectory}/` : ""}{path}#L{line}`,
  ];
}

async function resolveEntryPointViaSourceMap(absDefaultPath: string): Promise<string | undefined> {
  try {
    const mapContent = await readFile(absDefaultPath + ".map", "utf-8");
    const map = JSON.parse(mapContent) as { sources?: string[] };
    for (const source of map.sources ?? []) {
      if (!source.endsWith(".ts") || source.endsWith(".d.ts")) continue;
      const resolvedSource = resolve(dirname(absDefaultPath), source);
      try {
        await access(resolvedSource);
        return resolvedSource;
      } catch {
        // source file not shipped in package
      }
    }
  } catch {
    // no source map available
  }
  return undefined;
}

async function resolveEntryPointViaDts(
  defaultPath: string,
  pkgRoot: string,
): Promise<string | undefined> {
  for (const [from, to] of [
    [/\.mjs$/, ".d.mts"],
    [/\.js$/, ".d.ts"],
  ] as [RegExp, string][]) {
    if (from.test(defaultPath)) {
      const candidate = join(pkgRoot, defaultPath.replace(from, to));
      try {
        await access(candidate);
        return candidate;
      } catch {
        // file doesn't exist, skip
      }
      break;
    }
  }
  return undefined;
}

async function findEntryPointsFallback(
  packageDir: string,
  packageName: string,
  log: (msg: string) => void,
): Promise<string[]> {
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

      // Tier 1: typedoc/types conditional export
      let types: string | undefined;
      if (typeof value === "object" && value !== null) {
        types = (value as Record<string, unknown>).typedoc as string | undefined;
        if (!types) {
          types = (value as Record<string, unknown>).types as string | undefined;
        }
      }

      if (types) {
        log(`   ${key}: ${types} (typedoc/types export)`);
        entryPoints.push(join(packageDir, "node_modules", packageName, types));
        continue;
      }

      // Tier 2: resolve from .mjs/.js export path via source map or .d.mts/.d.ts
      const defaultPath =
        typeof value === "string"
          ? value
          : typeof value === "object" && value !== null
            ? ((value as Record<string, unknown>).default as string | undefined)
            : undefined;

      if (defaultPath) {
        const pkgRoot = join(packageDir, "node_modules", packageName);
        const absDefaultPath = join(pkgRoot, defaultPath);

        // Tier 2a: read source map to find original .ts source file
        const sourceMapEntry = await resolveEntryPointViaSourceMap(absDefaultPath);
        if (sourceMapEntry) {
          log(`   ${key}: ${sourceMapEntry} (source map)`);
          entryPoints.push(sourceMapEntry);
          continue;
        }

        // Tier 2b: infer .d.mts or .d.ts from the export path
        const dtsEntry = await resolveEntryPointViaDts(defaultPath, pkgRoot);
        if (dtsEntry) {
          log(`   ${key}: ${dtsEntry} (.d.mts/.d.ts)`);
          entryPoints.push(dtsEntry);
        } else {
          log(`   ${key}: no entry point found (skipped)`);
        }
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
  const { packageSpec, installedPackagePath, outFile = "typedoc.json", logger, logDir } = options;

  // Validate mutually exclusive options
  if (!packageSpec && !installedPackagePath) {
    throw new Error("Either packageSpec or installedPackagePath must be provided");
  }
  if (packageSpec && installedPackagePath) {
    throw new Error("packageSpec and installedPackagePath are mutually exclusive");
  }

  const log = (msg: string) => {
    if (logger) logger.log(msg);
    else console.log(msg);
  };

  const pnpmLogFile = logDir ? join(logDir, "pnpm.log") : null;
  const typedocLogFile = logDir ? join(logDir, "typedoc.log") : null;

  // Extract package name early for use throughout
  let packageName: string;
  if (installedPackagePath) {
    const parts = installedPackagePath.split("/");
    packageName = parts[parts.length - 1] || installedPackagePath;
  } else {
    packageName = packageSpec!.split("@")[0] || packageSpec!;
  }

  let tempDir: string;
  let packagePath: string;

  if (installedPackagePath) {
    // Use already-installed package, skip temp dir creation and installation
    packagePath = installedPackagePath;
    tempDir = tmpdir(); // dummy, won't be cleaned up
    log(`📦 Using installed package at ${packagePath}`);
  } else {
    // Create a temporary directory for installation
    tempDir = resolve(
      tmpdir(),
      `apiref-generate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    try {
      await mkdir(tempDir, { recursive: true });

      // Install the package
      log(`📦 Installing ${packageSpec}...`);
      await execa(
        createExecaOptions(tempDir, pnpmLogFile),
      )`pnpm add --ignore-scripts ${packageSpec!}`;

      packagePath = join(tempDir, "node_modules", packageName);
    } catch (e) {
      // Cleanup on install failure
      try {
        await execa`rm -rf ${tempDir}`;
      } catch {
        // ignore cleanup errors
      }
      throw e;
    }
  }

  try {
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
    log(`📄 Generating TypeDoc JSON (vanilla)...`);
    const docFile = join(tempDir, "doc.json");

    const sourceLinkArgs = buildSourceLinkArgs(gitRemote, gitRevision, gitDirectory);

    try {
      await execa(
        createExecaOptions(packagePath, typedocLogFile),
      )`pnpm dlx typedoc --json ${docFile} --name ${packageName} --skipErrorChecking --disableGit ${sourceLinkArgs}`;

      // Check if vanilla output is meaningful (not just package.json)
      const vanillaJson = JSON.parse(await readFile(docFile, "utf-8"));
      const vanillaChildren: { name: string; sources?: { fileName: string }[] }[] =
        vanillaJson.children ?? [];
      const onlyPackageJson = vanillaChildren.every(
        (c) => c.name === "package.json" || c.sources?.every((s) => s.fileName === "package.json"),
      );
      if (onlyPackageJson) {
        throw new Error("Vanilla TypeDoc generated empty or package.json-only output");
      }
    } catch {
      // Fallback: use explicit entry points if vanilla approach fails
      log(`⚠️  Vanilla TypeDoc failed, using explicit entry points...`);
      // findEntryPointsFallback expects a dir containing node_modules; packagePath is already .../node_modules/pkgname
      const fallbackDir = installedPackagePath ? dirname(dirname(packagePath)) : tempDir;
      const entryPoints = await findEntryPointsFallback(fallbackDir, packageName, log);
      if (entryPoints.length === 0) {
        throw new Error(
          `Failed to generate TypeDoc: vanilla approach failed and no fallback entry points found`,
        );
      }

      log(`   Found ${entryPoints.length} entry point(s)`);
      const entryPointArgs = entryPoints.flatMap((ep) => ["--entryPoints", ep]);
      await execa(
        createExecaOptions(tempDir, typedocLogFile),
      )`pnpm dlx typedoc ${entryPointArgs} --json ${docFile} --name ${packageName} --skipErrorChecking --disableGit ${sourceLinkArgs}`;
    }

    // Read the generated JSON
    const typedocJson = await readFile(docFile, "utf-8");

    // Write output file
    const outputPath = resolve(outFile);
    await writeFile(outputPath, typedocJson, "utf-8");
    log(`✅ Generated: ${outputPath}`);

    return typedocJson;
  } finally {
    // Cleanup temp directory only if we created it (not if using installedPackagePath)
    if (!installedPackagePath) {
      try {
        await execa`rm -rf ${tempDir}`;
      } catch {
        const warnMsg = `⚠️  Failed to cleanup temp directory: ${tempDir}`;
        if (logger) logger.log(warnMsg);
        else console.warn(warnMsg);
      }
    }
  }
}
