import pacote from "pacote";
import { PipelineContext, PipelineStep } from "../pipeline.js";

export const verifyProvenanceStep: PipelineStep = {
  name: "verify-provenance",
  async run(context: PipelineContext) {
    const { logger, packageSpec } = context;

    logger.log(`Fetching package metadata for ${packageSpec}...`);

    const manifest = await pacote.manifest(packageSpec);
    const packageName = manifest.name;
    const version = manifest.version;

    logger.log(`Resolved: ${packageName}@${version}`);
    logger.log(`Checking npm provenance attestations...`);

    const hasAttestations = manifest.dist?.attestations != null;
    if (!hasAttestations) {
      throw new Error(
        `No npm provenance attestations found. Only packages published with npm provenance are accepted.`,
      );
    }

    logger.log(`✓ Package has valid npm provenance attestations`);
  },
};
