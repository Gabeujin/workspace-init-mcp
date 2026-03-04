# workspace-init-mcp

[![npm version](https://img.shields.io/npm/v/workspace-init-mcp)](https://www.npmjs.com/package/workspace-init-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MCP server that initializes workspaces with AI agent instructions, Agent Skills, documentation governance, and project structure — across VS Code, Cursor, Claude Code, and OpenHands.

Just say **"initialize workspace"** to your LLM — it generates everything automatically based on your project type.

`#Learning` `#WebApp` `#API` `#Mobile` `#DataScience` `#DevOps` `#Creative` `#Library` `#Monorepo` `#Consulting` `#Ecommerce` `#Fintech` `#Healthcare` `#SaaS` `#IoT`

---

## Setup

Add to your MCP config and you're done.

### VS Code (`settings.json`)

```jsonc
{
  "mcp": {
    "servers": {
      "workspace-init": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "workspace-init-mcp"]
      }
    }
  }
}
```

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "workspace-init": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "workspace-init": {
      "command": "npx",
      "args": ["-y", "workspace-init-mcp"]
    }
  }
}
```

---

## What It Does

Tell your LLM **"initialize workspace"** and it generates:

- `.github/copilot-instructions.md` — Global AI agent instructions
- `.github/agents/` & `.github/skills/` — [Agent Skills](https://agentskills.io) (50+ agents, 40+ skills)
- `.vscode/settings.json` & `*.instructions.md` — Custom instructions (code, test, review, commit, PR)
- `.editorconfig` & `.gitattributes` — Cross-editor consistency
- `docs/` — Documentation governance (work-logs, changelog, ADR, troubleshooting)

## Tools

| Tool | Description |
|---|---|
| `initialize_workspace` | Generate all workspace files |
| `preview_workspace_init` | Preview without creating files |
| `analyze_workspace` | Detect project type & tech stack |
| `validate_workspace` | Check initialization completeness |
| `list_project_types` | List available project types |
| `get_init_form_schema` | Get input form schema |
| `recommend_agent_skills` | Get skill recommendations |
| `search_agent_skills` | Search skill catalog |
| `install_agent_skills` | Install specific skills/agents |
| `list_agent_skills_catalog` | Browse full catalog |

## Project Types

| Type | Label | Best For |
|---|---|---|
| `learning` | 학습/자기개발 | Tutorials, study projects, self-learning |
| `web-app` | 웹 애플리케이션 | Frontend / fullstack web apps |
| `api` | API 서버 | Backend REST / GraphQL services |
| `mobile` | 모바일 앱 | iOS, Android, cross-platform apps |
| `data-science` | 데이터 사이언스 | ML/AI, data analysis, Jupyter notebooks |
| `devops` | DevOps/인프라 | CI/CD, IaC, cloud infrastructure |
| `creative` | 크리에이티브/콘텐츠 | Writing, content creation, documentation |
| `library` | 라이브러리/패키지 | Reusable libraries, npm/pip packages |
| `monorepo` | 모노레포 | Multi-package repositories |
| `consulting` | 컨설팅/SI | IT consulting, proposals, deliverables |
| `ecommerce` | 이커머스/커머스 | Online shopping, payments, order management |
| `fintech` | 핀테크/금융 | Banking, payments, regulatory compliance |
| `healthcare` | 헬스케어/의료 | EMR, health services, HIPAA compliance |
| `saas` | SaaS 플랫폼 | Multi-tenant platforms, subscription billing |
| `iot` | IoT/임베디드 | IoT devices, sensors, edge computing |
| `other` | 기타 | Custom / general-purpose projects |

## License

MIT
