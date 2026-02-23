/**
 * Barrel export for all generators.
 */

export { generateCopilotInstructions } from "./copilot-instructions.js";
export {
  generateSettings,
  generateCodeGenInstructions,
  generateTestInstructions,
  generateReviewInstructions,
  generateCommitInstructions,
  generatePRInstructions,
} from "./settings.js";
export { generateDocsStructure } from "./docs-structure.js";
export {
  generateInitialChangelog,
  generateSetupWorkLog,
} from "./changelog.js";
