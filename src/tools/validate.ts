/**
 * Tool: validate_workspace
 *
 * Checks whether a workspace has been properly initialized
 * and reports on the completeness of its structure.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationItem {
  path: string;
  label: string;
  status: "present" | "missing" | "outdated";
  category: "copilot" | "vscode" | "docs" | "governance";
  severity: "required" | "recommended" | "optional";
}

export interface ValidationResult {
  workspacePath: string;
  isInitialized: boolean;
  completeness: number; // 0-100
  items: ValidationItem[];
  summary: string;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Expected structure
// ---------------------------------------------------------------------------

const EXPECTED_FILES: Omit<ValidationItem, "status">[] = [
  {
    path: ".github/copilot-instructions.md",
    label: "Copilot 공통 지침",
    category: "copilot",
    severity: "required",
  },
  {
    path: ".vscode/settings.json",
    label: "VS Code 설정",
    category: "vscode",
    severity: "required",
  },
  {
    path: ".vscode/code-generation.instructions.md",
    label: "코드 생성 지침",
    category: "vscode",
    severity: "required",
  },
  {
    path: ".vscode/test-generation.instructions.md",
    label: "테스트 생성 지침",
    category: "vscode",
    severity: "recommended",
  },
  {
    path: ".vscode/code-review.instructions.md",
    label: "코드 리뷰 지침",
    category: "vscode",
    severity: "recommended",
  },
  {
    path: ".vscode/commit-message.instructions.md",
    label: "커밋 메시지 지침",
    category: "vscode",
    severity: "recommended",
  },
  {
    path: ".vscode/pr-description.instructions.md",
    label: "PR 설명 지침",
    category: "vscode",
    severity: "optional",
  },
  {
    path: "docs/work-logs/README.md",
    label: "작업 로그 디렉토리",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/troubleshooting/README.md",
    label: "트러블슈팅 디렉토리",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/changelog/README.md",
    label: "변경 이력 디렉토리",
    category: "docs",
    severity: "required",
  },
  {
    path: "docs/adr/README.md",
    label: "ADR 디렉토리",
    category: "docs",
    severity: "recommended",
  },
];

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

export function validateWorkspace(workspacePath: string): ValidationResult {
  const items: ValidationItem[] = EXPECTED_FILES.map((expected) => {
    const fullPath = path.join(workspacePath, expected.path);
    const exists = fs.existsSync(fullPath);
    return {
      ...expected,
      status: exists ? ("present" as const) : ("missing" as const),
    };
  });

  const requiredItems = items.filter((i) => i.severity === "required");
  const presentRequired = requiredItems.filter(
    (i) => i.status === "present"
  );
  const allPresent = items.filter((i) => i.status === "present");

  const isInitialized =
    presentRequired.length === requiredItems.length;
  const completeness = Math.round(
    (allPresent.length / items.length) * 100
  );

  const suggestions: string[] = [];
  const missing = items.filter((i) => i.status === "missing");

  if (missing.some((i) => i.severity === "required")) {
    suggestions.push(
      "필수 파일이 누락되어 있습니다. `initialize_workspace` 도구를 실행하여 초기화하세요."
    );
  }

  const missingRecommended = missing.filter(
    (i) => i.severity === "recommended"
  );
  if (missingRecommended.length > 0) {
    suggestions.push(
      `권장 파일 ${missingRecommended.length}개가 누락되어 있습니다: ${missingRecommended.map((i) => i.label).join(", ")}`
    );
  }

  // Check for extra doc sections
  const docsDir = path.join(workspacePath, "docs");
  if (fs.existsSync(docsDir)) {
    try {
      const docSubDirs = fs
        .readdirSync(docsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      if (docSubDirs.length > 4) {
        suggestions.push(
          `프로젝트 특화 문서 섹션이 ${docSubDirs.length - 4}개 추가로 구성되어 있습니다.`
        );
      }
    } catch {
      // ignore
    }
  }

  if (isInitialized && completeness === 100) {
    suggestions.push("워크스페이스가 완전하게 초기화되어 있습니다! 🎉");
  }

  const statusIcon = isInitialized ? "✅" : "❌";
  const summary = `${statusIcon} 워크스페이스 검증 결과: ${workspacePath}

완성도: ${completeness}% (${allPresent.length}/${items.length})
필수 파일: ${presentRequired.length}/${requiredItems.length}

${items.map((i) => `  ${i.status === "present" ? "✅" : "❌"} [${i.severity}] ${i.label} — ${i.path}`).join("\n")}

${suggestions.length > 0 ? "\n💡 제안:\n" + suggestions.map((s) => `  - ${s}`).join("\n") : ""}`;

  return { workspacePath, isInitialized, completeness, items, summary, suggestions };
}
