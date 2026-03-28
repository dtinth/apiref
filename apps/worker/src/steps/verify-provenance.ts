import { PipelineContext, PipelineStep } from "../pipeline.js";

export const verifyProvenanceStep: PipelineStep = {
  name: "verify-provenance",
  async run(context: PipelineContext) {
    const { logger, packageSpec } = context;

    logger.log(`Fetching package metadata for ${packageSpec}...`);

    // TODO: Implement provenance check using pacote
    logger.log(`Checking npm provenance attestations...`);

    throw new Error("verify-provenance not yet implemented");
  },
};
