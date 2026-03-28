import { execa } from "execa";
import { join } from "node:path";
import { PipelineContext, PipelineStep } from "../pipeline.js";

export const uploadStorageStep: PipelineStep = {
  name: "upload-storage",
  async run(context: PipelineContext) {
    const { logger, tmpDir, resolvedPackageName, resolvedVersion } = context;

    // Validate that verify-provenance has already set these
    if (!resolvedPackageName) {
      throw new Error("resolvedPackageName not set (verify-provenance step must run first)");
    }
    if (!resolvedVersion) {
      throw new Error("resolvedVersion not set (verify-provenance step must run first)");
    }

    // Read storage bucket from environment
    const storageBucket = process.env.APIREF_STORAGE_BUCKET;
    if (!storageBucket) {
      throw new Error("APIREF_STORAGE_BUCKET environment variable not set");
    }

    const siteDir = join(tmpDir, "site");
    const uploadLogFile = join(tmpDir, "upload.log");

    // Build destination path mirroring npmjs.com pattern: package/{name}/v/{version}/
    const destination = `${storageBucket}/package/${resolvedPackageName}/v/${resolvedVersion}/`;

    logger.log(`Uploading static site to ${destination}`);
    logger.log(`Source: ${siteDir}`);

    // Use rclone to sync files to object storage
    await execa({
      stdout: { file: uploadLogFile },
      stderr: { file: uploadLogFile },
    })`rclone copy ${siteDir} ${destination} --progress --no-traverse`;

    logger.log(`✓ Static site uploaded to ${destination}`);
  },
};
