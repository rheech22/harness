---
title: "원본은 src/, 산출물은 dist/ 한 겹으로 나눈다"
domain: [harness]
kind: decision
status: accepted
decision_date: "2026-11-08"
principle: "3. 구조가 규칙을 말하게 한다"
related:
  - ../conventions/structure.md
  - 0001-single-source-docs.md
---

# 원본은 src/, 산출물은 dist/ 한 겹으로 나눈다

## 배경

프로토타입 초기에는 `docs/ tools/ skills/ packages/ rules/ commands/ hooks/`가 한 층에 나란히 있었습니다. 어느 것이 원본이고 어느 것이 생성물인지 이름만으로 알 수 없었고, 훅의 감시 경로와 drift 규칙이 디렉터리 이름을 하나씩 열거해야 했습니다.

## 결정

사람이 편집하는 것은 전부 `src/` 아래, `build`와 `export`가 쓰는 것은 전부 `dist/` 아래에 둡니다. 루트에 남는 원본은 `AGENTS.md`와 `harness.json`뿐입니다. `dist/`는 커밋하되 편집하지 않습니다.

## 고려한 대안

- **평면 유지**: 디렉터리가 적을 때는 괜찮지만 종류가 늘수록 경계가 흐려집니다.
- **`generated/`라는 이름**: `packages/`는 생성보다 배포에 가깝고, 두 산출물을 아우르는 이름으로는 `dist`가 더 맞습니다. `dist`가 보통 gitignore 대상이라는 연상은 README에 "커밋한다"고 적어 상쇄합니다.

## 영향

규칙이 "`dist/` 아래는 손대지 않는다" 한 줄로 줄었습니다. 훅은 `/dist/` 하나만 감시하고, `check`의 두 규칙(`skills`는 어긋나면 오류, `packages`는 뒤처져도 경고)도 모두 `dist/` 안에서 작동합니다.
