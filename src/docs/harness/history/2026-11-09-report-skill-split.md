---
title: "리포트 생성 분리와 채팅 우선 흐름 (2026-11-09)"
domain: [harness]
kind: history
status: current
related:
  - 2026-11-08-code-review-port.md
  - 2026-11-08-full-port.md
---

# 리포트 생성 분리와 채팅 우선 흐름 (2026-11-09)

## 요약

`code-review`와 `technical-explanation`이 각자 품고 있던 HTML 리포트 생성을 `html-report` 스킬 하나로 떼어냈습니다. 두 스킬은 결과를 채팅에 먼저 전달하고, 리포트는 사용자가 원할 때만 `html-report`를 로드해 만듭니다. 같은 변경에서 `technical-explanation`을 `explain`으로 바꿨습니다.

## 시간 순서

1. `technical-explanation`을 `explain`으로 이름을 바꿨다. 문서, 프로필, 선언, `harness.json`의 profiles·publish를 함께 옮겼고 명령 `/explain`은 그대로다.
2. `docs/common/html-report.md`를 새로 썼다. 코드 리뷰 문서의 HTML 리포트 계약·검증 절과 기술 설명 문서의 산출물 작성·다이어그램·퀴즈·저장·검증 절을 옮겨 두 종류(`review`, `explanation`)의 조립 계약으로 정리했다. `report-diagrams.md`는 `writing`에서 `common`으로 옮겼다.
3. 리포트 자산 8파일과 검사 스크립트 2편을 `html-report` 선언으로 옮기고, `code-review`·`explain` 선언에서는 비웠다. 두 스킬의 `reads`는 자기 워크플로우와 `prose-style.md` 둘로 줄었다.
4. 프로필을 다시 나눴다. 저장 경로, 표제 문구, 리포트 이후 처리는 `html-report.default.md`가 갖고, `code-review`·`explain` 프로필에서는 뺐다.
5. 두 워크플로우의 절차 끝을 "채팅 요약 → 다음 행동 묻기"로 바꿨다. 코드 리뷰는 지적 반영 승인과 리포트 여부를, 기술 설명은 리포트 여부를 묻는다. 승인 전에는 코드를 바꾸지 않는다.

## 발견 사항

- 리포트 자산이 두 번들에 복사되던 문제는 소비자가 하나가 되면서 사라졌다. 이전 기록이 "세 번째 소비자가 생기면 분리를 재검토"라고 적었지만, 흐름을 바꾸는 시점에 함께 분리하는 쪽이 더 자연스러웠다.
- 기술 설명 문서의 상당 부분은 HTML에만 해당하는 규칙(절 ID, 목차, 퀴즈 payload, checker)이었다. 떼어내자 설명 문서는 서사와 근거 규칙만 남아 채팅에도 그대로 적용된다.
- 생성된 `SKILL.md`의 프로필 보고 줄은 base ref를 전제했다. `html-report` 프로필에는 base ref가 없어 "프로필이 정한 경우에만"으로 문구를 고쳤다.

## 현재 상태

`html-report`는 `common` 프로필에 속하고 `explain`은 `writing` 프로필에 남았다. 새 흐름의 실제 호출 검증(채팅 요약 뒤 `html-report` 로드까지)은 이 기록 시점에 수행하지 않았다.
