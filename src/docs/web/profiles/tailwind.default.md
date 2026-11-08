---
title: "Tailwind CSS 프로젝트 프로필 (기본값)"
domain: [web]
kind: profile
status: current
related:
  - ../tailwind.md
---

# Tailwind CSS 프로젝트 프로필 (기본값)

[Tailwind CSS 규칙](../tailwind.md)이 프로젝트마다 달라지는 값을 읽는 자리입니다. 프로젝트 저장소에 `docs/profiles/tailwind.md`가 있으면 그 문서가 이 기본값을 대체합니다. 프로젝트 프로필은 아래 절 제목을 그대로 쓰고, 정하지 않은 절은 기본값을 따릅니다.

## 현재 구성

- Tailwind 버전: v4 CSS-first (기본값)
- CSS entrypoint: `src/shared/styles/globals.css` (기본값)
- token 파일: (없음). color, typography, spacing, radius, shadow, z-index, animation, breakpoint token 파일을 나열합니다.
- Tailwind 기본 theme 제거(`--*: initial`) 여부: 아니오 (기본값). 지웠다면 token 파일에 정의한 값만 utility로 쓸 수 있다고 적습니다.
- class merge helper: `cn` from `@/shared/lib/classnames` (기본값)
- lint plugin: `eslint-plugin-better-tailwindcss` (기본값)
- Tailwind lint entrypoint: CSS entrypoint와 동일 (기본값)

## 토큰 소유 문서

token의 실제 값 카탈로그와 컴포넌트 목록, Storybook 인덱스를 소유하는 디자인 시스템 문서의 경로입니다. 기본값은 없음입니다. Figma stroke가 gradient인지 판단하는 기준도 이 문서가 소유합니다.

## 반응형 breakpoint와 구조 분기

- 정의된 breakpoint 이름: Tailwind 기본 `sm`, `md`, `lg`, `xl`, `2xl` (기본값)
- 앱 셸 구조 분기가 일어나는 breakpoint: (없음)
- 치수 조정에만 쓰는 breakpoint: (없음)

## 프로젝트 정의 variant와 custom utility

- custom variant: (없음). 예: hover와 active를 함께 다루는 `hover-or-active`.
- custom utility: (없음). 예: `z-overlay-*`, `keyboard-aware-fixed`, `scrollbar-none`, `gradient-border-*`.
- lint ignore에 등록한 utility: (없음)

## 검증 명령

| 검사 | 명령 |
|---|---|
| lint (Tailwind class warning 포함) | `pnpm lint` (기본값) |
| type check | `pnpm exec tsc --noEmit` (기본값) |

## 후속 작업 조건

반복되는 arbitrary value, 새 token category, variant helper 도입, lint exception 확대처럼 현재 작업 범위를 넘는 항목을 기록하는 위치입니다. 기본값은 없음입니다. 예: `docs/backlogs/tailwind-token-hardening.md`.
