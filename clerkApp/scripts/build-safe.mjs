import { spawnSync } from "node:child_process";

function runNodeScript(scriptPath, args = [], options = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    console.error(`[build:safe] Failed to run ${scriptPath}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNodeScript("node_modules/next/dist/bin/next", ["build"], {
  env: {
    ...process.env,
    ANONIFY_SAFE_BUILD_ENTRYPOINT: "1",
  },
});
