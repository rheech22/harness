---
title: "Storybook 프로젝트 프로필 (기본값)"
domain: [web]
kind: profile
status: current
related:
  - ../storybook.md
---

# Storybook 프로젝트 프로필 (기본값)

[Storybook 스토리 작성](../storybook.md)이 프로젝트마다 달라지는 값을 읽는 자리입니다. 프로젝트 저장소에 `docs/profiles/storybook.md`가 있으면 그 문서가 이 기본값을 대체합니다. 프로젝트 프로필은 아래 절 제목을 그대로 쓰고, 정하지 않은 절은 기본값을 따릅니다.

## 스토리 디렉터리와 prototype 경계

- production story 위치: `src/**/*.stories.tsx` (기본값)
- prototype 디렉터리: (없음). 예: `prototypes/**`. prototype 규칙 문서가 있으면 경로를 적습니다.

## title 그룹

- 기본 그룹: `Components/<이름>` (기본값)
- 출시 전 QA 그룹: (없음). 예: `QA/<기능>/<이름>`을 두고 preview의 `storySort`로 사이드바 맨 위에 정렬하며, 출시 후 `Components/<이름>`으로 옮깁니다.

## 뷰포트 옵션

제품의 폭 계약과 Storybook viewport option 이름입니다. 기본값은 모바일 우선 제품의 예시이며 프로젝트의 디자인 기준과 breakpoint에 맞게 바꿉니다.

- 최소 touch 폭: 320px
- 디자인 기준 폭: 360px
- 콘텐츠 컬럼 최대 폭: (없음)
- 구조가 바뀌는 breakpoint: (없음)

| 이름 | 크기 | 목적 |
| --- | ---: | --- |
| `touchMin` | 320×568 | 최소 touch 폭과 짧은 화면 |
| `designBase` | 360×800 | 디자인 기준 |
| `commonPhone` | 390×844 | 일반 phone |
| `tabletPortrait` | 768×1024 | 태블릿 세로 |
| `tabletLandscape` | 1024×768 | 태블릿 가로 |
| `desktopCanvas` | 1280×1024 | desktop |
| `pcWide` | 1920×1080 | 넓은 desktop |
| `browserLandscape` | 844×390 | 모바일 브라우저의 짧은 높이 대응 |

구조 breakpoint가 있으면 `<name>Below`(직전)와 `<name>Up`(활성화) 쌍을 추가합니다.

## 실행 컨텍스트 provider

runtime 분기(surface, OS, device class)를 story에 주입하는 provider와 override 방식입니다. 기본값은 없음입니다. 예: `RuntimeProvider`의 `override` prop.

## 테스트 tag

Storybook test 설정(`vitest.storybook.config.ts` 등)이 실행 대상으로 포함하는 tag 목록입니다. 기본값은 없음입니다. 접근성 브라우저 검증용 tag가 있으면 여기 이름을 적고 접근성 프로필의 테스트 tag와 일치시킵니다.

| tag | 용도 |
|---|---|
| (없음) | |

## 로컬 명령

| 단계 | 명령 |
|---|---|
| 통합 검사 | `pnpm check` (기본값) |
| static build | `pnpm build-storybook` (기본값) |
| interaction test | `pnpm test:storybook` (기본값) |

## 공용 harness 위치

두 곳 이상에서 반복되는 story harness를 승격하는 공용 라이브러리 경로입니다. 기본값은 `@/shared/lib/storybook`입니다.

## 현재 경계

- 설치된 addon: `addon-a11y` (기본값)
- visual regression: 없음 (기본값)
- CI에서 interaction test 실행 여부: 실행하지 않음, 로컬 명령으로 검증 (기본값). CI가 static build만 실행한다면 그 이유를 적습니다.

## 프레임 계약 예외

콘텐츠 컬럼 frame contract를 따르지 않는 full-width route와 그 story가 우선 확인할 viewport입니다. 기본값은 없음입니다.
