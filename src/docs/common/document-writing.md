---
title: "문서 작성 기준"
domain: [common]
kind: convention
status: current
related:
  - prose-style.md
  - documentation.md
  - document-review-workflow.md
  - report-design.md
---

# 문서 작성 기준

## 적용 범위

이 문서는 저장소 문서의 제목, 설명 순서, diagram, code anchor, 링크 책임을 정의합니다. 문서 타입·위치·frontmatter·생명주기는 [문서 컨벤션](documentation.md)을 따릅니다. 완료 전 검수 절차는 [문서 검수 워크플로우](document-review-workflow.md)를 따릅니다.

본문 서술, 문체, 용어, AI 문체 교정은 [산문 문체 기준](prose-style.md)이 소유합니다. 그 기준은 저장소 문서와 저장소가 생성하는 HTML 리포트에 같은 내용으로 적용하므로 산출물 형식과 함께 두지 않고 따로 뒀습니다. 리포트의 구조와 조립은 [리포트 디자인](report-design.md)이 소유합니다. 이 문서가 정의하는 제목, code anchor, 링크 규칙은 저장소 문서에만 적용합니다.

## 문서 제목

`title`은 페이지 제목이며 본문 `# H1`과 같아야 합니다. 제목만 보더라도 대상과 역할을 파악할 수 있게 작성합니다.

- 한글을 우선합니다. FSD, WebView, RPC처럼 정착된 약어와 고유명사는 English를 유지합니다.
- `가이드`, `구조`, `문서`처럼 역할만 나타내는 단어보다 대상을 함께 적습니다.
- 문서 사이트의 navigation label을 따로 두는 프로젝트는 상위 group이 이미 제공하는 문맥을 label에서 반복하지 않습니다. 페이지 제목을 억지로 줄이지 말고 navigation에서만 축약합니다.

## Architecture 설명 순서

Architecture 문서는 구현 목록보다 구조가 필요한 이유, 책임 경계, 불변식, 런타임 흐름을 중심으로 설명합니다. 다음 순서는 권장 독서 흐름이며 작은 문서는 절을 합칠 수 있습니다.

1. **배경**: 어떤 제품 행동이나 문제가 이 구조를 필요로 하는지 설명합니다.
2. **Mental Model**: 처음 읽는 사람이 전체 구조를 나눠 볼 수 있는 기준을 제공합니다.
3. **책임과 경계**: 각 계층이 소유하는 것과 소유하지 않는 것을 구분합니다.
4. **상태와 흐름**: 요청·응답·상태 전이·복구처럼 시간에 따라 일어나는 동작을 설명합니다.
5. **규칙과 예외**: 현재 동작과 앞으로도 지켜야 할 invariant를 구분합니다.
6. **관련 문서**: 세부 source of truth, ADR, troubleshooting, history를 연결합니다.

화면이나 사용자 행동과 연결되는 구조는 제품 용어에서 시작해 code identifier로 내려갑니다. 코드 symbol부터 나열한 뒤 독자가 제품 동작을 추론하게 하지 않습니다.

## Detail과 Code Anchor

문서는 자기 목적과 비슷한 속도로 변하는 정보에만 강하게 결합해야 합니다. 빠르게 바뀌는 leaf detail을 source-of-truth 문서에 과도하게 적으면 리팩터링마다 stale해집니다.

Anchor는 다음 순서를 우선합니다.

1. public API 또는 package entry
2. 안정적인 symbol, 함수, hook
3. directory 또는 glob
4. leaf file path
5. line number

- 책임·계약·불변식·데이터 흐름·정책처럼 잘 변하지 않는 이유는 자세히 적어도 됩니다.
- leaf path가 꼭 필요하면 왜 안정적인 anchor로 대체할 수 없는지 확인합니다.
- `history`와 `backlog`는 특정 시점 snapshot이므로 당시 leaf path를 적을 수 있습니다.

## 링크와 Source of Truth

- source-of-truth 내용을 다른 문서에 복사하지 않고 링크합니다.
- 링크는 단순 연관 파일 목록이 아니라 독자가 다음에 확인할 책임과 이유를 설명해야 합니다.
- current 문서는 현재 source of truth를 가리키고, history와 backlog는 현재 상태를 설명하는 문서로 연결합니다.
- 같은 사실을 여러 current 문서가 소유하지 않도록 책임을 분리합니다.
- link target뿐 아니라 heading anchor와 링크가 가리키는 의미도 확인합니다.

## Diagram

- diagram은 복잡한 관계나 시간 흐름을 단순화할 때 사용합니다.
- diagram 없이도 중요한 배경과 이유를 본문에서 이해할 수 있어야 합니다.
- 본문과 diagram은 같은 개념에 같은 용어를 사용합니다.
- edge 방향, participant, state transition은 실제 동작과 일치해야 합니다.
- Mermaid에는 내용을 설명하는 `accTitle`과 `accDescr`를 둡니다.
- 문서가 실제로 렌더링되는 곳(문서 사이트, 저장소 뷰어)에서 그려지는지 확인하고, 너무 큰 diagram은 책임이나 흐름 단위로 분리합니다.

## 관련 문서

- 본문 서술·문체·용어: [산문 문체 기준](prose-style.md)
- 문서 타입·배치·metadata: [문서 컨벤션](documentation.md)
- 검수 절차와 반복 queue: [문서 검수 워크플로우](document-review-workflow.md)
- HTML 리포트의 구조와 조립: [리포트 디자인](report-design.md)
- 새 문서 scaffold: `src/docs/templates/`의 타입별 템플릿
