---
title: "문서 검수 워크플로우"
domain: [common]
kind: workflow
status: current
related:
  - documentation.md
  - document-writing.md
  - prose-style.md
  - profiles/document-review.default.md
---

# 문서 검수 워크플로우

## 목표

문서 검수는 문장을 매끄럽게 만드는 작업에 그치지 않습니다. 현재 source와의 사실 정합성, 문서 생명주기, 탐색성, source-of-truth 경계를 확인한 뒤 표현을 다듬습니다. 반복 검수는 queue 문서를 현재 queue로 사용합니다.

이 문서는 검수 방법과 품질 기준을 정의하고 프로젝트마다 달라지는 값은 정하지 않습니다. queue 파일 위치, profile 분류 규칙, 등급별 batch 상한, 공통 검증 명령, 주기 기록 위치, 자동 실행기 배정은 [프로젝트 프로필](profiles/document-review.default.md)이 정합니다. 절차를 따르다 프로필을 가리키는 자리를 만나면 그 문서에서 값을 읽습니다. 프로젝트에 프로필이 없으면 기본값을 씁니다.

## 검수 순서

### 1. 범위와 프로필 확인

대상 문서의 kind, status, source-of-truth 역할을 확인합니다. 수동 queue 실행이면 사용자가 지정한 batch 개수 안에서 `todo` 또는 `recheck` item을 선택합니다. 개수를 지정하지 않았다면 선택 전에 사용자에게 묻습니다. 자동 실행기의 사전 배정은 프로필의 자동 실행기 배정 절을 따릅니다.

| Profile | 적용 대상 | 사실 최신성 | 편집 검수 |
| --- | --- | --- | --- |
| `current` | contract, architecture, convention, guide, workflow, profile, troubleshooting, index, README | 현재 코드·계약·설정과 대조 | 제목, 구조, 문체, 링크, diagram |
| `decision` | decision | 결정 당시 context와 현재 status를 구분 | 대안, 이유, consequence 보존 |
| `backlog` | backlog | 계획 상태와 완료 여부를 확인 | problem, goal, non-goal, exit criteria |
| `history` | history | 현재 구현에 맞춘 freshness 검수 제외 | 당시 snapshot, 문체, 구조, 민감정보, 현재 SSOT 연결 |
| `adapter` | AGENTS, CLAUDE | 현재 routing과 client 동작을 확인 | thin adapter, SSOT link, 상세 정책 중복, client parity |
| `template` | 문서 템플릿 | frontmatter schema와 checker 호환성 확인 | type별 scaffold, 한국어 표기, 작성 기준 정합성 |

문서가 어느 profile인지는 source path와 frontmatter로 정합니다. 기본 분류 규칙과 프로젝트의 예외는 프로필의 profile 분류 규칙 절이 정하고, 프로젝트의 문서 검사가 같은 규칙으로 queue를 검증할 수 있습니다.

### 검수 등급

Profile마다 틀렸을 때 치르는 대가가 다릅니다. 계약 문서가 틀리면 양쪽 구현이 서로 다른 가정으로 구현하지만, 지난 작업을 적어 둔 기록 문서가 현재 코드와 어긋나는 것은 정상입니다. 그래서 모든 문서에 같은 강도를 요구하지 않습니다. 등급은 profile에서 기본값을 정하고 cross-app contract와 architecture에는 `strict`를 우선 적용하므로 queue에 따로 적지 않습니다. Batch 상한은 프로필의 등급별 batch 상한 절이 정합니다.

| 등급 | 대상 profile | 사실 검수 | 편집 완료 검수 |
| --- | --- | --- | --- |
| `light` | `history`, `backlog`, `template` | 당시 기록으로 맞는지와 대체 문서 연결만 확인 | coordinator 자체 확인으로 갈음 |
| `standard` | `current`, `decision`, `adapter` | 현재 코드·계약·설정과 대조 | 독립 reviewer 필요 |
| `strict` | cross-app contract, cross-app architecture | 아래 strict gate 절차 | 독립 reviewer 필요 |

`light` 등급은 독립 reviewer를 요구하지 않습니다. 기록 문서의 문장을 고치는 판단은 되돌리기 쉽고 틀렸을 때 영향이 그 문서 안에 머무르기 때문입니다. 다만 민감 정보 노출과 대체 문서 연결은 등급과 무관하게 확인합니다.

`light` 등급은 실행한 PR 또는 자동 실행기 보고에 아래 네 항목만 남깁니다. 같은 보고에는 `Writing gate: self-checked`와 최종 공통 검증 결과를 별도로 남깁니다. 나머지 문서별 evidence 항목은 `standard` 이상에만 요구합니다.

```text
Document:
Profile:
Result:
변경 요약:
```

### 2. 사실 검수

표현을 다듬기 전에 검증 가능한 claim을 source와 대조합니다.

- runtime behavior는 현재 code, test, public API를 확인합니다.
- contract는 계약 문서와 양쪽 구현을 확인합니다.
- command와 setup은 README, package manifest와 스크립트 정의, CLI source를 확인합니다.
- rationale은 ADR, history, 사용자 결정을 확인합니다.
- external fact는 공식 source를 우선합니다.

판정은 `verified`, `corrected`, `uncertain`, `snapshot`, `out_of_scope`로 구분합니다. `blocked`는 다음 중 하나가 문서의 truthful completion을 직접 막을 때만 사용합니다.

1. Source가 충돌해 현재 동작을 확정할 수 없습니다.
2. 사용자 결정 없이는 어느 설명도 사실이라고 할 수 없습니다.
3. 필수 검증 실패로 핵심 claim을 확인할 수 없습니다.

현재 구현의 결함이나 미확정 정책이 확인됐더라도 문서가 현재 상태를 정확히 설명할 수 있으면 `done`으로 처리합니다. 구현·정책 개선은 별도 backlog 또는 issue로 연결하며 문서 검수 blocker로 바꾸지 않습니다.

### 3. 편집 검수

[문서 작성 기준](document-writing.md)에 따라 제목, 독서 순서, link, diagram, code anchor를 검토하고, [산문 문체 기준](prose-style.md)에 따라 문장과 용어를 검토합니다. 사실 검수에서 확정되지 않은 내용을 더 단정적인 문장으로 바꾸지 않습니다.

이 단계의 finding은 초안 편집에 사용합니다. 모든 사실·생명주기·strict gate 수정이 끝난 뒤에는 [편집 완료 검수](#편집-완료-검수)를 별도로 통과해야 합니다.

### 4. 생명주기 검수

- current 문서에 완료된 migration이나 미확정 계획이 섞이지 않았는지 확인합니다.
- 완료된 backlog는 history, decision, current 문서로 책임을 이관할지 판단합니다.
- history는 현재 코드에 맞춰 다시 쓰지 않습니다.
- archived 문서는 대체 source-of-truth 링크를 유지합니다.
- `related`가 독자가 실제로 다음에 읽을 문서를 가리키는지 확인합니다.

### 5. 검증

모든 batch에서 프로필의 공통 검증 명령 절이 정한 명령을 실행합니다. 기본값은 하네스의 `check`와 `git diff --check`입니다.

Queue 상태를 바꾸기 전에 공통 검증을 통과해야 합니다. Selected item을 `done`으로 전환한 뒤 같은 명령을 fresh하게 다시 실행합니다. 상태 전이 전 결과는 최종 queue를 검증하지 않았으므로 이 사후 검증을 대신하지 않습니다. 전후 검증 결과는 실행한 PR 또는 자동 실행기 보고에 남깁니다.

변경에 따라 추가 검증을 실행합니다. 프로젝트 고유 검증은 프로필의 추가 검증 절이 보탭니다.

| 변경 | 검증 |
| --- | --- |
| 문서 사이트 navigation, Mermaid, generated page | 프로젝트의 문서 빌드와 browser 확인 |
| command/setup | 실제 command help, dry-run 또는 source 확인 |
| contract | 양쪽 구현과 payload/type 확인 |

검증하지 못한 핵심 claim은 완료로 처리하지 않습니다.

검증 실패는 source 문서 완료에 미치는 영향으로 구분합니다.

- **Completion blocker**: 공통 검증 실패, 깨진 link, contract 핵심 claim 미검증, 적용 대상 문서의 편집 완료 검수 미통과

## 관심사별 subagent 오케스트레이션

반복 검수에서는 독립적인 read-only 조사를 최대한 병렬화합니다. Subagent는 조사와 finding만 반환하며 문서와 queue를 수정하지 않습니다. Coordinator 한 명만 writer가 됩니다.

### 1차: 병렬 조사

- 사실 정합성
- 제목·링크·탐색성
- metadata·문서 생명주기
- diagram

### 2차: 병렬 리뷰

Coordinator가 사실 finding을 정리한 뒤 다음 검토를 실행합니다.

- 구조·문체
- source-of-truth 중복
- 최종 반대 검토

모든 reviewer는 다음 형식으로 결과를 반환합니다.

```text
Document:
Dimension:
Scope inspected:
Operations covered:
Sources checked:
Uninspected or assumed:
Severity:
Finding:
Evidence:
Confidence:
Recommended action:
Needs user decision:
```

`Uninspected or assumed`에는 조사하지 못했거나 source 확인 없이 가정한 범위를 적습니다. 해당하지 않으면 `none`으로 기록합니다. Coordinator는 중복 finding을 합치고, 근거 없는 finding을 버리고, 근거가 명확한 수정만 반영합니다. 여러 agent가 같은 backlog나 문서를 동시에 수정하지 않습니다.

## 계약과 앱 간 아키텍처 엄격 검수

Contract와 여러 구현 경계를 함께 설명하는 architecture는 일반 2-wave 검수 뒤에 strict gate를 추가합니다. 경계 문서는 행동 의미뿐 아니라 각 단계의 반환 type과 payload shape까지 정확해야 합니다.

### 1. 경계별 사실 조사

가능하면 서로 독립적인 reviewer가 각 구현 경계를 조사합니다.

- 호출 측 caller·consumer·type
- 수신 측 handler·service·platform adapter
- wire payload·callback·event·compatibility
- contract와 관련 ADR·test

각 핵심 claim의 evidence는 `file:line + symbol`로 기록합니다. 여러 플랫폼에 같은 이름의 symbol이 있으면 platform과 path를 생략하지 않습니다.

Coverage matrix를 만들기 전에 authoritative operation inventory를 고정합니다. registry·public type, event declaration, platform interface처럼 operation 전체를 열거하는 source를 `file:line + symbol`로 기록하고 matrix row와 1:1로 대조합니다. Inventory source가 여러 개면 합집합과 중복 제거 기준을 기록합니다.

Operation별로 다음 coverage matrix를 작성한 뒤 reviewer에게 inventory와 같은 scope를 전달합니다. 각 cell은 `file:line + symbol` 또는 근거가 있는 `N/A`여야 합니다. Inventory에 있지만 row가 없거나, 빈 cell 또는 확인되지 않은 가정이 있으면 strict review를 시작하지 않습니다.

| Operation | Caller·type | Helper·consumer result | Wire input·output·error | Handler·service | Platform adapter | Active callsite·flag | Direct test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<method 또는 event>` | `<evidence 또는 N/A>` | `<evidence 또는 N/A>` | `<evidence 또는 N/A>` | `<evidence 또는 N/A>` | `<evidence 또는 N/A>` | `<evidence 또는 N/A>` | `<evidence 또는 N/A>` |

Coverage matrix는 finding 목록이 아니라 조사 범위의 완료 증거입니다. Direct test가 없으면 `N/A`로 숨기지 않고 test 부재 evidence와 follow-up을 기록합니다. Coordinator의 coverage audit은 operation inventory와 row의 reconciliation, 필수 cell 존재, evidence 형식·provenance, `N/A` 근거, uninspected disclosure 확인으로 한정합니다. Source 의미 재검증은 fresh post-edit reviewer가 담당합니다.

### 2. 정밀 점검표

다음 항목을 행동 수준의 같은 결과로 합치지 않고 경계마다 확인합니다.

- input·output type과 payload shape
- `null`, optional, missing field
- enum, boolean, string처럼 다른 반환 표현
- error, exception, fallback, rejection
- platform별 정규화와 unsupported 상태
- feature availability와 version skew
- 실제 활성화 flag와 callsite
- state ownership, retry, queue, lifecycle

### 3. 수정 후 반대 관점 검수

Coordinator가 수정한 뒤 초기 조사와 분리된 fresh reviewer가 최종 문서와 실제 diff를 source에 다시 대조합니다. 원본 문서가 아니라 post-edit 상태를 검토해야 합니다.

- Medium 또는 High finding이 있으면 `done`으로 바꾸지 않습니다.
- Coordinator가 finding을 수정하고 strict review를 다시 실행합니다.
- Contract payload·return semantics에 영향을 주는 Low finding도 같은 correction loop에서 해결합니다.
- Fresh reviewer는 coverage matrix의 모든 operation과 boundary를 검사하고 `Uninspected or assumed: none`일 때만 `passed`를 반환합니다.
- 새 operation, method, event, inventory source, helper, consumer, callsite, platform adapter, fallback boundary가 발견되면 이전 `passed`를 무효화하고 inventory와 matrix를 확장한 뒤 전체 scope를 다시 검증합니다.
- Strict reviewer가 blocking finding을 반환하고 correction을 적용한 횟수를 correction loop로 계산합니다. 두 번째 correction 뒤에는 다음 fresh review 전에 coordinator가 전체 inventory와 matrix를 대상으로 integration scope audit을 실행합니다. Audit이 `blocked`이면 strict review를 실행하거나 item을 `done`으로 바꾸지 않습니다.
- 정책 결정이나 source 충돌 때문에 수정할 수 없으면 세 blocker 조건 중 하나를 명시하고 `blocked`로 둡니다.
- Subagent를 사용할 수 없으면 동일 checklist를 초기 조사와 분리된 순차 pass로 실행하고 그 한계를 evidence에 기록합니다.

Strict gate 결과는 실행한 PR 또는 자동 실행기 보고에 `Strict gate: passed | blocked`와 reviewer finding 요약으로 남깁니다. `passed` evidence 없이 contract 또는 cross-app architecture를 `done`으로 처리하지 않습니다.

## 편집 완료 검수

`standard`와 `strict` 등급의 사람이 읽는 문서는 사실·생명주기·strict gate 수정이 모두 끝난 최종 상태에서 편집 완료 검수를 실행합니다.

`light` 등급은 독립 reviewer 없이 coordinator가 직접 작성 기준에 대조하고 `Writing gate: self-checked`로 기록합니다. 이 등급에서 `self-checked`는 `passed`와 같은 효력을 가집니다.

문서를 수정한 coordinator와 다른 read-only reviewer가 최종 문서 전체를 [문서 작성 기준](document-writing.md)과 [산문 문체 기준](prose-style.md)에 대조합니다. Reviewer는 초기 편집 조사에도 참여하지 않은 사람을 우선합니다. 독립 reviewer를 사용할 수 없으면 `Writing gate: not-run`으로 기록하며 `passed`로 대체하지 않습니다.

Reviewer는 다음 절을 모두 확인합니다.

- [문서 제목](document-writing.md#문서-제목)
- [본문 작성 원칙](prose-style.md#본문-작성-원칙)
- architecture 문서의 [설명 순서](document-writing.md#architecture-설명-순서)
- [문체와 용어](prose-style.md#문체와-용어)
- [AI 문체 패턴과 처방](prose-style.md#ai-문체-패턴과-처방)
- [Detail과 Code Anchor](document-writing.md#detail과-code-anchor)
- [링크와 Source of Truth](document-writing.md#링크와-source-of-truth)
- diagram이 있는 문서의 [Diagram](document-writing.md#diagram)

편집 reviewer는 사실 조사 근거를 본문에 보존하는 것을 목표로 삼지 않습니다. 독자가 배경, mental model, 책임, 동작을 이해하는 데 필요하지 않은 상세 검증 근거는 실행한 PR 또는 자동 실행기 보고에 남기고 본문에서는 제거합니다. 사실 의미가 불명확하면 문장을 추측해 고치지 않고 coordinator에 돌려보냅니다.

```text
Writing gate: passed | self-checked | failed | not-run | not-applicable
Document:
Profile:
Sections checked:
Uninspected or assumed:
Findings:
Corrections required:
```

- `Sections checked`에는 적용 가능한 작성 기준 절을 모두 기록합니다.
- 적용 가능한 절을 확인하지 못했거나 `Uninspected or assumed`가 `none`이 아니면 `passed`로 판정하지 않습니다.
- 작성 기준을 위반한 제목, 독서 순서, 문장, 용어, anchor, link, diagram finding이 남아 있으면 심각도와 관계없이 수정한 뒤 편집 완료 검수를 다시 실행합니다.
- 작성 기준에 없는 개인적 선호는 권고로 남길 수 있지만 완료를 막지 않습니다.
- 편집 완료 검수 이후 frontmatter, 본문, link, anchor, 표, diagram을 수정하면 기존 `passed`를 무효화하고 최종 문서 전체를 재검토합니다.

`standard`와 `strict` 대상 문서는 `Writing gate: passed`, `light` 대상 문서는 `Writing gate: self-checked` 근거 없이 `done`으로 처리하지 않습니다. Strict gate 대상 문서는 strict gate와 편집 완료 검수를 모두 통과해야 합니다.

`failed`와 `not-run`은 queue의 `blocked` 상태가 아닙니다. 수정 가능한 finding은 `in_progress`에서 해결합니다. 검수를 완료하지 못한 채 batch를 중단하면 item을 `todo`로 반환합니다. 사실 확정이나 필수 검증이 불가능한 세 blocker 조건에 해당할 때만 queue item을 `blocked`로 바꿉니다.

## 대기열과 batch

### 자동 실행기 배정

자동 실행기(예약 실행되는 coordinator)가 queue를 처리하는 프로젝트는 프로필의 자동 실행기 배정 절이 정한 값으로 batch를 사전 배정합니다. 그 경우 아래 수동 배정의 "개수를 묻는" 절차는 설정값이 대신하지만, 사실 검수·strict gate·독립 편집 검수·상태 전이 전후 검증은 그대로 지킵니다. 설정에 없는 대상이나 제품 결정은 자동으로 추정하지 않고 보류 근거를 남깁니다. Batch 결과와 보류 이유는 자동 실행기 보고에 포함합니다. 대화에서 실행하는 수동 검수는 아래 절차를 그대로 유지합니다.

### 수동 배정

현재 queue는 프로필의 queue 위치 절이 정한 문서 하나만 사용합니다. 실행을 시작할 때 사용자가 batch 개수를 지정하지 않았다면 반드시 묻습니다. 사용자는 상황에 따라 1개, 3개, 10개처럼 원하는 개수를 선택할 수 있습니다.

선택 우선순위는 다음과 같습니다.

1. 사용자가 지정한 item
2. contract와 source-of-truth 충돌
3. current architecture, convention, guide, workflow, troubleshooting
4. active backlog와 decision
5. history와 낮은 위험 문서

대형 contract나 cross-app architecture는 사용자가 요청한 개수보다 작은 batch를 먼저 제안합니다. 기본 batch 상한은 검수 등급을 따르며 값은 프로필이 정합니다.

한 batch에는 같은 등급의 문서만 담습니다. 등급이 섞이면 낮은 등급 상한에 맞춰야 하므로 `light` 등급의 처리량 이점이 사라집니다.

사용자가 위험을 확인하고 더 큰 batch를 명시적으로 선택할 수 있습니다. 선택한 item은 먼저 `in_progress`로 claim하고, 상태 전이 전 검증 후에만 `done`으로 바꿉니다. `done` 전환 뒤에는 [검증](#5-검증)의 공통 명령을 fresh하게 다시 실행해야 완료가 확정됩니다.

검수 중 새 backlog나 decision 같은 supporting artifact를 만들 수 있습니다. Supporting artifact는 사용자가 요청한 selected item 개수에는 포함하지 않지만 inventory에 추가하고 별도 evidence와 검증 없이 `done`으로 처리하지 않습니다.

## 대기열 상태

```text
todo → in_progress → done | blocked | skipped
recheck → in_progress
in_progress → todo
done → recheck
blocked → todo
```

- `todo`: 선택 가능한 미검수 item
- `in_progress`: 현재 run이 claim한 item
- `done`: fresh verification까지 완료한 item
- `blocked`: 현재 사실을 확정하거나 필수 검증을 완료할 evidence, decision, dependency가 부족한 item
- `skipped`: scope 밖이거나 의도적으로 처리하지 않는 item
- `recheck`: 이전 검수가 완료됐지만 source나 검수 기준 변경으로 다시 검수해야 하는 item

검수 결과가 no-change여도 evidence와 verification이 있으면 `done`입니다. Completion blocker에 해당하는 필수 검증 실패나 batch 중단은 `done`으로 처리하지 않습니다.

확인된 구현 gap이 남아 있어도 현재 상태를 정확히 설명하고 필수 검증을 통과했다면 `done`입니다. Follow-up은 product/architecture backlog에 연결합니다.

Batch 시작 시 기존 `in_progress` item이 있으면 사용자에게 이어서 진행할지 claim을 `todo`로 release할지 묻습니다. 중단된 claim을 자동으로 완료하거나 다른 item보다 먼저 덮어쓰지 않습니다.

## 주기와 기록

Queue는 현재 cycle만 관리합니다. Cycle은 `standard`와 `strict` 등급 item이 모두 terminal state가 되면 닫습니다. `light` 등급은 inventory에 남아 계속 검수하지만 cycle을 열어 두지는 않습니다.

이렇게 나눈 이유는 처리량입니다. 모든 item을 요구하면 위험이 낮은 기록 문서가 cycle을 무기한 열어 두어, 정작 위험한 문서를 다 본 상태와 아직 안 본 상태를 구분할 수 없게 됩니다. Cycle이 닫힌다는 것은 "현재 상태를 서술하는 문서를 한 바퀴 확인했다"는 뜻이고, `light` 등급은 그와 별개로 여유가 있을 때 처리합니다.

Cycle을 닫을 때 다음을 수행합니다.

1. 기준 revision, 검수 범위와 완료·보류 결과를 주기 종료 요약으로 정리합니다. 상세 근거와 검증 결과는 실행한 PR 또는 자동 실행기 보고에 남깁니다.
2. 종료 요약만 프로필의 주기 기록 위치 절이 정한 history 문서에 보존하고 문서별 배치 로그는 옮기지 않습니다. 이 주기 요약 문서는 review inventory 대상에서 제외합니다.
3. 다음 cycle을 시작할지 사용자에게 묻습니다.
4. 시작한다면 inventory를 현재 source와 동기화하고 새 cycle 상태로 전환합니다.

자동으로 무한 반복하거나 완료 상태를 증거 없이 초기화하지 않습니다.

Cycle history를 작성한 뒤에도 공통 검증을 다시 실행해 inventory 예외와 문서 구조를 검증합니다.

## 보고

Queue와 cycle 기록 문서에는 배치 로그를 추가하지 않습니다. 검수 근거는 실행한 PR 또는 자동 실행기 보고에 남기며 수동 검수는 최종 응답에 보고합니다. 검수 중 별도로 만든 coverage artifact도 PR 또는 실행 증거에 두고 저장소 문서로 누적하지 않습니다.

Batch 종료 시 다음을 보고합니다.

- 요청한 개수와 실제 처리 개수
- 변경한 문서와 no-change 문서
- 사용한 사실 증거
- blocked 결정과 필요한 사용자 답변
- 남은 item과 다음 후보
- 실행한 검증과 결과

실행 보고에는 `standard`와 `strict` item의 문서별 evidence를 다음 형식으로 남깁니다. `light` item은 [검수 등급](#검수-등급)의 네 항목 형식을 사용하고 self-check와 최종 검증은 같은 실행 보고에 남깁니다.

```text
Document:
Profile:
Result: done | blocked | skipped | todo
Claims checked:
Operation inventory:
Coverage artifact:
Coverage revision:
Reviewed revision or diff:
Scope inspected:
Uninspected or assumed:
Fresh reviewer:
Integration scope audit: not-required | passed | blocked
Editorial reviewer:
Editorial revision or diff:
Editorial sections checked:
Editorial uninspected or assumed:
Editorial findings:
Editorial corrections:
Writing gate: passed | self-checked | failed | not-run | not-applicable
Evidence:
Corrections applied:
Open follow-ups:
Blocking reason:
Verification:
Strict gate: passed | blocked | not-applicable
```

`blocked` item에는 위 세 blocker 조건 중 어느 조건인지 명시해야 합니다. 동일한 외부 tooling 실패를 batch 전체의 blocker로 일괄 적용하지 않습니다.

보고 후 다음 batch를 계속할지 사용자에게 묻습니다.

## 관련 문서

- 문서 타입·배치·frontmatter·생명주기: [문서 컨벤션](documentation.md)
- 제목·anchor·링크 책임: [문서 작성 기준](document-writing.md)
- 문장과 용어: [산문 문체 기준](prose-style.md)
- queue 위치, batch 상한, 검증 명령, 기록 위치: [문서 검수 프로젝트 프로필 (기본값)](profiles/document-review.default.md)
