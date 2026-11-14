---
title: "symlink 경로에서 실행한 스크립트가 작업 없이 종료되는 문제"
domain: [harness]
kind: troubleshooting
status: current
related:
  - ../guides/setup.md
---

# symlink 경로에서 실행한 스크립트가 작업 없이 종료되는 문제

## 증상

별도 체크아웃의 build·link·configure 명령이 종료 코드 0을 반환하지만 출력과 생성 파일이 없습니다. macOS의 `/var` 아래 임시 HOME에서 독립 설치 시험을 수행할 때 발견했습니다.

## 가능한 원인

CLI 진입점을 판별할 때 명령 인자의 경로와 모듈 URL을 문자열로만 비교했습니다. `/var`는 `/private/var`로 연결되므로 같은 파일인데도 서로 다르게 비교될 수 있습니다.

## 진단

임시 체크아웃에서 명령이 출력한 계획과 실제 파일을 함께 확인합니다. 종료 코드만으로 성공을 판단하지 않습니다. `scripts/tests/install.test.mjs`는 공백과 따옴표를 포함한 임시 체크아웃에서 스킬·지침·설정을 실제로 적용하고 훅을 실행합니다.

## 해결

`process.argv[1]`이 있을 때 `fs.realpathSync`로 실제 경로를 구한 뒤 `fileURLToPath(import.meta.url)`과 비교합니다. build·link·export·configure가 같은 기준을 사용합니다.

## 재발 방지

독립 설치 시험을 CI에서 실행하고, 명령의 종료 코드와 파일 내용·symlink 대상을 모두 검사합니다.

## 관련 문서

- [설치와 로컬 설정](../guides/setup.md): 격리 HOME에서 설치를 검증하는 절차
