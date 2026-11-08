---
title: "커밋 메시지 프로젝트 프로필 (기본값)"
domain: [common]
kind: profile
status: current
related:
  - ../commit-messages.md
---

# 커밋 메시지 프로젝트 프로필 (기본값)

[커밋 메시지 작성 기준](../commit-messages.md)이 프로젝트마다 달라지는 값을 읽는 자리입니다. 프로젝트 저장소에 `docs/profiles/commit-messages.md`가 있으면 그 문서가 이 기본값을 대체합니다. 프로젝트 프로필은 아래 절 제목을 그대로 쓰고, 정하지 않은 절은 기본값을 따릅니다.

## scope 목록

프로젝트가 자기 디렉터리 구조에 맞춰 scope를 정합니다. scope는 "변경 이유가 속한 영역"이며 문서 종류나 파일 종류가 아닙니다. 기본값은 다음 세 가지 형태입니다.

| scope | 대상 |
| --- | --- |
| `<app>` | 앱 디렉터리 하나입니다. 모노레포면 앱 이름(예: `web`, `native`)을 그대로 scope로 쓰고, 앱의 `docs/`도 포함합니다. |
| `docs` | 루트 `docs/` 전체입니다. backlog, guide, history도 여기 속합니다. |
| `repo` | 루트 스크립트, workspace 설정, CI 설정처럼 어느 앱에도 속하지 않는 저장소 인프라입니다. |

에이전트 하네스(`AGENTS.md`, 런타임별 설정 디렉터리)를 별도 영역으로 다루는 프로젝트는 `harness` 같은 scope를 추가합니다. 목록에 없는 scope를 즉흥적으로 만들지 않고, 필요하면 이 표에 먼저 추가합니다.

## 이슈 참조 형식

기본값은 없음입니다. 이슈 추적기를 쓰는 프로젝트는 본문 마지막 줄에 둘 형식을 여기 적습니다. 예: `Fixes <TRACKER-KEY>` 또는 `Closes #<number>`. 형식을 정했으면 참조 줄을 `Co-Authored-By` trailer 앞에 둡니다.
