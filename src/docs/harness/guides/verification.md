---
title: "런타임 로딩 검증"
domain: [harness]
kind: guide
status: current
related:
  - ../conventions/principles.md
  - ../history/2026-11-08-runtime-verification.md
---

# 런타임 로딩 검증

## 언제 쓰는가

지침·스킬·규칙·명령의 **전달 경로**를 바꿨을 때 씁니다. 정적 검사(`check`)는 파일이 제자리에 있는지만 보고, 런타임이 실제로 읽는지는 새 프로세스에서만 알 수 있습니다. 로딩 계층, symlink 구조, 어댑터 경로를 바꾸면 반드시 수행합니다.

## 절차

1. 가짜 HOME을 만듭니다. `rm -rf /tmp/fake-home && node scripts/link.mjs --profile common --home /tmp/fake-home --apply`
2. 검증할 자리마다 **그곳에만 존재하는 고유 토큰**을 넣습니다. 전역 지침(`AGENTS.md`), 스킬 설명(`skill_description`), 경로 조건 규칙에 각각 다른 토큰을 둡니다. 존재하지 않는 토큰 하나를 음성 대조군으로 함께 묻습니다.
3. 런타임별 방법으로 새 프로세스를 띄워 토큰 도달을 확인합니다. 명령은 각 어댑터 README의 "검증" 절에 있습니다. Codex는 모델 호출 없이 입력을 볼 수 있고, Claude는 모델을 한 번 호출합니다.
4. 결과를 `history/`에 날짜와 런타임 버전과 함께 남깁니다.
5. 토큰을 제거하고 다시 `build`합니다. 가짜 HOME과 임시 자격 증명 사본을 삭제합니다.

## 검증

- 토큰이 전부 도달하고 음성 대조군이 0이어야 합니다.
- 스킬 목록에 custom 스킬 이름이 모두 보여야 합니다.
- 결과 기록에 런타임 버전을 적습니다. 버전이 오르면 결과가 유지되는지 다시 봅니다.

## 관련 문서

- [2026-11-08 검증 기록](../history/2026-11-08-runtime-verification.md)
