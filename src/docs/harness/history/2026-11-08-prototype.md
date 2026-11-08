---
title: "프로토타입 구축 기록 (2026-11-08)"
domain: [harness]
kind: history
status: current
related:
  - ../conventions/principles.md
---

# 프로토타입 구축 기록 (2026-11-08)

## 요약

socra-tutor-fe의 프로젝트 하네스를 분석한 뒤, 개인 하네스를 스크래치 폴더에서 단계적으로 설계했습니다. 하루 안에 구조 결정 다섯 개가 내려졌고 각각 ADR로 남겼습니다. 이 문서는 그 순서와 각 단계에서 버린 선택을 기록합니다.

## 시간 순서

1. dotfiles 하위 vs 분리: **분리.** dotfiles가 하네스를 소비하는 구조. 프로젝트가 개인 dotfiles에 의존할 수 없고, 하네스는 공개될 수 있기 때문.
2. 첫 프로토타입: 문서 → 스킬 번들 생성, `harness.json` 매핑, 프로필, 가짜 HOME 링크. Claude·Codex·OpenCode 세 런타임.
3. graphify 제거, OpenCode 제거. 쓰지 않는 도구를 계획에서 뺌.
4. Claude·Codex 실제 세션에서 고유 토큰으로 로딩 검증. Codex 공식 문서로 `~/.codex/skills` 미문서화와 custom prompt deprecated를 확인해 반영.
5. excalibridge 통합 논의: external → `packages/` 원본 → **custom 원본 + export 스냅샷**으로 모델이 바뀜. `tools/`와 `export` 도입.
6. 평면 구조를 `src/`·`dist/` 한 겹으로 분리.
7. 런타임 전용 요소를 `src/adapters/<runtime>/`로 통합. 어댑터 README 도입, 루트 README 축소.
8. 원칙 여덟 개 추출, `src/docs/harness/` 문서 트리와 ADR 다섯 편 작성.

## 발견 사항

- 포인터 스킬은 저장소 밖에서 깨진다. 복사 번들이 필요하다.
- Claude는 격리된 HOME에서 Keychain 자격 증명을 찾지 못한다. 검증 시 임시 복사가 필요하다.
- Codex 스킬 경로는 `~/.agents/skills`뿐이다. 2차 링크가 필요 없다.
- 균일한 규칙을 위해 코드 사본(`dist/packages`)을 받아들이는 것이 개념을 하나 더 두는 것보다 낫다.

## 현재 상태

프로토타입은 스크래치에만 있습니다. 실제 레포로 옮길 때 남은 일은 external 설치와 lock, excalibridge subtree 이관, dotfiles 프로필 연결, socra 문서 이관입니다.
