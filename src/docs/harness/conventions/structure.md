---
title: "구조 규칙"
domain: [harness]
kind: convention
status: current
related:
  - principles.md
  - ../decisions/0003-src-dist-split.md
  - ../decisions/0004-adapters-own-runtime-paths.md
---

# 구조 규칙

## 적용 범위

저장소의 최상위 배치와 두 경계에 적용합니다.

## 규칙

- `src/`는 원본입니다. 사람이 편집하는 파일은 전부 여기 있습니다. `docs/`(문서), `skills/`(스킬 선언), `assets/`(템플릿·라이선스), `tools/`(코드 패키지), `hooks/`, `templates/`, `adapters/`로 나뉩니다. `dist/`는 산출물이며 도구(`build`, `export`, external을 설치하는 Skills CLI)만 씁니다. 커밋은 하되 편집하지 않습니다.
- 런타임 이름이 붙는 파일은 `src/adapters/<runtime>/` 밖에 두지 않습니다. 단 스킬 선언의 `commands` 같은 런타임별 생성 지시는 선언 안에 런타임 키로 둘 수 있고, 생성물은 `dist/adapters/<runtime>/`에 놓입니다. `adapter.json`이 그 런타임의 경로와 링크 규칙을, `README.md`가 근거와 검증을 소유합니다.
- 루트에 두는 원본은 `AGENTS.md`와 `harness.json`뿐입니다. `harness.json`은 런타임 중립 선언(공용 배포 경로, 프로필, external, publish, tools)만 담습니다.
- 문서 루트는 `src/docs/` 하나입니다. 도메인 폴더 아래에 `conventions/`, `guides/`, `decisions/`, `history/`를 둡니다. 도메인 축과 문서 타입 축을 한 층에 섞지 않습니다.
- `src/docs/`의 문서는 `src/templates/docs/`의 타입별 템플릿과 frontmatter를 따릅니다.
- 루트 `README.md`, `AGENTS.md`, 어댑터 README, `conventions/` 같은 **기반 문서에는 시점에 따라 낡는 현재 상태를 적지 않습니다.** 무엇이 비어 있는지, 무엇이 들어올 예정인지, 지금 몇 개인지, 현재 도메인이 무엇인지 같은 서술이 여기 해당합니다. 상태는 `history/`·`backlogs/`와 `check` 출력이 소유합니다. 기반 문서는 구조와 규칙만 말합니다.
- 같은 내용을 두 절에 쓰지 않습니다. 폴더 트리의 주석은 이름과 역할 한 구절로 끝내고, 설명은 그 주제를 소유한 절 하나에만 둡니다.

## 이유

경계가 폴더로 드러나면 훅(`src/hooks/skill-distribution-guard.mjs`)과 `check`가 같은 경계를 보고, 새로 온 사람도 설명 없이 어디를 고쳐야 하는지 압니다. 런타임 하나를 더하거나 빼는 일이 폴더 하나의 생성·삭제로 끝납니다.

## 예외

`src/hooks/`의 공유 훅 스크립트는 두 런타임의 페이로드 형식을 모두 알아야 하므로 런타임 이름이 코드에 나타납니다. 공유 코드의 분기이지 런타임 전용 파일이 아니므로 허용합니다.

## 관련 문서

- [src/dist 분리 결정](../decisions/0003-src-dist-split.md)
- [어댑터가 경로를 소유하는 결정](../decisions/0004-adapters-own-runtime-paths.md)
