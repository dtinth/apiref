import { PipelineContext, PipelineStep } from "../pipeline.js";

export const uploadStorageStep: PipelineStep = {
  name: "upload-storage",
  async run(context: PipelineContext) {
    const { logger, packageSpec } = context;

    logger.log(`Uploading static site to object storage...`);
    logger.log(`Package: ${packageSpec}`);

    // TODO: Implement upload to object storage
    logger.log(`Storage bucket will be read from APIREF_STORAGE_BUCKET env var`);

    throw new Error("upload-storage not yet implemented");
  },
};
