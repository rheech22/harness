---
title: "런타임 전용 요소와 경로 매핑은 어댑터 폴더가 소유한다"
domain: [harness]
kind: decision
status: accepted
decision_date: "2026-11-08"
principle: "2. 무엇과 어떻게 도달하는가를 분리한다"
related:
  - ../conventions/structure.md
  - ../guides/add-runtime.md
---

# 런타임 전용 요소와 경로 매핑은 어댑터 폴더가 소유한다

## 배경

Claude 조각이 `rules/claude`, `commands/claude`, `templates/project/.claude`에, Codex 조각이 `rules/codex`, `runtimes/codex`, `templates/project/.codex`에 흩어져 있었고 경로 매핑은 `harness.json`에 있었습니다. 런타임 하나를 추가하려면 네 곳을 건드려야 했습니다. 같은 세션에서 OpenCode를 계획에서 뺄 때도 여러 곳을 찾아 지워야 했습니다.

## 결정

런타임 이름이 붙는 것은 전부 `src/adapters/<runtime>/`에 둡니다. 그 폴더의 `adapter.json`이 타깃 경로와 링크 규칙과 프로젝트 뼈대 조각을 선언하고, `README.md`가 근거 문서 링크·검증 방법·함정을 소유합니다. `harness.json`에는 런타임 중립 선언만 남깁니다.

## 고려한 대안

- **종류별 폴더 아래 런타임 하위 폴더**(`rules/claude`, `commands/claude`): 종류를 더할 때마다 런타임별 폴더가 또 생깁니다. 런타임을 빼려면 여러 폴더를 뒤져야 합니다.
- **`harness.json` 한 파일에 모든 런타임 매핑**: 파일 하나가 모든 런타임을 알아야 하고, 어댑터 조각과 그 선언이 다른 곳에 있습니다.

## 영향

런타임 추가는 폴더 하나 생성, 제거는 폴더 하나 삭제입니다. `link`가 `--runtime`으로 한 런타임만 거를 수 있고, `init-project`가 어댑터별 `project/` 조각을 겹쳐 복사합니다. 공유 훅 스크립트는 두 런타임의 페이로드를 모두 알아야 하므로 예외로 `src/hooks/`에 둡니다.
