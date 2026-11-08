---
title: "문서를 단일 원본으로 두고 스킬은 생성한다"
domain: [harness]
kind: decision
status: accepted
decision_date: "2026-11-08"
principle: "1. 원본은 하나, 나머지는 파생물"
related:
  - ../conventions/principles.md
  - 0002-copy-not-symlink-for-bundles.md
---

# 문서를 단일 원본으로 두고 스킬은 생성한다

## 배경

기준과 지침을 스킬 파일(`SKILL.md`)에 직접 쓰면 그 내용이 특정 런타임의 스킬 형식에 묶입니다. 형식이 바뀌거나 런타임이 바뀌면 내용을 옮겨 적어야 하고, 같은 규칙이 여러 스킬에 흩어져 서로 다른 시점에 갱신됩니다. socra-tutor-fe에서는 문서 frontmatter에서 스킬 어댑터를 생성하는 방식이 이 문제를 풀었습니다.

## 결정

`src/docs/`의 문서가 원본입니다. 스킬은 문서 frontmatter(`skill`, `skill_description`, `domain`, `kind`)에서 `build`가 생성합니다. `SKILL.md`에는 정책 본문을 쓰지 않고 "references를 읽고 따르라"만 씁니다. 전역 지침 `AGENTS.md`도 얇게 유지하고 상세는 문서로 넘깁니다.

## 고려한 대안

- **스킬을 원본으로 두고 문서를 생략**: 라우팅과 내용이 한 파일에 있어 간단하지만, 내용이 스킬 형식에 종속되고 문서 타입 체계(convention·guide·decision·history)를 가질 수 없습니다.
- **문서와 스킬을 따로 손으로 유지**: 두 곳이 어긋나는 시점이 반드시 옵니다.

## 영향

`build`와 `check` 스크립트가 필요합니다. 문서는 한 관심사만 다뤄야 번들 단위가 깨끗해집니다. 이 결정이 [복사 번들](0002-copy-not-symlink-for-bundles.md)과 [src/dist 분리](0003-src-dist-split.md)의 전제입니다.
