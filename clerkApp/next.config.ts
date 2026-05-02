import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    if (process.env.ANONIFY_SAFE_BUILD_ENTRYPOINT !== "1") {
      console.warn(
        [
          "",
          "==============================================",
          "Unsafe build entrypoint detected.",
          "Use `npm run build:safe` or `npm run build`.",
          "Running API contract validation before build...",
          "==============================================",
          "",
        ].join("\n"),
      );
    }

    execFileSync(process.execPath, ["scripts/validate-api-contracts.mjs"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  return nextConfig;
}
