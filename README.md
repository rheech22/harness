# harness

개인 에이전트 하네스.

원칙·결정·절차는 [`principles`](src/docs/harness/conventions/principles.md)가 소유한다.

## 폴더

```
harness/
  AGENTS.md            전역 지침
  harness.json         하네스 manifest
  src/                 원본 모음
    docs/<domain>/     관심사별 원본 문서 모음
      harness/         단, 이곳은 이 레포에 대한 문서 모음
    skills/<name>/     스킬별 원본
      skill.json       스킬 manifest
      assets/          번들에 실어 보낼 에셋
      scripts/         스킬 실행, 검증 코드
    tools/<name>/      코드 패키지. 자기 SKILL.md 와 references 를 가짐
    hooks/             런타임이 공유하는 훅 스크립트 본체
    templates/project/ 프로젝트 뼈대 중 런타임 중립 부분
    templates/docs/    문서 타입별 템플릿
    adapters/<runtime>/ 런타임 전용. adapter.json 과 README
  dist/                산출물. 커밋은 하되 편집하지 않는다
    skills/<name>/     내 머신 배포. custom 은 build 가, external 은 Skills CLI 가 쓴다
    adapters/<rt>/     생성된 명령과 규칙
    packages/<name>/   외부 배포 스냅샷
  scripts/             build · check · export · link · init-project
```

## 경계 두 개

- **`dist/` 아래는 손대지 않는다.** 원본은 `src/`, 산출물은 `dist/`. `dist/`를 쓰는 주체는 도구(build, export, Skills CLI)뿐이다. 훅과 `check`가 같은 경계를 본다.
- **런타임 이름은 `src/adapters/<runtime>/` 밖에 두지 않는다.** 런타임을 추가하면 폴더 하나를 만들고, 빼면 지운다.

## 흐름

```
src/skills/<name>/skill.json ──build──▶ dist/skills/<name>/    닫힌 번들: SKILL.md + references/ + assets/ + scripts/ (링크 재작성)
                       ──build──▶ dist/adapters/<rt>/commands/   선언의 commands 에서 생성 (slash command)
                       ──build──▶ dist/adapters/<rt>/rules/      선언의 rules 에서 생성 (paths + 문서 본문 인라인)
src/tools/<name>/      ──build──▶ dist/skills/<name>/    패키지가 가진 SKILL.md 의 사본
        └──────────────export──▶ dist/packages/<name>/   릴리스 스냅샷. strip 적용, 태그 <name>-v<ver>

dist/skills/*  ──link──▶ ~/.agents/skills/*              harness.json 소유 (공용 배포)
AGENTS.md, rules, commands, hooks ──link──▶ 런타임별 자리   각 adapter.json 소유
```

- `build`는 매번 돌고 `dist/skills/`를 원본과 일치시킨다. 어긋나면 오류. 번들 안 링크는 번들 기준으로 다시 쓰고, 밖을 가리키면 저장소 URL + 경고, 없는 대상은 오류.
- 프로젝트마다 다른 값은 프로필로 뺀다. 번들은 기본값을 품고, 생성된 SKILL.md 가 프로젝트의 `docs/profiles/<name>.md` 를 먼저 읽게 한다.
- `export`는 릴리스 행위다. 원본이 앞서 있어도 `check`는 **export 대기**로만 알린다. `dist/`를 손으로 고치면 오류.
- 외부 소비자는 `dist/packages/`의 태그를 고정한다. 문서 스킬은 `skills add rheech22/harness --skill <name>`, 코드는 `uv tool install '<name> @ git+…@<name>-v<ver>#subdirectory=dist/packages/<name>'`.

## 세 가지 로딩 계층

| 계층 | 담는 것 | 전달 |
| --- | --- | --- |
| 항상 로드 | `AGENTS.md` 하나. 모든 작업에 걸치는 것만 | 각 어댑터의 `instructions` 자리로 링크 |
| 경로 조건 | 파일 종류로 걸리는 규칙 | 지원하는 런타임의 어댑터 `rules/` |
| 요청 시 | 도메인별 워크플로우와 기준 | 스킬. `description`으로 런타임이 라우팅 |

## 분류는 메타데이터로

`src/docs/`는 도메인 폴더로 나누고 `dist/skills/`는 평평하다. 문서 frontmatter의 `domain`이 스킬에 전파되고, `harness.json`의 `profiles`가 링크 대상을 고른다. 로딩 판단에는 쓰지 않는다.

```yaml
# src/docs/<domain>/<doc>.md 의 frontmatter — 문서는 자기 분류만 밝힌다
---
title: "코드 리뷰 워크플로우"
domain: [common]
kind: workflow          # convention | workflow | guide | architecture | profile | decision | history
status: current
related: []
---
```

```json
// src/skills/<name>/skill.json — 스킬 선언. 어떤 문서를 어떤 순서로 묶고, 무엇을 싣고, 어디에 명령·규칙을 낼지
{ "name": "code-review", "description": "Use when …",
  "reads": ["docs/common/code-review.md", "docs/common/prose-style.md"],
  "assets": [],
  "profile": { "name": "code-review", "default": "docs/common/profiles/code-review.default.md", "projectPath": "docs/profiles/code-review.md" },
  "commands": { "claude": { "name": "review" } },
  "rules": { "claude": { "name": "coding", "paths": ["**/*.ts"] } } }
```

## custom 과 external

- **custom**: 원본이 이 레포에 있는 것. `src/skills/*/skill.json`이 선언하는 번들 스킬과 `src/tools/`의 코드 패키지.
- **external**: upstream에서 Skills CLI로 `dist/skills/`에 설치하고 `harness.json`의 `external`에 출처, `skills-lock.json`을 커밋. 레포 루트의 `.agents/skills → dist/skills` 링크가 설치 자리를 정하며, 설치는 `-a codex`로 한 번만 한다(다른 agent 대상은 레포 안에 런타임 디렉터리를 만든다). `node scripts/add-external.mjs <name>`이 이 절차를 감싸고, `check`가 lock과 선언의 정합을 본다.
- `tools`로 선언한 CLI(스킬이 전제하는 실행 파일)는 요구사항만 적고 설치는 dotfiles가 한다.

같은 이름을 두 종류로 선언하면 `check`가 막는다.

## 명령

```bash
node scripts/build.mjs                                       # src → dist/skills
node scripts/check.mjs                                       # drift, 분류, external, export 상태
node scripts/add-external.mjs <name> | --all                 # external 스킬 설치 (dist/skills + skills-lock.json)
node scripts/export.mjs <name> --version <ver>               # dist/packages 스냅샷 (코드 패키지 버전 일치 검사)
node scripts/link.mjs --profile common,writing               # 계획만. --runtime claude 로 한 런타임만
node scripts/link.mjs --profile common,writing --apply       # 적용 (기존 경로는 덮어쓰지 않음)
node scripts/init-project.mjs <dir> [--runtime claude,codex] # 프로젝트 뼈대 심기
```

패키지별 버전과 태그, 코드 패키지 테스트 절차는 [릴리스와 외부 배포](src/docs/harness/guides/release.md)를 따른다.

## dotfiles와의 경계

머신 값(모델, 권한 허용 목록, 로컬 포트 MCP, 테마, 외부 도구가 덮어쓰는 훅)은 dotfiles가 소유한다. dotfiles는 이 레포를 `~/harness`에 두고 `link.mjs`를 호출하는 프로필 하나만 가진다.
