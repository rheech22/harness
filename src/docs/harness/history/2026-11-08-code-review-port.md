---
title: "code-review 이식 기록 (2026-11-08)"
domain: [harness]
kind: history
status: current
related:
  - ../decisions/0006-skill-manifest-and-closed-bundles.md
---

# code-review 이식 기록 (2026-11-08)

## 요약

socra-tutor-fe의 `docs/guides/code-review.md`(305줄)와 그 의존(report-design, prose-style, 쉘·템플릿·라이선스 4파일)을 첫 실제 이식 대상으로 삼았습니다. 가장 많은 외부 의존을 가진 문서를 골라, 이식이 요구하는 구조 변경을 한 번에 드러내려는 선택이었습니다.

## 시간 순서

1. 원문과 자산을 `src/`로 복사. 빌드가 끊어진 링크를 오류로 보고.
2. Socra 전용 값을 `profiles/code-review.default.md`로 분리. base ref, 자동 검사 표, 관점별 기준 문서, 접근성 고유 항목, 전체 검사 명령, 리포트 디렉터리.
3. 스킬 선언을 `src/skills/code-review.json`으로 단일화하고 기존 스킬 넷도 같은 형식으로 전환.
4. `build`에 링크 재작성·자산 복사·프로필 슬롯·명령 생성 추가. `check`에 번들 닫힘 검사 추가.
5. 가짜 HOME에서 Claude 새 세션으로 `/review upstream` 실행. 번들만으로 HTML 리포트 생성, `F-001` 1건(mid) 보고.
6. 모델이 존재하는 프로젝트 프로필을 "없다"고 보고. SKILL.md의 프로필 지시를 "첫 단계에서 Read로 읽고 `Profile:` 줄을 보고"로 강화한 뒤 재검증에서 올바르게 읽음.

## 발견 사항

- 번들 밖 링크는 전부 빌드 시점에 드러난다. 이식의 실제 작업량은 "링크 수"가 아니라 "프로젝트 고유 절의 수"다.
- 생성된 SKILL.md의 지시는 "찾아보라"로는 부족하다. 도구 호출을 명시하고 보고 줄을 요구해야 모델이 건너뛰지 않는다.
- 리포트 검증을 grep으로 흉내 내면 쉘의 라이선스 주석과 구간 표식이 오탐으로 잡힌다. 리포트 검사는 쉘 구간을 알고 있는 스크립트여야 한다.
- 리포트 자산(약 114KB)은 code-review와 technical-explanation 두 스킬에 각각 복사된다. 세 번째 소비자가 생기면 분리를 재검토한다.

## 현재 상태

`code-review` 번들은 닫혀 있고 Claude에서 동작을 확인했습니다. Codex에서의 `$code-review` 호출과 리포트 생성은 미검증입니다. 경로 조건 규칙은 아직 손으로 쓴 정책으로 남아 있습니다.
