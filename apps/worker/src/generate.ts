import { execa } from "execa";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { ReflectionKind } from "typedoc";
import type { Logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function findEntryPoints(
  packagePath: string,
  packageName: string,
  log: (msg: string) => void,
): Promise<Array<{ exportName: string; filePath: string }>> {
  try {
    const packageJsonPath = join(packagePath, "package.json");
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    const entryPoints: Array<{ exportName: string; filePath: string }> = [];
    const exports = packageJson.exports || {};

    // Process exports field
    for (const [key, value] of Object.entries(exports)) {
      // Skip package.json and wildcard exports
      if (key === "./package.json" || key.includes("*")) {
        continue;
      }

      const subPath = key === "." ? "" : key.slice(2); // Remove "./" prefix
      const exportName = subPath ? `${packageName}/${subPath}` : packageName;

      // Tier 1: typedoc/types conditional export or direct TypeScript file
      let types: string | undefined;
      if (typeof value === "object" && value !== null) {
        types = (value as Record<string, unknown>).typedoc as string | undefined;
        if (!types) {
          types = (value as Record<string, unknown>).types as string | undefined;
        }
      } else if (typeof value === "string" && (value.endsWith(".ts") || value.endsWith(".tsx"))) {
        // Tier 1a: direct TypeScript export
        types = value;
      }

      if (types) {
        log(`   ${key}: ${types} (typedoc/types export)`);
        entryPoints.push({ exportName, filePath: join(packagePath, types) });
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
        const absDefaultPath = join(packagePath, defaultPath);

        // Tier 2a: read source map to find original .ts source file
        const sourceMapEntry = await resolveEntryPointViaSourceMap(absDefaultPath);
        if (sourceMapEntry) {
          log(`   ${key}: ${sourceMapEntry} (source map)`);
          entryPoints.push({ exportName, filePath: sourceMapEntry });
          continue;
        }

        // Tier 2b: infer .d.mts or .d.ts from the export path
        const dtsEntry = await resolveEntryPointViaDts(defaultPath, packagePath);
        if (dtsEntry) {
          log(`   ${key}: ${dtsEntry} (.d.mts/.d.ts)`);
          entryPoints.push({ exportName, filePath: dtsEntry });
        } else {
          log(`   ${key}: no entry point found (skipped)`);
        }
      }
    }

    // Fallback to main/module/types/typings if no exports
    if (entryPoints.length === 0) {
      for (const field of ["types", "typings", "module", "main"]) {
        const mainPath = packageJson[field];
        if (typeof mainPath === "string") {
          log(`   using ${field}: ${mainPath}`);
          entryPoints.push({ exportName: packageName, filePath: join(packagePath, mainPath) });
          break;
        }
      }
    }

    return entryPoints;
  } catch (error) {
    throw new Error(
      `Failed to parse package.json for entry points: ${error instanceof Error ? error.message : String(error)}`,
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

    // Read package.json to extract git info and package name
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    const version = packageJson.version as string | undefined;
    const repository = packageJson.repository as { type: string; url: string } | string | undefined;

    // Use actual package name from package.json
    packageName = (packageJson.name as string | undefined) || packageName;

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

    // Discover entry points from package.json exports/main/module/types/typings
    log(`📄 Discovering entry points...`);
    const entryPoints = await findEntryPoints(packagePath, packageName, log);
    if (entryPoints.length === 0) {
      throw new Error(`Failed to generate TypeDoc: no entry points found in package.json`);
    }

    log(`   Found ${entryPoints.length} entry point(s)`);
    log(`📋 Module mapping:`);
    for (const { exportName, filePath } of entryPoints) {
      log(`   ${exportName} → ${filePath}`);
    }

    // Build source link template
    const sourceLinkTemplate =
      gitRemote && gitRevision
        ? `${gitRemote}/blob/${gitRevision}/${gitDirectory ? `${gitDirectory}/` : ""}{path}#L{line}`
        : undefined;

    // Create TypeDoc options JSON in temp directory to avoid package pollution
    const typedocConfigPath = join(tempDir, "typedoc.options.json");
    const typedocOptions = {
      entryPoints: entryPoints.map((ep) => ep.filePath),
      json: join(tempDir, "doc.json"),
      name: packageName,
      skipErrorChecking: true,
      disableGit: true,
      displayBasePath: packagePath,
      alwaysCreateEntryPointModule: true,
      ...(sourceLinkTemplate ? { sourceLinkTemplate } : {}),
    };

    await writeFile(typedocConfigPath, JSON.stringify(typedocOptions, null, 2));
    log(`   Wrote TypeDoc config:`);
    log(`   ${JSON.stringify(typedocOptions, null, 2).split("\n").join("\n   ")}`);

    // Run TypeDoc with the config file
    log(`🔨 Generating TypeDoc JSON...`);
    const docFile = typedocOptions.json as string;
    const typedocBin = resolve(__dirname, "../node_modules/.bin/typedoc");
    log(`   Using TypeDoc from: ${typedocBin}`);
    await execa(
      createExecaOptions(tempDir, typedocLogFile),
    )`${typedocBin} --options ${typedocConfigPath}`;

    // Read the generated JSON
    let typedocJson = await readFile(docFile, "utf-8");
    const doc = JSON.parse(typedocJson);

    // Post-process: map file paths back to export names
    log(`📝 Post-processing reflection names...`);
    const filePathToExportName = new Map(entryPoints.map((ep) => [ep.filePath, ep.exportName]));

    if (doc.children && Array.isArray(doc.children)) {
      for (const child of doc.children) {
        // Only rename module-type reflections with exactly one source
        if (
          child.kind === ReflectionKind.Module &&
          child.sources &&
          Array.isArray(child.sources) &&
          child.sources.length === 1
        ) {
          const relativeSourcePath = child.sources[0].fileName as string;
          // Convert relative path to absolute by joining with displayBasePath
          const absoluteSourcePath = resolve(packagePath, relativeSourcePath);
          const exportName = filePathToExportName.get(absoluteSourcePath);
          if (exportName) {
            const oldName = child.name;
            child.name = exportName;
            log(`   ${oldName} → ${exportName}`);
          }
        }
      }
    }

    typedocJson = JSON.stringify(doc, null, 2);

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
