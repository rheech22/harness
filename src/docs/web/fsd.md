---
title: "FSD 아키텍처"
domain: [web]
kind: architecture
status: current
related:
  - profiles/fsd.default.md
  - ../common/code-style.md
  - accessibility.md
---

# FSD 아키텍처

이 문서는 Next.js App Router 프로젝트의 FSD(Feature-Sliced Design) 레이어, import 경계, public API 원칙을 정의합니다.

> **현재 상태(인벤토리)는 설정과 코드가 source of truth입니다.**
> - 레이어 alias: `tsconfig.json`
> - FSD 검사 범위와 예외: FSD 린터 설정 파일
> - framework entrypoint import guard와 정렬: ESLint 설정
> - 검사 명령과 설정 파일의 실제 위치: [프로젝트 프로필](profiles/fsd.default.md)
>
> 이 문서는 라이브러리나 예외의 완전한 목록을 유지하지 않습니다. 프로젝트마다 달라지는 디렉터리 트리, alias, 린터 설정 파일, custom rule, 검사 명령, 등록된 예외는 프로필이 정합니다.

> **관련 문서**
> - FSD 공식 문서: https://feature-sliced.design/kr/docs
> - 외부 의존성 격리 기준: [코딩 스타일](../common/code-style.md)

---

## 목차

1. [개요](#개요)
2. [디렉터리 구조](#디렉터리-구조)
3. [레이어 역할](#레이어-역할)
4. [분류 기준](#분류-기준)
5. [의존 규칙](#의존-규칙)
6. [Public API 규칙](#public-api-규칙)
7. [Cross-import 처리](#cross-import-처리)
8. [세그먼트와 네이밍](#세그먼트와-네이밍)
9. [Store · API · Action 배치](#store--api--action-배치)
10. [Import 경로 규칙](#import-경로-규칙)
11. [Lint 설정](#lint-설정)

---

## 개요

### 왜 FSD인가

FSD는 코드를 **레이어 → 슬라이스 → 세그먼트** 세 단계로 나눠 단방향 의존을 강제합니다. 명확한 배치 기준 덕분에 "이 파일이 어디 있어야 하지?"라는 질문에 답이 생기고, 변경 영향 범위를 예측하기 쉬워집니다.

### Next.js App Router와의 관계

FSD는 `app`, `pages`, `widgets`, `features`, `entities`, `shared` 레이어를 정의하고, Next.js App Router는 라우팅을 위해 프로젝트 루트의 `app/` 폴더를 사용합니다. 이름이 충돌하므로 다음과 같이 분리합니다.

| 폴더 | 역할 |
| --- | --- |
| `app/` | Next.js App Router 전용. FSD 레이어가 아닌 **framework entrypoint**. 화면은 `src/_pages/`로 위임하고 layout, route handler, metadata 등 Next.js 경계만 둠 |
| `src/app/` | FSD **app** 레이어. 전역 provider, 초기화, app 소유 조립 |
| `src/_pages/` | FSD **pages** 레이어. 화면 구현. import alias는 `@/pages/*` 유지 |
| `src/widgets/` ~ `src/shared/` | FSD 나머지 레이어 |

물리 폴더명 `_pages`는 Next.js 예약 디렉터리와 충돌을 피하기 위한 것이고, 레이어 이름과 alias는 `pages`를 유지합니다. 자세한 이유는 [Next.js 예약 디렉터리](#nextjs-예약-디렉터리)를 참고합니다.

```tsx
// app/account/page.tsx — 라우터 진입점 (얇음)
export { AccountPage as default } from "@/pages/account";
```

---

## 디렉터리 구조

```
<project>/
├── app/                  # Next.js App Router (라우터 전용)
│   └── ...라우트 세그먼트 파일
└── src/
    ├── app/              # FSD app 레이어
    ├── _pages/           # FSD pages 레이어 (alias: @/pages/*)
    ├── widgets/          # 재사용 가능한 독립 UI 블록
    ├── features/         # 사용자 액션, 유스케이스
    ├── entities/         # 비즈니스 엔티티
    └── shared/           # 도메인 무관 공용 기반
```

레이어 계층(위가 상위):

```
src/app/       (전역 초기화, 모든 레이어 참조 가능)
src/_pages/    (화면 구현, 하위 레이어 조합)
src/widgets/   (재사용 UI 블록)
src/features/  (사용자 액션)
src/entities/  (비즈니스 엔티티)
src/shared/    (공용 기반)
```

Next.js `app/`은 FSD 계층 외부에 있습니다. 화면 entrypoint는 `src/_pages/`에 위임하고, layout·route handler·Server Action 같은 framework 경계는 필요한 레이어의 public API만 조합합니다.

프로젝트의 실제 하위 폴더 목록은 [프로필의 디렉터리 구조](profiles/fsd.default.md)가 정합니다.

---

## 레이어 역할

### Next.js `app/` — framework entrypoint

Next.js App Router가 요구하는 entrypoint와 route-local framework adapter만 둡니다.

**둔다:**
- `page.tsx` — `src/_pages/`를 re-export하거나 호출
- `layout.tsx` — root layout은 `@/app`과 runtime-safe `shared` public API를 조합하고, route layout은 해당 `@/pages` public API도 조합할 수 있음
- `loading.tsx`, `error.tsx`, `not-found.tsx`
- `route.ts` (API route handler)
- `metadata`

**두지 않는다:**
- 재사용 가능한 비즈니스 로직, UI, Store
- `_components/`, `_hooks/`, `_stores/` 같은 구현 폴더

Route handler와 Server Action이 `cookies()`, redirect, request/response처럼 Next.js 경계를 직접 다루면 `app/`에 얇은 adapter를 둘 수 있습니다. 재사용 가능한 정책과 도메인 동작은 소유 레이어의 public API로 위임합니다.

---

### `src/app/` — FSD app 레이어

앱 전역에서 동작하는 환경 설정과 초기화 로직입니다. 기본은 슬라이스 없이 **세그먼트로만** 구성합니다. UI와 model을 함께 가져야 응집도가 높아지는 경우에는 관심사 폴더 내부에 함께 두는 것을 허용합니다.

```
src/app/
├── config.ts      # 전역 런타임 설정
├── initializers/  # 전역 side-effect 초기화
├── providers/     # 전역 Provider 조합
├── {관심사}/       # root layout에서 조합하는 app 소유 UI (관심사 내부에 store 동거 허용)
└── model/         # 특정 관심사에 속하지 않는 전역 Store
```

`app/layout.tsx`는 `@/app` public API로 app 소유 provider/initializer를 가져오고, `shared`가 소유하는 root renderer는 해당 라이브러리 public API에서 직접 가져와 mount하는 얇은 파일입니다.

```tsx
// app/layout.tsx
import "@/shared/styles/globals.css";
import { ToastContainer } from "@/shared/lib/toast";
import { GlobalInitializer } from "@/app";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <GlobalInitializer />
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
```

root에 한 번 mount되는 renderer라도 해당 관심사의 store/API와 항상 함께 변경된다면 해당 관심사를 다루는 모듈이 소유하도록 합니다. `app/layout.tsx`는 조립만 합니다.

---

### `src/_pages/` — FSD pages 레이어

화면 단위 구현입니다. `app/`의 `page.tsx`에서 호출됩니다.

```
src/_pages/
└── {slice}/
    ├── ui/
    │   └── {slice}-page.tsx
    ├── model/
    │   └── use-{slice}-page.ts
    └── index.ts
```

**두는 것들:** 해당 화면 전용 UI, 상태, 로직. 하위 레이어 조합.

**분리 기준:**
- 여러 화면에서 재사용되는 UI 블록 → `src/widgets/`
- 여러 화면에서 재사용되는 액션 → `src/features/`
- 이 화면에서만 쓰인다면 → `src/_pages/{slice}/` 내부 유지
- 소비자가 하나여도 슬라이스로 두어야 한다면 → [단일 사용 슬라이스 예외](#단일-사용-슬라이스-예외)

> 재사용 필요가 없는데 widget으로 추출하면 복잡도만 올라갑니다.

#### pages 슬라이스 이름

`src/_pages`는 top-level에서 **flat한 슬라이스 목록**을 두고 Next.js의 라우트 트리 구조를 그대로 따라가지 않습니다. URL 깊이는 `app/**` 라우트 트리에서만 표현하고, `{slice}`는 화면 또는 흐름 단위 이름으로 둡니다.

```
// 권장: flat 슬라이스
src/_pages/account-settings/
src/_pages/account-notifications/

// 비권장: 라우트 세그먼트를 그대로 따라간 구조
src/_pages/account/settings/
src/_pages/account/notifications/
```

URL prefix가 같다는 이유만으로 같은 슬라이스에 묶지 않습니다. 단, 여러 라우트가 하나의 wizard/흐름을 표현하고 layout, model, validation, navigation이 함께 변경된다면 하나의 흐름 슬라이스로 묶는 것을 허용합니다.

---

### `src/shared/` — 공용 기반

도메인과 무관하게 어디서든 쓰이는 기반 코드입니다. 슬라이스 없이 **세그먼트로만** 구성합니다.

```
src/shared/
├── api/        # 서버 API 클라이언트 (생성 산출물이면 직접 수정하지 않음)
├── config/     # 환경변수, 전역 Feature Flag
├── lib/        # 범용 라이브러리
├── mocks/      # mock 핸들러, 픽스처
├── styles/     # 전역 CSS
└── ui/         # 범용 UI 컴포넌트
```

> `shared`에 비즈니스 로직을 두지 않습니다. 도메인 의존이 생기면 `entities` 이상으로 옮깁니다.

외부 의존성의 격리 기준은 [코딩 스타일의 의존성 경계](../common/code-style.md)를 따릅니다. 예를 들어 UA 해석과 OS 분류는 실행 컨텍스트를 소유하는 `shared` 라이브러리가 맡고, 상위 레이어는 그 public API로 기기 정보를 읽어 자기 도메인의 표시·전송 규칙을 적용합니다.

---

### `src/entities/` — 비즈니스 엔티티

단일 도메인 개념을 표현합니다. 도메인 타입, mapper, formatter, validator, 단일 엔티티 표현 UI, 엔티티 조회 query hook 등이 포함됩니다.

`entities`는 접근성이 높은 레이어(`shared`를 제외한 모든 레이어가 참조 가능)이므로, 경계와 역할을 특히 명확하게 유지해야 합니다.

**원칙 1 — 없이 시작해도 됩니다**

`entities` 레이어는 필수가 아닙니다. 처음에는 `src/_pages/`나 `src/features/`의 `model/`에 로직을 두고, "여러 곳에서 재사용된다"가 명확해졌을 때 승격합니다.

**원칙 2 — 미리 잘게 나누지 않습니다**

항상 함께 변경되는 관련 개념은 여러 슬라이스로 쪼개지 말고 하나로 묶습니다.

```
// 비권장: 과도한 분리 — cross-import가 불가피해짐
entities/order/
entities/order-item/
entities/order-customer-info/

// 권장: 함께 움직이는 개념은 하나의 슬라이스로
entities/order-info/   ← order, order-item, customer-info를 캡슐화
```

**원칙 3 — CRUD는 `shared/api`에 둡니다**

단순 CRUD 호출은 비즈니스 의미가 크지 않아 `entities`에 쌓이면 중요한 도메인 로직이 묻힙니다. CRUD는 `shared/api`의 endpoint 단위에 두고, 재사용 가능한 비즈니스 로직만 `entities` 또는 `features`로 올립니다.

**원칙 4 — 인증 데이터는 `shared`에 둡니다**

토큰, 로그인 응답 DTO처럼 인증 컨텍스트에 종속된 데이터는 `entities/user`를 만들기보다 `shared/lib/auth`나 `shared/api`에 두는 것이 낫습니다. entity로 올리면 `@x` cross-import가 늘어나고 구조가 복잡해집니다.

---

### `src/features/` — 사용자 액션

사용자가 수행하는 구체적인 액션이나 유스케이스입니다. 상호작용 UI, mutation API 호출, 액션 단위 상태를 포함합니다.

**추출 기준:** 여러 페이지에서 **재사용**되는 기능일 때만 추출합니다. 단일 화면 전용 액션은 `src/_pages/{slice}/` 내부에 두는 것이 더 자연스럽습니다. 소비자가 하나여도 슬라이스로 두어야 하는 경우는 [단일 사용 슬라이스 예외](#단일-사용-슬라이스-예외)를 따릅니다.

> `features`가 너무 많아지면 중요한 기능이 어디 있는지 찾기 어려워집니다.

---

### `src/widgets/` — 재사용 UI 블록

여러 `shared`, `entities`, `features`를 조합하는 독립적인 대형 UI 블록입니다.

**추출 기준:** 여러 `src/_pages/` 슬라이스에서 **재사용**되거나, 독립적으로 동작하는 큰 UI 섹션일 때만 추출합니다.

> 재사용 없이 특정 화면에서만 쓰인다면 `src/_pages/` 내부에 두는 것이 더 자연스럽습니다.

---

## 분류 기준

어느 레이어에 둘지 판단이 필요할 때 다음 흐름을 따릅니다.

```
앱 전역 초기화, 전역 Provider, 전역 스타일인가?
  → YES → src/app/

이 화면에서만 쓰이는 화면 전용 구현인가?
  → YES → src/_pages/{slice}/

단일 엔티티 표현인가?
  → YES → src/entities/

여러 화면에서 재사용되는 사용자 액션인가?
  → YES → src/features/

여러 화면에서 재사용되는 큰 UI 블록인가?
  → YES → src/widgets/

도메인 없이 어디서든 쓰이는가?
  → YES → src/shared/
```

### 단일 사용 슬라이스 예외

재사용 기준은 기본값이며 대부분의 판단을 여기서 끝냅니다. 소비하는 슬라이스가 하나뿐인데도 `features`나 `widgets`로 두는 경우가 있습니다. 이 예외는 아래 세 조건을 **모두** 만족할 때만 인정합니다.

- **외부 계약을 소유합니다.** 서버 프로토콜, 플랫폼 API, 외부 스펙 중 하나를 이 슬라이스가 소유하고, 그 계약이 바뀌면 화면과 무관하게 이 슬라이스가 바뀝니다.
- **자족적인 어휘를 갖습니다.** 슬라이스 안의 여러 파일이 같은 도메인 용어를 공유하고, 그 용어는 슬라이스 밖에서 의미를 잃습니다.
- **세그먼트가 둘 이상입니다.** `ui`와 `model`·`lib` 중 하나를 함께 갖습니다. 한 세그먼트로 충분하면 슬라이스가 아니라 파일이며 소비하는 화면 안에 둡니다.

예외는 FSD 린터 설정 파일에 슬라이스별로 등록하고 사유를 주석에 적습니다. `fsd/insignificant-slice`가 등록되지 않은 단일 사용 슬라이스를 CI에서 잡습니다. 등록과 사유가 없으면 예외가 아니라 잘못 올린 것으로 봅니다.

다음은 예외에 해당하지 않습니다.

- 화면 레이아웃 파생. 무엇을 상단에 pin할지, 어떤 순서로 그릴지는 그 화면이나 그 화면이 쓰는 widget의 책임입니다.
- 한 화면의 제출, 토글, 단축 동작. 재사용 기준 그대로 `src/_pages/{slice}/`에 둡니다.
- 앞으로 다른 화면에서도 쓸 것 같다는 예상. 재사용은 두 번째 소비자가 실제로 생겼을 때 판정합니다.

예외로 만든 슬라이스가 세그먼트 하한 아래로 줄어들면 소비하는 화면으로 되돌립니다. 반대로 두 번째 소비자가 생기면 이미 재사용 기준을 만족하므로 등록을 지웁니다.

---

## 의존 규칙

레이어 간 의존 방향은 단방향입니다.

```
src/app → pages → widgets → features → entities → shared
```

Next.js `app/`은 FSD 계층 외부에 있습니다. 화면 entrypoint는 `src/_pages/` 또는 `src/app/`으로 위임하고, framework adapter는 필요한 하위 레이어의 public API를 참조할 수 있습니다.

조립할 내용이 없는 route layout이 하위 레이어 컴포넌트를 그대로 내보내는 경우, `src/app`을 거치게 만들지 않습니다. 그것은 [Public API 규칙](#public-api-규칙)이 금지하는 허브 barrel이 됩니다. 슬라이스 public API를 직접 참조합니다.

**허용:**

```
Next.js app/ → src/app | src/_pages | widgets | features | entities | shared
               (framework entrypoint와 adapter에서 public API만 참조)
src/app      → 모든 하위 레이어
src/_pages   → widgets | features | entities | shared
widgets      → features | entities | shared
features     → entities | shared
entities     → shared
shared       → shared (세그먼트 간 자유 참조)
```

**동일 레이어:**
- 같은 슬라이스 **내부** 참조는 자유
- 같은 레이어의 **다른 슬라이스** 참조는 원칙적으로 금지 → [Cross-import 처리](#cross-import-처리)
- `src/app/`과 `src/shared/`는 슬라이스가 없으므로 세그먼트 간 자유 참조

---

## Public API 규칙

슬라이스 외부에서의 참조는 반드시 `index.ts`를 통해서만 합니다. 슬라이스 public API는 **자기 슬라이스가 소유한 항목만** 노출합니다. 다른 레이어나 다른 슬라이스의 export를 다시 노출하는 허브 barrel은 만들지 않습니다.

```ts
// 허용
import { AccountPage } from "@/pages/account";
import { schoolService } from "@/entities/school";

// 금지: 내부 경로 직접 참조
import { AccountPage } from "@/pages/account/ui/account-page";

// 금지: pages public API가 widget을 대신 노출
import { AccountMenu } from "@/pages/account";
```

### pages 슬라이스는 named export만

`src/_pages/{slice}/index.ts`는 화면 컴포넌트를 **named export**로만 노출합니다. `export default`는 두지 않습니다. Next.js `default export` 요구는 `app/` 라우터에서 처리합니다.

```ts
// src/_pages/account/index.ts
export { default as AccountPage } from "./ui/account-page";

// app/account/page.tsx
export { AccountPage as default } from "@/pages/account";
```

슬라이스 내부 파일과 colocated test는 원칙적으로 **상대 경로**로 참조합니다. 기존 코드에 mock과 test를 위해 자기 슬라이스 public API alias나 alias deep import를 쓰는 legacy pattern이 남아 있을 수 있습니다. 새 test에는 이 legacy pattern을 적용하지 않으며, 현재 인벤토리는 코드와 config, 그리고 [프로필의 등록된 예외](profiles/fsd.default.md)가 소유합니다.

### shared의 public API 단위

`shared`는 슬라이스가 없는 라이브러리 컬렉션입니다. 전체를 하나의 barrel로 묶으면 일부 bundler에서 tree-shaking이 제한되고 runtime 경계가 섞일 수 있으므로, **라이브러리 단위**로 public API를 둡니다.

- `shared/ui/{component}/index.ts` — 컴포넌트 단위
- `shared/lib/{library}/index.ts` — 라이브러리 단위

```ts
// 허용: 라이브러리 단위
import { showToast } from "@/shared/lib/toast";
import Button from "@/shared/ui/button";

// 금지: 라이브러리 내부 파일 직접 참조
import { showToast } from "@/shared/lib/toast/store";

// 금지: 전체 barrel
import { Button } from "@/shared/ui";
```

새 `shared/ui/{component}/index.ts`는 component API에 맞는 dominant exposure를 선택합니다. Default 중심 API는 Vitest re-export 호환을 위해 import한 뒤 default로 내보내고, named 중심 API는 소유한 symbol을 named export합니다.

```ts
// 권장: default 중심
import Button from "./button";
export default Button;

// 권장: named 중심
export * from "./full-overlay";
```

### named/default 노출 방식

새 public API는 같은 implementation을 named와 default로 **동시에** 다시 노출하지 않습니다. 보조 symbol이 함께 필요할 수 있지만 implementation별 dominant exposure는 하나로 정합니다.

기존 API 중 같은 implementation을 named와 default로 함께 노출하는 surface만 legacy입니다. Default implementation과 별도의 auxiliary named symbol을 함께 노출하는 surface는 이 금지 대상이 아닙니다. 완전한 인벤토리는 코드가 소유하며, legacy API를 정리할 때는 같은 implementation의 consumer를 한 exposure로 함께 옮깁니다.

```ts
// 금지: 이중 노출
export * from "./full-overlay";
export { FullOverlay as default } from "./full-overlay";

// 권장: named-only
export * from "./full-overlay";

// 권장: default-only
import Button from "./button";
export default Button;
```

**이유:** 이중 노출은 안 쓰이는 쪽을 "사용되지 않는 public 표면"으로 남깁니다. knip이 named 또는 default를 unused로 잡는 false positive의 주요 원인이며, 실제로는 살아있는 export를 dead로 오인해 잘못 삭제할 위험을 만듭니다.

### 타입은 named type export로

직접 작성한 타입은 소유 슬라이스나 shared 라이브러리의 public API에서 named type으로 노출합니다. import 없이 쓰는 ambient namespace(`declare namespace`)로 전역에 두지 않습니다. 예를 들어 사용자 계정과 프로필 타입은 `@/entities/user` 같은 소유 슬라이스가 named type으로 노출합니다.

```ts
// 허용
import type { Profile } from "@/entities/user";

// 금지: 전역 namespace로 노출
declare namespace Model {
  interface Profile {}
}
```

예외는 서버 schema codegen이 만드는 namespace입니다. 어떤 namespace가 예외이고 generator가 어떤 수작업 파일을 참조하는지는 [프로필의 서버 API 클라이언트 산출물](profiles/fsd.default.md)이 정합니다.

`.ts` 파일의 namespace 선언은 ESLint `@typescript-eslint/no-namespace`가 막습니다. `.d.ts` 파일은 이 rule이 허용하므로 리뷰에서 확인합니다.

**이유:** ambient namespace는 import 없이 어디서든 참조할 수 있어 타입 소유자와 의존 방향이 코드에 드러나지 않습니다. 레이어 의존 규칙도 import를 기준으로 검사하므로 이 참조를 잡지 못합니다.

### runtime 경계가 다른 public API

Next.js App Router에서는 import 그래프가 server/client/runtime 경계를 결정합니다. 넓은 barrel이 server-only, browser-only, client hook 모듈을 re-export하면, 실제로 해당 export를 사용하지 않아도 Turbopack이 모듈을 평가하면서 빌드가 실패할 수 있습니다.

따라서 runtime 경계가 다른 코드는 범용 barrel에 섞지 않습니다. `shared`에 남길 정도로 범용인 경우에만 관심사별 라이브러리 내부에 다음과 같이 reserved subpath를 둘 수 있습니다. FSD 린터의 public API 검사는 `shared/lib/{library}/client|server`, `shared/ui/{component}/client|server`, `shared/mocks/client|server`의 정확한 경로만 추가로 exempt합니다.

- `client` — Next.js client 그래프에서만 import하는 API
- `server` — Server Component, route handler, test node setup 등 server/node 그래프에서 import하는 API

깊이는 최대 한 단계입니다. 그 외 내부 경로 import는 린터가 보고하면 수정해야 하는 public API 우회입니다. 현재 source에 unregistered sidestep이 남아 있을 수 있지만 의도적 예외로 취급하거나 문서화하지 않으며, 현재 violation 인벤토리는 lint output과 코드가 소유합니다.

Framework/root/test entrypoint에는 ESLint 경계가 추가됩니다. 이 범위에서 `@/shared/ui/{component}/...`는 `client`와 `server`를 포함해 모두 금지되므로 `@/shared/ui/{component}` main public API를 사용해야 합니다. `shared/lib` reserved subpath는 ESLint가 별도로 금지한 library가 아닌 경우에만 사용할 수 있습니다.

```ts
// 허용: reserved subpath
import { getRequestLocale } from "@/shared/lib/i18n/server";
import { startMocking } from "@/shared/mocks/client";

// 금지: 라이브러리 내부 파일 직접 참조
import { clearCookies } from "@/shared/lib/auth/clear-cookies";

// 금지: 임의 깊이의 subpath
import { something } from "@/shared/lib/auth/constants";
```

특정 `app` initializer나 `feature` 액션의 구현 세부라면 shared로 승격하지 않고 소유 레이어 내부에 둡니다. Hook이라는 구현 형태만으로 `shared/lib/react-hooks` 같은 bucket을 만들지 않습니다. Hook도 숨기는 책임에 따라 `gesture`, `form` 같은 라이브러리 안에 둡니다.

### 슬라이스 내부에서는 상대 경로

슬라이스 내부 파일이 같은 슬라이스의 다른 파일을 참조할 때는 상대 경로를 씁니다. `index.ts`를 통해 자기 자신을 import하면 순환 참조가 생깁니다.

```ts
// 허용
import { useSendMessage } from "../model/use-send-message";

// 금지
import { useSendMessage } from "@/features/send-message";
```

---

## Cross-import 처리

같은 레이어의 다른 슬라이스를 참조하는 것은 **안티 패턴**입니다. 발생 시 다음 전략을 따릅니다.

**전략 A — 슬라이스 병합** 두 슬라이스가 항상 함께 변경된다면 하나로 합칩니다.

**전략 B — 공유 로직을 하위 레이어로** 여러 슬라이스가 같은 도메인 로직을 공유한다면 `entities`로 내립니다.

**전략 C — 상위 레이어에서 조립 (권장)** 슬라이스끼리 직접 참조하는 대신, `src/_pages/`나 `src/app/`에서 조합합니다. Render props나 Context로 의존성을 주입하는 IoC 패턴을 활용합니다.

```tsx
// 권장: pages에서 조합
export function PostPage() {
  return (
    <CommentList renderAvatar={(userId) => <UserAvatar userId={userId} />} />
  );
}
```

**전략 D — 검사 예외를 국소화** 즉시 제거할 수 없는 same-layer import는 public API만 참조하고, FSD 린터 설정 파일에서 해당 파일이나 슬라이스에만 예외를 둡니다. 예외 사유와 제거 조건을 config 주석에 기록합니다.

### 임시 예외

지금 당장 어렵다면 callsite의 `TODO(fsd)`와 린터 설정의 국소 예외를 함께 남깁니다.

```ts
// TODO(fsd): same-layer import — extract shared logic to entities/session
import { useSessionStatus } from "@/widgets/session-overlay";
```

별도 backlog나 migration 문서가 제거 작업을 추적한다면 config 주석에서 그 문서로 연결합니다.

---

## 세그먼트와 네이밍

### 세그먼트

| 세그먼트 | 역할 | 포함하는 것 |
| --- | --- | --- |
| `ui/` | UI | 컴포넌트, 스타일 |
| `model/` | 비즈니스 로직 | Store, 상태, 검증, 도메인 함수 |
| `api/` | API 요청 | query hook, mutation hook, fetcher |
| `lib/` | 보조 코드 | 슬라이스 전용 유틸리티 |
| `config/` | 설정 | Feature Flag, 슬라이스 전용 상수 |

> 세그먼트가 무분별하게 늘어나지 않도록 `stores/`, `utils/`, `helpers/`, `services/` 같은 이름은 피합니다.

### 파일·폴더 네이밍

| 대상 | 규칙 | 예시 |
| --- | --- | --- |
| 파일, 폴더 | `kebab-case` | `send-message-form.tsx` |
| 컴포넌트 export | `PascalCase` | `SendMessageForm` |
| 변수, 함수 | `camelCase` | `handleSubmit` |
| 상수 | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE` |

타입 접두사(`IFoo`, `TBar`)나 세그먼트명을 파일 이름에 강제(`ui.tsx`)하지 않고, 내용을 기반으로 이름을 짓습니다.

### 모호한 파일명 지양

세그먼트는 유지하되, 그 안의 파일명은 관심사를 드러내야 합니다. `types.ts`, `utils.ts`, `helpers.ts`, `constants.ts` 같은 일반적인 이름은 단일 관심사 안에서만 제한적으로 사용합니다.

```ts
// 비권장: 여러 관심사가 섞임
model/types.ts
lib/utils.ts

// 권장: 관심사가 드러남
model/session-overlay-state.ts
lib/logger-sanitizer.ts
```

참고: https://feature-sliced.design/kr/docs/guides/issues/desegmented

---

## Store · API · Action 배치

### Store

Store는 관심사 본체가 속한 레이어의 `model/`에 둡니다.

| 관심사 | 위치 |
| --- | --- |
| 전역 Store 초기화, Provider 설정 | `src/app/model/` |
| app 소유 전역 관심사 상태 | 관심사 폴더 내부 (`src/app/{관심사}/{관심사}-store.ts`) |
| 공용 UI primitive 상태 | 소유 라이브러리 내부 (`src/shared/lib/{라이브러리}/`) |
| 화면 단위 상태 | `src/_pages/{slice}/model/` |
| 단일 엔티티 상태 | `src/entities/{slice}/model/` |
| 기능 단위 상태 | `src/features/{slice}/model/` |
| 화면 조합 상태 | `src/widgets/{slice}/model/` |

Next.js `app/`(라우터)에는 Store를 두지 않습니다. `src/shared/model` 같은 전역 model bucket도 만들지 않습니다.

### API와 hook

서버 schema에서 생성한 API 클라이언트 산출물은 `src/shared/api/`에 둡니다. 직접 수정하지 않습니다. 생성기가 쓰는 런타임 helper는 `src/shared/api/runtime/`처럼 산출물과 분리된 폴더에 둡니다. 생성 스크립트, 템플릿, 수작업 보조 파일의 소유자는 [프로필의 서버 API 클라이언트 산출물](profiles/fsd.default.md)이 정합니다.

Query hook과 mutation hook은 책임 중심으로 배치합니다.

| 책임 | 위치 |
| --- | --- |
| 엔티티 조회/표현 중심 | `src/entities/{slice}/api/` |
| 사용자 액션 중심 | `src/features/{slice}/api/` |
| 화면 전용 데이터 패칭 | `src/_pages/{slice}/api/` |
| 화면 조합 중심 | `src/widgets/{slice}/api/` |

### Server Action

재사용 가능한 Server Action 동작은 관심사 레이어의 `api/` 또는 `model/`이 소유합니다. Next.js request primitive나 route 전용 redirect를 조합하는 얇은 action adapter는 `app/`에 둘 수 있습니다.

---

## Import 경로 규칙

### Alias

FSD 레이어 alias는 레이어마다 하나씩 둡니다.

```json
{
  "paths": {
    "@/app": ["./src/app/index.ts"],
    "@/app/*": ["./src/app/*"],
    "@/pages/*": ["./src/_pages/*"],
    "@/shared/*": ["./src/shared/*"],
    "@/entities/*": ["./src/entities/*"],
    "@/features/*": ["./src/features/*"],
    "@/widgets/*": ["./src/widgets/*"]
  }
}
```

> `@/app/*`는 `src/app/`(FSD app 레이어)입니다. Next.js `app/`(라우터)과 혼동하지 않습니다. Next.js `app/` 파일은 alias 없이 프레임워크가 직접 처리합니다.

전역 `@/*` alias는 사용하지 않습니다. FSD 레이어 밖 root alias는 정적 자산과 Next framework entrypoint처럼 명시적으로 허용한 경로만 추가합니다. 프로젝트가 허용한 root alias 목록은 [프로필의 레이어 alias](profiles/fsd.default.md)가 정합니다.

### Next.js 라우터와 root 파일 import 정책

Next.js `app/`과 워크스페이스 root 파일은 FSD 레이어가 아니라 framework entrypoint입니다.

- `app/**/page.tsx`는 `@/pages/*`를 re-export하거나 호출하는 얇은 파일로 유지합니다.
- `app/not-found.tsx`처럼 사용자 화면 성격이 있는 파일의 구현은 `src/_pages`에 둡니다.
- `app/layout.tsx`의 app 소유 조립 대상은 `@/app` public API로 import합니다. 전역 style과 runtime-safe renderer는 소유한 `shared` public API에서 직접 가져올 수 있습니다.
- `app/robots.ts`, `app/api/**`, route-local action, `proxy.ts`, `instrumentation*.ts` 같은 framework entrypoint는 runtime-safe public API를 import할 수 있습니다. 생성된 API endpoint는 endpoint별 entry를 직접 사용합니다. 프로젝트가 framework entrypoint로 취급하는 root 파일의 전체 목록은 [프로필](profiles/fsd.default.md)이 정합니다.
- Framework entrypoint가 `features` 같은 관심사 레이어를 참조해야 하면 슬라이스 public API만 사용하고, route adapter 밖의 동작은 해당 슬라이스가 소유합니다.

### Next.js 예약 디렉터리

FSD 공식 Next.js 가이드는 App Router를 쓸 때도 FSD pages 레이어를 `src/pages`에 두고, 프로젝트 루트에 빈 `pages/` 폴더를 추가해 Next.js가 `src/pages`를 Pages Router로 탐지하지 않게 하는 방식을 안내합니다. 이 방식은 채택하지 않습니다.

이유:
- Next.js는 `./pages`, `./src/pages`, `./app`, `./src/app`을 예약 디렉터리로 탐지하고, `app/`과 `src/pages/`가 동시에 있으면 `pages and app directories should be under the same folder` 빌드 에러가 납니다.
- 루트 `pages/` placeholder로 위 에러는 피해도, Next 16에서 빈 `pages` 디렉터리가 빌드 실패를 일으키는 사례가 보고됨 (https://github.com/feature-sliced/documentation/issues/874).
- `pages` 디렉터리가 존재하면 `next-env.d.ts`에 `next/navigation-types/compat/navigation` 참조가 생성되어 `usePathname()`, `useSearchParams()`가 nullable 타입으로 바뀝니다.

따라서 물리 폴더는 `src/_pages/`를 사용하고, FSD 용어와 alias만 `@/pages/*`로 유지합니다. `next-env.d.ts`를 재생성했을 때 `next/navigation-types/compat/navigation` 참조가 없어야 정상입니다.

`_pages`의 선행 underscore는 Steiger가 지원하는 FSD 레이어 prefix 규칙을 활용하기 위한 것입니다. Steiger는 `_pages`를 `pages` 레이어로 인식하지만 `screens` 같은 임의 레이어 alias는 지원하지 않습니다. 단, `fsd/typo-in-layer-name` 규칙은 prefix를 제거하지 않아 `_pages`를 오타로 보고할 수 있어 비활성화합니다. FSD lint는 `src/_pages` 단독이 아니라 `src` 루트 기준으로 실행해야 레이어 관계를 올바르게 판단할 수 있습니다.

### "use client" 경계

`"use client"`는 디렉터리 단위가 아니라 파일 단위 지시어입니다.

- `useState`, `useEffect`, `useRef`, `useRouter`, 클라이언트 store hook, browser API를 직접 쓰는 파일에 선언합니다.
- `app/{route}/page.tsx`는 얇은 re-export만 유지하고, client/server 여부는 실제 구현 파일이 선언합니다.
- Server Component, server action, route handler가 import하는 public API barrel에는 client-only hook, browser-only API, server-only API를 섞지 않습니다.
- `next/headers`, `cookies()`를 사용하는 server-only 모듈은 shared에 남길 만큼 범용일 때만 `server` reserved subpath에서 노출합니다.
- `window`, `document`, DOM 제어, `msw/browser`는 `client` reserved subpath에서만 노출합니다.
- `core`, `platform` 같은 mixed barrel은 두지 않습니다.

### Import 정렬 순서

`eslint-plugin-simple-import-sort` 기준으로 자동 정렬됩니다. 그룹은 type, 외부 모듈, style·asset, `shared`, `entities`, `features`, `widgets`, 나머지 app·pages·root alias·상대 경로 순으로 둡니다. 같은 그룹 안의 세부 순서는 plugin이 정합니다.

```ts
import type { Foo } from "some-lib";        // 1. type

import { something } from "external-lib";    // 2. 외부 모듈

import styles from "./component.module.css"; // 3. 스타일/자산

import { Button } from "@/shared/ui/button"; // 4. shared

import { schoolService } from "@/entities/school"; // 5. entities

import { signInAction } from "@/features/onboarding"; // 6. features

import { SideDrawer } from "@/widgets/side-drawer";    // 7. widgets

import { GlobalInitializer } from "@/app";   // 8. app·pages·root alias·상대 경로
import { AccountPage } from "@/pages/account";
import { helper } from "../lib/helper";
```

---

## Lint 설정

### Steiger

FSD 레이어 의존 규칙을 강제하는 공식 아키텍처 린터입니다. `src` 루트를 대상으로 실행하며, 설정 파일은 upstream recommended config에 프로젝트의 public API wrapper와 파일별 예외를 합성합니다. Config는 의도적 rule exception을, lint output과 코드는 현재 violation을 소유하므로 이 문서에 완전한 목록을 복제하지 않습니다. 설정 파일 이름, 검사 명령, 프로젝트가 추가한 wrapper rule은 [프로필](profiles/fsd.default.md)이 정합니다.

주요 규칙:

| 규칙 | 설명 |
| --- | --- |
| `fsd/forbidden-imports` | 상위 레이어 import, 동일 레이어 cross-import 금지 |
| `fsd/no-public-api-sidestep` | public API 우회 금지. 프로젝트는 이 규칙을 wrapper로 감싸 `src/**`에서 exact shared reserved subpath(`client`/`server`)만 추가로 exempt합니다 |
| `fsd/insignificant-slice` | 참조가 없거나 하나뿐인 슬라이스 금지. 의도적 예외는 [단일 사용 슬라이스 예외](#단일-사용-슬라이스-예외)를 따라 config에 등록합니다 |

public API 우회 검사의 wrapper는 `src/**`에서 `@/shared/lib/{library}/client|server`, `@/shared/ui/{component}/client|server`, `@/shared/mocks/client|server`와 정확히 일치하는 reserved subpath만 추가로 exempt합니다. 그 외 sidestep은 rule이 보고하면 고쳐야 하며, source에 남아 있다는 이유로 예외가 되지 않습니다.

> **의도적 규칙 예외와 사유는 린터 설정 파일의 인라인 코멘트가 source of truth입니다.** 현재 violation은 lint output과 코드에서 확인하며 이 문서는 완전한 목록을 유지하지 않습니다. 새 예외를 추가할 때는 config 코멘트에 사유를 함께 적습니다.

### ESLint Import Guard

Steiger는 `src` 내부만 검사하므로, ESLint의 `no-restricted-imports`로 Next 라우터·root·test entrypoint의 일부 public API 우회를 보완합니다. 이 guard는 Steiger와 같은 범용 검사가 아니라 config에 등록된 정규식만 검사합니다.

대상:
- `app/**/*.{ts,tsx}`
- 프로젝트가 framework entrypoint로 정한 root 파일(`proxy.ts`, `instrumentation*.ts` 등)
- `tests/**/*.{ts,tsx}`

금지하는 패턴:
- config에 등록된 `shared/lib` 라이브러리의 내부 deep import
- `@/shared/ui/{component}/...`의 모든 deep import (`client`·`server` 포함)
- `@/{entities,features,widgets,pages}/{slice}/{ui,model,lib,api,config}/...` 세그먼트 내부 deep import

허용 예외:
- 생성된 API endpoint의 endpoint별 public entry는 deep import로 사용합니다. 경로는 프로필이 정합니다.
- `shared/ui` component는 deep subpath 예외가 없습니다. 위 entrypoint에서는 main `@/shared/ui/{component}` public API를 사용합니다.
- `tests/**`는 root에 유지합니다. proxy, mock setup, API integration 테스트가 framework/root entrypoint를 직접 검증하기 때문이며, 동일한 import guard를 적용합니다.

외부 package 경계도 같은 rule로 막습니다. 접근성 primitive 라이브러리처럼 `shared/ui`의 wrapper를 거쳐야 하는 package는 `src/**`(`src/shared/ui` 제외)와 위 entrypoint에서 직접 import할 수 없습니다. 어떤 package가 대상인지는 [프로필의 외부 package 경계](profiles/fsd.default.md)가, 경계의 근거는 [웹 접근성 기준](accessibility.md)이 정합니다.

> 구체 패턴 목록과 추가 예외는 ESLint config의 `no-restricted-imports` 정의에서 확인합니다.
