---
title: "외부 배포 스냅샷이 원본보다 뒤처진 상태는 오류가 아니다"
domain: [harness]
kind: decision
status: accepted
decision_date: "2026-11-08"
principle: "6. 되돌릴 수 있는 단계로 간다"
related:
  - ../conventions/skills.md
  - ../guides/release.md
---

# 외부 배포 스냅샷이 원본보다 뒤처진 상태는 오류가 아니다

## 배경

내 머신용 배포(`dist/skills/`)는 원본과 항상 같아야 합니다. 그러나 외부용 배포(`dist/packages/`)까지 같은 규칙을 적용하면 원본을 고칠 때마다 외부 버전이 바뀌어 소비자가 고정할 수 있는 지점이 없어집니다. 자기 도구(excalibridge)를 하네스에 통합하면서 "custom이 원본, packages는 fork처럼 찍어낸 스냅샷"이라는 모델이 필요해졌습니다.

## 결정

`export`는 릴리스 행위입니다. `dist/packages/<name>/`은 `export`가 실행된 시점의 스냅샷이며 `.export.json`에 버전·소스 해시·패키지 해시를 남깁니다. `check`는 소스가 앞서 있으면 **export 대기**로 경고만 하고, 패키지가 손으로 고쳐졌을 때만 오류로 봅니다. 외부 소비자는 `<name>-v<ver>` 태그를 고정합니다.

## 고려한 대안

- **`packages/`도 항상 최신으로 강제**: 릴리스 시점을 고를 수 없고 내부용 변경이 즉시 외부에 노출됩니다.
- **export를 아예 두지 않고 태그만**: 테스트·내부 메모·프로필 문서를 걷어낼 자리(`strip`)가 없습니다.

## 영향

코드 패키지는 `src/tools/`와 `dist/packages/`에 두 벌 존재합니다. 커밋된 `dist/`와 같은 성격으로 받아들입니다. 테스트와 CI는 `src/tools/`에서만 돌고, 외부 설치는 `#subdirectory=dist/packages/<name>`을 가리킵니다.
