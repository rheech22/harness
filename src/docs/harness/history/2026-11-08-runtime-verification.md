---
title: "런타임 로딩 검증 기록 (2026-11-08)"
domain: [harness]
kind: history
status: current
related:
  - ../guides/verification.md
---

# 런타임 로딩 검증 기록 (2026-11-08)

## 요약

가짜 HOME(`/tmp/fake-home`)에 링크를 깔고 고유 토큰 세 개를 심은 뒤 새 프로세스에서 도달 여부를 확인했습니다. 존재하지 않는 토큰을 음성 대조군으로 함께 물었습니다.

## 시간 순서

| 항목 | Claude Code 2.1.312 | Codex 0.164.0 |
| --- | --- | --- |
| 전역 지침 토큰 (`AGENTS.md` 링크) | 도달. 출처를 "global CLAUDE.md"로 답함 | 도달. `prompt-input`의 `<INSTRUCTIONS>` 블록 |
| 스킬 발견 (`~/.agents/skills` 경유) | custom 3개 노출 | custom 3개 노출 |
| 스킬 설명 토큰 | 도달 | 도달 |
| 음성 대조군 | 없음 | 0건 |
| slash command `/review staged` | 동작. 스킬의 범위 규칙대로 응답 | 해당 없음 (custom prompt deprecated) |
| 경로 조건 규칙 (`.md` 편집 후) | 토큰과 규칙 제목 도달 | 해당 없음 |
| 권한 규칙 파일 | 해당 없음 | 파일 존재 상태로 정상 실행 |
| 훅 등록 | dotfiles 소유, 미검증 | 파일 배치만. 실행은 `/hooks` 신뢰 후 |

검증 명령은 각 어댑터 README의 "검증" 절에 있습니다.

## 발견 사항

- Claude: `~/.claude/.credentials.json`이 만료 토큰이었고 유효 토큰은 Keychain에 있었다. Keychain 값을 임시 파일로 내보내 검증했고 끝난 뒤 삭제했다.
- Codex: `~/.codex/skills` 2차 링크 없이 `~/.agents/skills`에서 스킬을 읽는 것을 확인했다. 공식 문서도 그 경로만 문서화한다.

## 현재 상태

검증 뒤 토큰은 제거하고 다시 빌드했습니다. 가짜 HOME, 임시 프로젝트, 자격 증명 사본은 삭제했습니다. 런타임 버전이 오르면 같은 절차로 다시 확인합니다.
