import type { SubmissionSnapshot } from "./constants.js";

export function isContentPackageChainEnabledEnv(): boolean {
  return String(process.env.CONTENT_PACKAGE_CHAIN_ENABLED ?? "").toLowerCase() === "true";
}

export function shouldRunContentPackageChain(snapshot: SubmissionSnapshot): boolean {
  return snapshot.include_content_package === true && isContentPackageChainEnabledEnv();
}
