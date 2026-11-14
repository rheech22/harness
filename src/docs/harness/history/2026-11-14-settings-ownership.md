---
title: "dotfiles와 에이전트 설정 소유권 분리 검증"
domain: [harness]
kind: history
status: current
related:
  - ../decisions/0007-harness-owns-agent-settings.md
  - ../guides/setup.md
  - ../troubleshooting/cli-entrypoint-realpath.md
---

# dotfiles와 에이전트 설정 소유권 분리 검증

## 요약

Claude settings의 원본과 적용을 하네스로 옮겼습니다. dotfiles의 Claude·OpenCode 설정 배포 선언을 제거하고 로컬 Claude settings 링크를 일반 파일로 이관했습니다. Codex는 기존 훅 등록만 하네스에서 적용하고 `config.toml`은 유지했습니다.

## 시간 순서

1. `configure`에 설정 leaf·훅 command별 관리, 충돌 검사, symlink 이관, 로컬 백업·관리 기록과 쓰기 실패 복구를 구현했습니다.
2. 프로젝트 템플릿에서 사용자 범위 공통 훅 등록을 제거했습니다. 훅 명령은 실제 체크아웃 경로로 생성합니다.
3. OpenCode 설정과 자체 플러그인 소스 전체를 `~/.local/state/harness/migrations/`에 보관했습니다. OpenCode 세션·기록·캐시는 유지했습니다.
4. 로컬 Claude settings를 dotfiles 링크에서 일반 파일로 이관하고, 이전 standalone 저장소를 가리키던 excalibridge 스킬 링크를 공용 하네스 배포로 통일했습니다.

## 발견 사항

- 임시 체크아웃의 `/var`와 `/private/var` 차이 때문에 CLI 진입점 판별이 실패했습니다. 실제 경로로 비교하도록 수정하고 [문제 해결 기록](../troubleshooting/cli-entrypoint-realpath.md)을 남겼습니다.
- dotfiles 없는 임시 HOME, 공백·따옴표를 포함한 체크아웃에서 build·link·configure·check와 실제 훅 실행이 통과했습니다. 설정 재적용은 변경이 없었고 앱이 추가한 설정도 보존됐습니다.
- 별도 체크아웃과 임시 HOME에서 Skills CLI로 external 전체를 설치한 뒤 build/check가 통과했습니다.
- 격리 HOME에 하네스를 적용한 뒤 dotfiles의 링크 전체를 실제 적용했습니다. 지침·스킬·설정·관리 기록의 내용과 symlink 대상이 모두 유지됐고, dotfiles 재계획은 전부 noop이었습니다.
- Node 22에서 하네스 테스트 52개, dotfiles 테스트 185개가 통과했습니다. dotfiles TypeScript 검사도 통과했습니다. 외부 설정 보존과 symlink 이관 보호 조건을 임시 사본에서 제거했을 때 회귀 테스트가 실패했습니다. dotfiles에 Claude 배포 항목을 다시 넣은 임시 사본도 소유권 회귀 테스트에서 거절됐습니다.

## 현재 상태

로컬 `configure`의 `changes`는 비고 `stateUpdate`는 false입니다. 관리 설정과 백업은 `~/.local/state/harness/`에 있으며 설정 원본은 각 어댑터에 있습니다.

Codex CLI 0.169.0의 새 프로세스에서 `debug prompt-input`으로 전역 지침·스킬의 고유 토큰이 모델 입력에 포함되고 음성 대조 토큰은 없는 것을 확인했습니다. 모델 호출은 하지 않았습니다.

Claude Code 2.1.325의 격리 환경 `doctor`는 종료 코드 0이었고 훅 명령은 직접 실행해 확인했습니다. 빈 HOME에는 인증·네이티브 설치 기록이 없다는 경고가 있었습니다. 실제 Claude 모델 응답을 통한 지침 로딩과 훅 신뢰 승인 이후의 컨텍스트 주입은 검증하지 않았습니다. 기존 프로젝트를 검색한 범위에서는 이전 공통 훅 등록을 찾지 못했으며, 검색 범위 밖 프로젝트까지 확인한 것은 아닙니다.
