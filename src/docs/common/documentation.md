---
title: "문서 컨벤션"
domain: [common]
kind: convention
status: current
related:
  - document-writing.md
  - prose-style.md
  - document-review-workflow.md
  - ../templates/convention.md
  - ../templates/guide.md
  - ../templates/decision.md
  - ../templates/history.md
  - ../templates/backlog.md
---

# 문서 컨벤션

이 문서는 문서의 타입, 위치, metadata, source-of-truth, 생명주기를 정의합니다. 제목·diagram·anchor 기준은 [문서 작성 기준](document-writing.md), 본문과 용어 기준은 [산문 문체 기준](prose-style.md)을 따릅니다. 완료 전 검수와 반복 review queue 운영은 [문서 검수 워크플로우](document-review-workflow.md)를 따릅니다.

## 문서 타입

문서 타입은 frontmatter의 `kind`로 적습니다.

- `contract`: 여러 앱/시스템이 함께 지켜야 하는 cross-boundary 약속을 다룹니다. 저장소 최상위 레벨 전용으로 취급하고 문서를 수정할 때 계약이 깨지는 것에 유의해야 합니다.
- `architecture`: 구조와 설계, 그리고 그 구조를 정의하는 규칙을 다룹니다. 시스템에 대한 이해를 돕는 목적으로 작성합니다.
- `convention`: 구조 위에서 적용하는 cross-cutting 규칙을 다룹니다. 코딩 스타일, 문서 규칙, 네이밍 등 규칙을 안내하는 목적으로 작성합니다.
- `guide`: 특정 작업을 수행하는 방법, 절차를 안내합니다.
- `workflow`: 에이전트가 반복 실행하는 절차와 품질 기준을 정의합니다. 프로젝트마다 달라지는 값은 `profile`로 뺍니다.
- `profile`: `workflow`나 `convention`이 읽는 프로젝트별 값을 절 제목 단위로 담습니다. 하네스가 기본값을 두고 프로젝트가 같은 절 제목으로 덮어씁니다.
- `decision`: 기술적인 의사결정과 trade-off를 기록합니다.
- `history`: 문제 해결 과정, migration, 완료된 backlog, 과거 맥락을 보존합니다. 폐기된 문서는 `status: archived`로 구분합니다. 현재 구현에 맞추기 위한 freshness 갱신 대상은 아닙니다. 어디까지 검수하는지는 [문서 검수 워크플로우](document-review-workflow.md)의 `history` profile을 따릅니다.
- `backlog`: 아직 실행 또는 결정되지 않은 계획을 다룹니다. 어떤 백로그는 영영 진행되지 않을 수 있습니다. 비교적 가볍게 취급합니다.
- `troubleshooting`: 반복되는 증상, 진단, 해결, 재발 방지 대책을 기록합니다.
- `index`: 문서 탐색을 위한 README 또는 목록 문서를 둡니다.

`architecture` vs `convention`: 구조를 정의하는 규칙(예: layer/import 규칙)은 그 구조와 분리할 수 없으므로 `architecture`에 두는 것이 낫습니다. 구조와 무관하게 어디서나 지키는 관행(예: 스타일링 유틸리티 사용 규칙)은 `convention`입니다. 한 문서가 지배적으로 한 성격이면 통째로 그 타입으로 분류하고 문서를 쪼개지 않습니다. 규칙이 여러 문서에 흩어져 있을 때만 `convention`으로 이전하고 원 문서는 링크합니다.

중요한 architecture 선택, 경쟁하는 대안 사이의 trade-off, public API나 cross-app contract 변경, 반복해서 설명하는 결정은 `decision` 문서를 제안합니다. 명백한 구현, 일회성 prototype, routine maintenance에는 ADR을 만들지 않습니다. 앱 문서를 수정할 때는 대상 앱의 `README.md`와 문서 index, 현재 source-of-truth 문서를 함께 읽습니다.

더 이상 source of truth가 아닌 문서는 `history/`에 두고 `status: archived`로 표시합니다. 대체 문서가 있으면 링크를 남깁니다.

## 배치 규칙

- 여러 앱에 걸친 계약은 최상위 레벨의 `contracts/`에 둡니다. 앱 레벨에는 두지 않습니다.
- 여러 앱에 걸친 시스템 구조·정책은 최상위 레벨의 `architecture/`에 둡니다.
- 앱 전용 구현 세부는 그 앱의 `docs/`에 둡니다.
- 진행 중 계획은 `backlogs/`에, 완료·폐기된 문서는 `history/`에 둡니다(폐기는 `status: archived`).
- 한 시스템이 여러 앱과 server에 걸치면 앱 레벨로 쪼개지 말고 최상위 레벨에 한 문서로 두고 각 앱 index에서 링크합니다.
- 운영(외부 서비스·CI·배포) 문서는 `guide` 타입으로 `guides/`에 두고 제목이나 index에서 운영 문서임을 드러냅니다.

### 가이드의 절차와 실행 기록

가이드는 다음 실행에도 사용할 사전 조건, 절차와 성공 판정 기준을 설명합니다. 운영 검증 항목도 어떤 행동을 수행하고 무엇을 관찰해야 하는지 안내하면 가이드에 둘 수 있습니다.

- 재사용할 체크리스트나 기록 양식은 가이드에 둘 수 있지만, 특정 배포의 미완료 체크박스나 확인 대기 표로 사용하지 않습니다.
- 실행별 담당자, 기기·빌드, 확인일, 결과와 근거는 배포 PR이나 별도 운영 기록에 남깁니다. 가이드는 기록할 항목과 기록 위치를 안내합니다.
- 아직 실행하거나 결정하지 않은 계획은 백로그가 소유합니다. 구현 완료 뒤에도 반복할 운영 확인은 가이드에 절차로 남기고, 특정 실행의 대기 상태와 구분합니다.
- 가이드를 검수할 때는 검증 절차와 기대 결과가 구체적인지, 특정 실행의 진행 상태를 담고 있지 않은지 확인합니다. 절차를 작성했다는 이유로 실기기 확인이나 배포가 완료됐다고 설명하지 않습니다.

## 디렉터리 구조

type-driven하게 폴더를 구성합니다. 즉 폴더는 문서의 타입과 1:1로 맞춥니다. 폴더명이 곧 문서 타입이라, 폴더만 보고 다른 종류로 오해할 여지를 없앱니다. 토픽(예: operations)은 폴더로 표현하지 않습니다.

- 문서 루트 아래에는 도메인 축(예: `common/`, `web/`, 또는 모노레포의 앱)이 먼저 오고, 그 아래에 타입 축(`conventions/`, `guides/`, `decisions/`, `history/`, `backlogs/`, `troubleshooting/`, `architecture/`)이 옵니다. 두 축을 한 층에 섞지 않습니다.
- 타입 폴더의 scope는 레벨이 결정합니다. 최상위 레벨은 cross-app, 앱 레벨은 각 앱 전용입니다.
- `contracts/`는 정의상 cross-app이라 최상위 레벨에만 둡니다.
- 타입 폴더는 내용이 없어도 구조 일관성을 위해 비워 둘 수 있습니다(`.gitkeep`).
- `README.md`(index)와 시작 안내 문서는 폴더 분류에서 제외되는 최상위 진입 파일입니다.
- 각 폴더의 인덱스인 `README.md`는 고유 콘텐츠(로컬 인덱스, naming·status 규칙, 템플릿 맵 등)가 필요한 경우에만 둡니다. 기본적으로는 자체 인덱스를 두지 않고 문서 루트의 index를 진입점으로 씁니다. 따라서 폴더 인덱스의 유무가 폴더마다 다른 것은 정상입니다.
- `profile` 문서는 소속 도메인의 `profiles/`에 두고, 프로젝트가 덮어쓰는 파일은 프로젝트 저장소의 `docs/profiles/<name>.md`에 둡니다.

## 템플릿

새 문서는 하네스의 `src/docs/templates/`에 있는 타입별 템플릿을 사용합니다.

- `convention`: [`convention.md`](../templates/convention.md)
- `guide`: [`guide.md`](../templates/guide.md)
- `decision`: [`decision.md`](../templates/decision.md)
- `history`: [`history.md`](../templates/history.md)
- `backlog`: [`backlog.md`](../templates/backlog.md)

템플릿이 없는 타입(`contract`, `architecture`, `workflow`, `profile`, `troubleshooting`)은 가장 가까운 템플릿의 frontmatter를 쓰고 `kind`만 바꿉니다. `workflow`는 이미 포팅된 워크플로우 문서를, `profile`은 같은 도메인의 `profiles/*.default.md`를 본보기로 삼습니다.

## Frontmatter

새 문서는 YAML frontmatter를 사용합니다. 필드는 다음 다섯 개가 기본이며 타입별 추가 필드 외의 키는 두지 않습니다.

```md
---
title: "..."
domain: [common]          # 소속 도메인 목록
kind: contract | architecture | convention | guide | workflow | profile | decision | history | backlog | troubleshooting | index
status: draft | current | deprecated | archived | proposed | accepted | superseded
related:
  - <상대 경로>          # 다음에 읽을 문서. 비어 있으면 []
---
```

타입별 추가 필드는 다음과 같습니다.

```md
waiting: decision | evidence | manual   # backlog 전용, 선택
decision_date: "YYYY-MM-DD"             # decision 전용, 필수
principle: "..."                        # decision 전용, 어느 원칙에서 나온 결정인지
```

`decision_date`는 `decision` 타입 문서에만 사용하며 결정을 내린 날짜를 기록합니다. `principle`도 `decision` 전용이며 결정이 어느 원칙에서 나왔는지 적습니다. 다른 타입에는 넣지 않습니다.

`waiting`은 `backlog` 문서가 사람을 기다리는 동안에만 둡니다. `decision`은 제품·정책·계약 결정, `evidence`는 콘솔·실기기·운영 결과처럼 저장소 밖의 확인, `manual`은 사람이 직접 진행 중인 작업을 기다린다는 뜻입니다. 무엇을 정하거나 확인해야 하는지는 본문의 `미결 질문` 절에 적습니다. 백로그에서 작업 후보를 고르는 자동 실행기는 `waiting`이 있는 백로그를 고르지 않으므로, 답을 적거나 작업을 마치면 필드를 지웁니다. 상태 값을 `status`에 넣지 않는 이유는 `status`가 모든 문서 타입이 공유하는 생명주기이고, 초안이면서 결정을 기다리는 경우처럼 두 축이 겹치기 때문입니다.

`last_updated` 같은 수동 날짜 필드는 쓰지 않습니다. 수동 날짜는 쉽게 stale해지고, 갱신 이력은 git이 소유합니다.

일반 문서는 `draft`, `current`, `deprecated`, `archived`를 사용합니다. `decision`은 의사결정 lifecycle을 나타내기 위해 `proposed`, `accepted`, `superseded`, `deprecated`를 사용할 수 있습니다. Decision 상태는 frontmatter 한 곳에서 관리하며 본문에 별도 status를 중복하지 않습니다.

`title`과 본문 `# H1`은 항상 같은 값으로 맞춥니다.

`related`는 단순 연관 목록이 아니라 독자가 다음에 읽을 문서입니다. 비어 있어도 되지만, 적은 경로는 존재해야 합니다. 스킬 정보는 frontmatter에 두지 않습니다. 어느 문서가 어느 스킬에 들어가는지는 스킬 선언이 소유하며, 그 규칙은 [스킬 규칙](../harness/conventions/skills.md)이 정합니다.

`AGENTS.md`와 각 앱의 `README.md`는 이 frontmatter schema와 폴더 분류 밖에 있습니다. 검수할 때 `AGENTS.md`는 [문서 검수 워크플로우](document-review-workflow.md)의 `adapter` profile을, 각 앱의 `README.md`는 `current` profile을 따릅니다.

## Source-of-truth 규칙

- `contract`, `architecture`, `convention`, `guide`, `workflow`, `profile`, `decision`, `troubleshooting`, `index`는 각 문서 목적의 source of truth가 될 수 있습니다.
- `history/`와 `backlogs/` 폴더에 있는 문서는 source of truth가 아닙니다. 폴더가 그 역할을 드러내므로 별도 필드를 두지 않으며, 예외를 두는 수단도 없습니다.
- source of truth 문서가 있으면 중복 설명보다 링크를 우선합니다.
- 문서를 `status: archived`로 내리거나 source of truth에서 내릴 때는 대체 문서 링크를 남깁니다.

## 자동 검사

하네스의 `check`와 프로젝트의 문서 검사가 이 문서의 규칙 중 상당수를 강제합니다. 검사기가 보는 대표 항목은 다음과 같습니다. 자동 검사가 닿지 않는 나머지는 [문서 검수 워크플로우](document-review-workflow.md)에서 사람이 확인합니다.

- frontmatter 필수 필드, `kind`와 `status`의 허용값, `decision` 타입의 `decision_date`와 decision 전용 status, `backlog` 타입의 `waiting` 허용값
- 폴더와 `kind`의 일치. 폴더 인덱스인 `README.md`는 `kind: index`여야 합니다. 템플릿 폴더만 예외로 폴더가 아니라 파일명에 `kind`를 맞춥니다.
- `title`과 본문 `# H1`의 일치. `decision` 문서는 본문에 `## 상태`나 `## Status` 절을 따로 두지 않아야 합니다.
- markdown link target과 `related` 경로의 존재. inline code로 적은 경로와 heading anchor는 검사하지 않습니다.
- `status: current`인 `contract`, `architecture`, `convention`, `guide` 문서가 다른 문서에서 링크되는지 여부. `related` frontmatter도 유입 링크로 인정하며 `README.md`는 검사에서 제외합니다.
- `decisions/`의 파일명 `NNNN-kebab-case.md` 형식. 번호는 도메인 안에서 이어 붙입니다.
- `.gitkeep`은 폴더가 비어 있을 때만 허용합니다. 문서가 들어오면 함께 제거합니다.

## 문제 해결 기록

비자명한 trouble(bug, 장애, 빌드/테스트 실패)을 root cause까지 해결했다면, 사용자가 명시적으로 요청하지 않아도 troubleshooting 문서를 작성하거나 갱신합니다. 디버깅 워크플로우의 종결 단계가 이 기록을 트리거합니다.

작성 기준은 다음 셋을 모두 충족할 때입니다. 노이즈를 막기 위한 조건입니다.

- 재발 가능성이 있습니다. 같은 함정에 다시 빠질 수 있습니다.
- root cause가 비자명했습니다. 증상과 원인이 멀거나 직관에 반했습니다.
- 진단에 의미 있는 시간과 탐색이 들었습니다.

사소한 오타·1줄 수정·자명한 fix는 기록하지 않습니다. 같은 증상의 문서가 이미 있으면 새로 만들지 말고 갱신합니다. 위치는 해당 scope의 `troubleshooting/`에 `kind: troubleshooting`으로 둡니다(증상→진단→해결→재발 방지).

## 관련 문서

- 제목·설명 순서·anchor·링크 책임: [문서 작성 기준](document-writing.md)
- 본문 서술·문체·용어: [산문 문체 기준](prose-style.md)
- 검수 절차와 반복 queue: [문서 검수 워크플로우](document-review-workflow.md)
- 스킬 선언과 문서의 관계: [스킬 규칙](../harness/conventions/skills.md)
