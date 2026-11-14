---
title: "문서 검수 프로젝트 프로필 (기본값)"
domain: [common]
kind: profile
status: current
related:
  - ../document-review-workflow.md
---

# 문서 검수 프로젝트 프로필 (기본값)

[문서 검수 워크플로우](../document-review-workflow.md)가 프로젝트마다 달라지는 값을 읽는 자리입니다. 프로젝트 저장소에 `docs/profiles/document-review.md`가 있으면 그 문서가 이 기본값을 대체합니다. 프로젝트 프로필은 아래 절 제목을 그대로 쓰고, 정하지 않은 절은 기본값을 따릅니다.

## queue 위치

`docs/backlogs/documentation-review.md`. 반복 검수의 inventory와 item 상태를 담는 backlog 문서 하나이며, 현재 cycle만 관리합니다. 다른 경로를 쓰면 여기서 바꿉니다.

## profile 분류 규칙

워크플로우의 profile 표에 문서를 배정하는 규칙입니다. 기본값은 다음과 같습니다.

| 조건 | profile |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | `adapter` |
| `README.md` | `current` |
| 문서 템플릿 디렉터리(기본값 `src/docs/templates/**` 또는 프로젝트의 `docs/templates/**`) | `template` |
| `kind: decision` | `decision` |
| `kind: backlog` | `backlog` |
| `kind: history` | `history` |
| 그 밖의 문서 | `current` |

프로젝트의 문서 검사가 이 규칙으로 queue의 profile 값을 검증할 수 있으면 그 명령을 공통 검증 명령 절에 적습니다.

## strict 등급 적용 대상

cross-app `contract`와 여러 구현 경계를 함께 설명하는 `architecture` 문서입니다. 기본값은 "contract 전부와, 두 개 이상의 앱·플랫폼 경계를 설명하는 architecture"이며, 프로젝트는 strict를 적용할 문서 경로나 glob을 여기 열거할 수 있습니다.

## 등급별 batch 상한

| 등급 | Batch 상한 |
| --- | --- |
| `light` | 10~20개 |
| `standard` | 3~5개 |
| `strict` | 1~2개 |

한 batch에는 같은 등급만 담습니다. 사용자가 위험을 확인하고 더 큰 batch를 명시적으로 선택할 수 있습니다.

## 공통 검증 명령

모든 batch에서 상태 전이 전과 후에 실행합니다.

```bash
<하네스의 check 또는 프로젝트의 문서 검사 명령>
git diff --check
```

기본값은 하네스의 `check`입니다. 프로젝트가 별도 문서 검사 명령을 두면 여기 바꿔 적습니다.

## 추가 검증

워크플로우의 변경별 검증 표에 보탤 프로젝트 고유 항목입니다. 기본값은 없음입니다. 예: 문서 사이트 빌드 명령, 특정 contract의 양쪽 구현 테스트 명령.

## 주기 기록 위치

`docs/history/documentation-review-cycle-<N>.md`. `<N>`은 현재 주기 번호입니다. 종료 요약만 두고 문서별 배치 로그는 옮기지 않습니다. 이 문서는 review inventory 대상에서 제외합니다.

## 자동 실행기 배정

기본값은 없음입니다. 예약 실행되는 자동 실행기가 queue를 처리하는 프로젝트는 다음 값을 정합니다.

- `batch`: 한 번에 claim할 item 개수. 등급별 batch 상한을 넘지 않습니다.
- `changedRatio`: 변경된 문서와 순환 검수 대상의 배정 비율. 변경되지 않은 문서도 순환 대상으로 유지합니다.
- `recoverClaims`: 종료가 확인된 이전 자동 실행의 `in_progress` claim을 현재 소스와 evidence에 대조해 이어갈지. 같은 작업의 프로세스·PR이 살아 있거나 소유권이 불명확하면 복구를 보류하고, 다른 수동 검수자의 claim은 자동으로 가져오지 않습니다. 복구한 claim의 run 식별자는 실행 보고에 남깁니다.
- `nextCycle`: `standard`·`strict` item이 모두 terminal state인 주기를 자동으로 닫고 다음 주기로 전환할지. 전환 전에 검증과 history 기록을 마치고, 증거 없이 `done`으로 바꾸거나 완료 기록을 덮어쓰지 않습니다.

구현과 설정 키의 실제 이름은 자동 실행기의 문서가 소유합니다.
