---
title: "런타임 어댑터 추가"
domain: [harness]
kind: guide
status: current
related:
  - ../conventions/structure.md
  - ../decisions/0004-adapters-own-runtime-paths.md
  - setup.md
---

# 런타임 어댑터 추가

## 언제 쓰는가

새 에이전트 런타임이 전역 지침이나 스킬을 읽게 해야 할 때 씁니다. 런타임을 빼는 일은 어댑터 폴더를 지우는 것으로 끝납니다.

## 절차

1. 공식 문서에서 그 런타임이 전역 수준에서 읽는 자리를 확인합니다. 전역 지침 파일 이름, 스킬 디렉터리, 조건부 규칙·명령·훅·권한 규칙의 유무. 추측으로 채우지 않습니다.
2. `src/adapters/<runtime>/`를 만들고 `adapter.json`에 `targets`(자리)와 `links`(하네스 소스 → 자리)를 선언합니다. `src` 표기는 세 가지입니다. `@root/<path>`(하네스 루트), `@shared.skills/*`(공용 배포의 스킬마다), 그 외(어댑터 디렉터리 기준).
3. 스킬 디렉터리가 `~/.agents/skills`와 다르면 `@shared.skills/*` 2차 링크를 둡니다. 같으면 두지 않습니다.
4. 런타임 전용 조각(규칙, 명령, 훅 등록 파일)을 어댑터 안에 둡니다. 프로젝트 뼈대 조각은 `project/`에 두고 `adapter.json`의 `project`로 가리킵니다.
5. 앱도 수정하는 JSON 설정을 적용해야 하면 `configure`에 `source`(어댑터 기준 원본), `target`(`targets`의 키), `state`(HOME 기준 로컬 관리 기록 경로)를 선언합니다. 같은 타깃을 `links`에도 등록하지 않습니다. 지원하는 병합 형식과 이관 절차는 [설치와 로컬 설정](setup.md)을 따릅니다.
6. `README.md`를 씁니다. "자리 → 하네스 소스 → 근거" 표, 공식 문서 링크, 검증 명령, 함정. 기존 어댑터 README를 틀로 씁니다.
7. `node scripts/link.mjs --runtime <runtime> --home /tmp/fake-home`으로 계획을 보고, [런타임 로딩 검증](verification.md)을 수행합니다.

## 검증

- `link` 계획에 끊어진 대상이 없어야 합니다. `configure`를 선언했다면 별도 임시 HOME에서 `node scripts/configure.mjs --runtime <runtime> --home <dir>`로 계획·적용·재적용을 확인합니다.
- 어댑터 밖(`src/docs`, `src/hooks`, `harness.json`)에 런타임 이름이 새로 들어가지 않았는지 `rg`로 확인합니다.

## 관련 문서

- [구조 규칙](../conventions/structure.md)
