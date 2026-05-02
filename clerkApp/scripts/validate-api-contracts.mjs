// validate-api-contracts.mjs
//
// Dual-lock API contract check for Next route handlers:
//   1. apiAccess declares the route contract: "public" | "organizer"
//   2. route wrappers enforce runtime behavior: publicApiRoute | organizerApiRoute
//
// The build fails if the declaration and wrapper diverge.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const API_DIR = join(import.meta.dirname, "..", "app", "api");
const VALID_VALUES = new Set(["public", "organizer"]);
const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

const ACCESS_EXPORT_REGEX =
  /export\s+const\s+apiAccess\s*=\s*["'](\w+)["']/;
const HANDLER_EXPORT_REGEX =
  /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*(publicApiRoute|organizerApiRoute)\s*\(/g;
const ANY_HANDLER_EXPORT_REGEX =
  /export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;

const EXPECTED_WRAPPER_BY_ACCESS = {
  public: "publicApiRoute",
  organizer: "organizerApiRoute",
};

async function findRouteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findRouteFiles(fullPath)));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      files.push(fullPath);
    }
  }

  return files;
}

function getExportedHttpMethods(content) {
  const methods = new Set();
  for (const match of content.matchAll(ANY_HANDLER_EXPORT_REGEX)) {
    methods.add(match[1]);
  }
  return methods;
}

function getWrappedHandlers(content) {
  const handlers = [];
  for (const match of content.matchAll(HANDLER_EXPORT_REGEX)) {
    handlers.push({
      method: match[1],
      wrapper: match[2],
    });
  }
  return handlers;
}

function formatActualWrappers(wrappedHandlers) {
  if (wrappedHandlers.length === 0) {
    return "none";
  }

  return wrappedHandlers
    .map((handler) => `${handler.method}:${handler.wrapper}`)
    .join(", ");
}

function createMismatchMessage({
  rel,
  declaredAccess,
  expectedWrapper,
  actualWrappers,
}) {
  return [
    `${rel}: API contract mismatch`,
    `    declared apiAccess: ${declaredAccess}`,
    `    expected wrapper:  ${expectedWrapper}`,
    `    actual wrapper:    ${actualWrappers}`,
  ].join("\n");
}

async function validate() {
  let routeFiles;
  try {
    routeFiles = await findRouteFiles(API_DIR);
  } catch {
    console.log("[ok] No /app/api/ directory found - nothing to validate.");
    process.exit(0);
  }

  if (routeFiles.length === 0) {
    console.log("[ok] No API route files found - nothing to validate.");
    process.exit(0);
  }

  const violations = [];

  for (const filePath of routeFiles) {
    const content = await readFile(filePath, "utf-8");
    const rel = relative(join(import.meta.dirname, ".."), filePath);
    const accessMatch = content.match(ACCESS_EXPORT_REGEX);

    if (!accessMatch) {
      violations.push(`${rel}: MISSING export const apiAccess`);
      continue;
    }

    const declaredAccess = accessMatch[1];
    if (!VALID_VALUES.has(declaredAccess)) {
      violations.push(
        `${rel}: INVALID apiAccess = "${declaredAccess}" (must be "public" or "organizer")`,
      );
      continue;
    }

    const expectedWrapper = EXPECTED_WRAPPER_BY_ACCESS[declaredAccess];
    const exportedMethods = getExportedHttpMethods(content);
    const wrappedHandlers = getWrappedHandlers(content);
    const actualWrappers = formatActualWrappers(wrappedHandlers);

    if (exportedMethods.size === 0) {
      violations.push(`${rel}: MISSING exported HTTP route handler`);
      continue;
    }

    for (const method of exportedMethods) {
      const wrappedHandler = wrappedHandlers.find(
        (handler) => handler.method === method,
      );

      if (!wrappedHandler || wrappedHandler.wrapper !== expectedWrapper) {
        violations.push(
          createMismatchMessage({
            rel,
            declaredAccess,
            expectedWrapper: `${method}:${expectedWrapper}`,
            actualWrappers,
          }),
        );
      }
    }

    for (const handler of wrappedHandlers) {
      if (!HTTP_METHODS.has(handler.method)) {
        violations.push(`${rel}: INVALID HTTP method export ${handler.method}`);
      }
    }
  }

  console.log(`\nAPI Contract Validation`);
  console.log(`======================`);
  console.log(`Routes scanned: ${routeFiles.length}`);

  if (violations.length > 0) {
    console.log(`Violations:     ${violations.length}\n`);
    for (const violation of violations) {
      console.log(`  [x] ${violation}`);
    }
    console.log(`\nEvery route.ts must export apiAccess and use the matching route wrapper.`);
    console.log(`Public routes:    apiAccess = "public" + publicApiRoute(...)`);
    console.log(`Organizer routes: apiAccess = "organizer" + organizerApiRoute(...)`);
    process.exit(1);
  }

  console.log(`Violations:     0`);
  for (const filePath of routeFiles) {
    const content = await readFile(filePath, "utf-8");
    const accessMatch = content.match(ACCESS_EXPORT_REGEX);
    const rel = relative(join(import.meta.dirname, ".."), filePath);
    const actualWrappers = formatActualWrappers(getWrappedHandlers(content));
    console.log(`  [ok] ${rel} -> ${accessMatch[1]} (${actualWrappers})`);
  }
  console.log(`\nAll API routes have matching metadata and wrappers.`);
}

validate();
