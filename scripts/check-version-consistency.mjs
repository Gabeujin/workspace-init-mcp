import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const errors = [];
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const versionSource = readText("src/data/version.ts");
const readme = readText("README.md");
const version = packageJson.version;
const versionPattern = escapeRegExp(version);

function expect(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

expect(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version), `package.json version is not semver-like: ${version}`);
expect(packageLock.version === version, `package-lock.json root version ${packageLock.version} does not match package.json ${version}`);
expect(
  packageLock.packages?.[""]?.version === version,
  `package-lock.json packages[""].version ${packageLock.packages?.[""]?.version} does not match package.json ${version}`
);
expect(
  new RegExp(`WORKSPACE_INIT_MCP_VERSION\\s*=\\s*"${versionPattern}"`).test(versionSource),
  `src/data/version.ts WORKSPACE_INIT_MCP_VERSION does not match ${version}`
);
expect(
  new RegExp(`Version \`${versionPattern}\``).test(readme),
  `README.md does not introduce Version \`${version}\``
);
expect(
  new RegExp(`## ${versionPattern} Release Notes`).test(readme),
  `README.md does not include ## ${version} Release Notes`
);
expect(
  /"prepack"\s*:\s*"npm run clean && npm run build"/.test(readText("package.json")),
  "package.json prepack must clean dist before building"
);

if (errors.length > 0) {
  console.error("Version consistency check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Version consistency check passed for ${version}.`);
