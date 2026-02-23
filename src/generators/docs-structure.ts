/**
 * Generator for docs/ governance directory structure.
 * Creates README files for each documentation category.
 */

import {
  type WorkspaceInitParams,
  type GeneratedFile,
  PROJECT_TYPE_CONFIGS,
} from "../types.js";

/** Generate all docs/ directory README files */
export function generateDocsStructure(
  params: WorkspaceInitParams
): GeneratedFile[] {
  const config = PROJECT_TYPE_CONFIGS[params.projectType ?? "other"];
  const files: GeneratedFile[] = [];

  // Work Logs README
  files.push({
    relativePath: "docs/work-logs/README.md",
    content: `# 작업 로그 (Work Logs)

이 디렉토리에는 모든 작업의 요청 프롬프트, 진행 과정, 결과가 기록됩니다.

## 파일 규칙

- **파일명**: \`YYYY-MM-DD-<작업-요약>.md\`
- **생성 시점**: 모든 작업 시작 시 자동 생성
- **내용**: 요청 프롬프트 원문, 계획, 진행 과정, 결과, 참고 자료

## 목적

- 에이전트 세션의 장기 기억으로 활용
- 작업 패턴 분석 및 효율성 개선
- ${params.projectType === "learning" ? "학습 이력 추적 및 성장 기록" : "프로젝트 진행 이력 추적"}
`,
  });

  // Troubleshooting README
  files.push({
    relativePath: "docs/troubleshooting/README.md",
    content: `# 트러블슈팅 (Troubleshooting)

이 디렉토리에는 버그·이슈 발생부터 해결까지의 전 과정이 기록됩니다.

## 파일 규칙

- **파일명**: \`YYYY-MM-DD-<이슈-요약>.md\`
- **생성 시점**: 이슈 발생 시 자동 생성
- **상태 관리**: 🔴 Open → 🟡 In Progress → 🟢 Resolved

## 목적

- 동일·유사 이슈 재발 시 빠른 해결
- 근본 원인 분석(RCA) 및 예방 조치 수립
- 문제 해결 패턴 학습
`,
  });

  // Changelog README
  files.push({
    relativePath: "docs/changelog/README.md",
    content: `# 변경 이력 (Changelog)

이 디렉토리에는 ${params.isMultiRepo ? "프로젝트별" : "프로젝트의"} 변경 내역이 기록됩니다.

## 파일 규칙

- **파일명**: \`<프로젝트명>.md\`
- **갱신 시점**: 파일 변경 발생 시 즉시 자동 갱신
- **형식**: [Keep a Changelog](https://keepachangelog.com/) 기반

## 카테고리

- **Added**: 새로 추가된 기능/파일
- **Changed**: 수정된 기능/파일
- **Fixed**: 수정된 버그
- **Removed**: 삭제된 기능/파일
`,
  });

  // ADR README
  files.push({
    relativePath: "docs/adr/README.md",
    content: `# 아키텍처 결정 기록 (ADR)

이 디렉토리에는 주요 기술 결정 사항과 그 근거가 기록됩니다.

## 파일 규칙

- **파일명**: \`NNNN-<결정-제목>.md\` (NNNN = 순번)
- **생성 시점**: 주요 기술 결정이 필요할 때

## ADR 템플릿

\`\`\`markdown
# ADR-NNNN: <결정 제목>

- **일시**: YYYY-MM-DD
- **상태**: Proposed | Accepted | Deprecated | Superseded

## 맥락 (Context)
## 결정 (Decision)
## 대안 (Alternatives)
## 결과 (Consequences)
\`\`\`
`,
  });

  // Extra doc sections based on project type
  for (const section of config.docSections) {
    const sectionMeta = DOC_SECTION_META[section];
    if (sectionMeta) {
      files.push({
        relativePath: `docs/${section}/README.md`,
        content: `# ${sectionMeta.title}

${sectionMeta.description}

## 파일 규칙

- **파일명**: ${sectionMeta.fileNamePattern}
- **내용**: ${sectionMeta.contentGuide}
`,
      });
    }
  }

  return files;
}

/** Metadata for project-type-specific doc sections */
const DOC_SECTION_META: Record<
  string,
  {
    title: string;
    description: string;
    fileNamePattern: string;
    contentGuide: string;
  }
> = {
  "learning-notes": {
    title: "학습 노트 (Learning Notes)",
    description:
      "이 디렉토리에는 학습 자료, 핵심 개념, 인사이트가 정리됩니다.",
    fileNamePattern: "`YYYY-MM-DD-<학습-주제>.md`",
    contentGuide: "학습 목표 → 핵심 내용 → 실습 코드 → 인사이트",
  },
  "api-docs": {
    title: "API 문서 (API Documentation)",
    description: "이 디렉토리에는 API 엔드포인트, 스키마, 사용 예제가 정리됩니다.",
    fileNamePattern: "`<도메인>-api.md`",
    contentGuide: "엔드포인트, 요청/응답 스키마, 인증, 에러 코드, 예제",
  },
  "component-docs": {
    title: "컴포넌트 문서 (Component Documentation)",
    description: "이 디렉토리에는 UI 컴포넌트의 사용법과 Props가 정리됩니다.",
    fileNamePattern: "`<컴포넌트명>.md`",
    contentGuide: "컴포넌트 설명, Props, 사용 예제, 스토리북 연동",
  },
  "design-docs": {
    title: "디자인 문서 (Design Documentation)",
    description: "이 디렉토리에는 UI/UX 디자인 가이드와 화면 설계가 정리됩니다.",
    fileNamePattern: "`<화면명>-design.md`",
    contentGuide: "화면 흐름, 와이어프레임, 디자인 시스템 참조",
  },
  "experiment-logs": {
    title: "실험 로그 (Experiment Logs)",
    description:
      "이 디렉토리에는 데이터 분석 및 ML 실험 결과가 기록됩니다.",
    fileNamePattern: "`YYYY-MM-DD-<실험-이름>.md`",
    contentGuide:
      "실험 목적, 데이터셋, 하이퍼파라미터, 결과 메트릭, 분석",
  },
  "dataset-docs": {
    title: "데이터셋 문서 (Dataset Documentation)",
    description: "이 디렉토리에는 사용 데이터셋의 출처, 스키마, 전처리 정보가 정리됩니다.",
    fileNamePattern: "`<데이터셋명>.md`",
    contentGuide: "출처, 스키마, 크기, 전처리 과정, 라이선스",
  },
  "infra-docs": {
    title: "인프라 문서 (Infrastructure Documentation)",
    description: "이 디렉토리에는 인프라 구성, 네트워크, 리소스 정보가 정리됩니다.",
    fileNamePattern: "`<환경>-infra.md`",
    contentGuide: "아키텍처 다이어그램, 리소스 목록, 네트워크 구성, 접근 정보",
  },
  runbooks: {
    title: "런북 (Runbooks)",
    description: "이 디렉토리에는 장애 대응, 배포, 운영 절차가 정리됩니다.",
    fileNamePattern: "`<절차명>-runbook.md`",
    contentGuide: "트리거 조건, 단계별 절차, 확인 사항, 롤백 방법",
  },
  drafts: {
    title: "초안 (Drafts)",
    description: "이 디렉토리에는 작업 중인 콘텐츠 초안이 보관됩니다.",
    fileNamePattern: "`YYYY-MM-DD-<초안-제목>.md`",
    contentGuide: "초안 내용, 버전, 피드백 메모",
  },
  references: {
    title: "참고 자료 (References)",
    description: "이 디렉토리에는 리서치 자료와 참고 출처가 정리됩니다.",
    fileNamePattern: "`<주제>-references.md`",
    contentGuide: "출처 URL, 핵심 내용 요약, 활용 방안",
  },
  "package-docs": {
    title: "패키지 문서 (Package Documentation)",
    description: "이 디렉토리에는 각 패키지의 목적, API, 의존성이 정리됩니다.",
    fileNamePattern: "`<패키지명>.md`",
    contentGuide: "패키지 목적, 공개 API, 의존성, 빌드 설정",
  },
};
