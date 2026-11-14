---
title: "설치와 로컬 설정"
domain: [harness]
kind: guide
status: current
related:
  - ../conventions/structure.md
  - ../decisions/0007-harness-owns-agent-settings.md
  - verification.md
  - agent-onboarding.md
  - ../troubleshooting/cli-entrypoint-realpath.md
---

# 설치와 로컬 설정

## 언제 쓰는가

새 머신에 하네스를 설치하거나 기존 에이전트 설정의 관리 주체를 하네스로 옮길 때 사용합니다. dotfiles는 필요하지 않습니다. 체크아웃 위치도 자유롭게 정할 수 있습니다.

## 절차

### 준비와 스킬 생성

Git과 Node.js 22.19 이상, npm의 `npx`를 준비합니다. external 설치에는 네트워크가 필요합니다. 스킬에서 사용하는 추가 CLI는 `harness.json`의 `tools`에 설치·확인 명령이 있습니다. 필요한 스킬에 맞춰 사용자가 직접 설치하며, 어느 설치 도구나 저장소를 사용하는지는 하네스 동작에 영향을 주지 않습니다.

```bash
git clone https://github.com/rheech22/harness.git
cd harness
node scripts/build.mjs
node scripts/add-external.mjs --all
node scripts/check.mjs
```

### 지침과 스킬 연결

필요한 프로필과 런타임을 선택합니다. 적용 옵션이 없으면 계획만 출력합니다. 기존 경로가 다른 파일을 가리키면 `link`는 덮어쓰지 않습니다. 기존 경로를 백업한 뒤 충돌을 해결하고 다시 실행합니다.

```bash
node scripts/link.mjs --profile common,writing --runtime claude,codex
node scripts/link.mjs --profile common,writing --runtime claude,codex --apply
```

### 설정 적용

Claude의 설정 원본은 `src/adapters/claude/settings.json`입니다. Codex는 `src/adapters/codex/hooks.json`의 훅 등록만 적용하며 `config.toml`은 변경하지 않습니다. 등록 경로·원본·로컬 관리 기록 위치는 각 `adapter.json`의 `targets`와 `configure`가 선언합니다.

```bash
node scripts/configure.mjs --runtime claude,codex
node scripts/configure.mjs --runtime claude,codex --apply
```

`--runtime`을 생략하면 `configure`를 선언한 어댑터 전체를 계획합니다. 일반 설정은 선언한 leaf 값만 관리합니다. 훅은 같은 이벤트·matcher에 속하더라도 command 항목별로 관리하므로, 앱이나 플러그인의 다른 훅을 보존합니다. 선언한 값이 기존의 다른 값과 충돌하면 적용을 중단하고 필드 이름을 알립니다. 로컬에서 바뀐 관리 값도 자동으로 덮어쓰지 않습니다. 이전 관리 훅의 command·옵션·matcher 변경과 로컬 삭제도 충돌로 처리합니다. 최초 도입에서도 같은 이벤트·matcher·명령의 옵션이 다르면 중복 등록하지 않고 멈춥니다. 하네스 원본에서 명령 자체가 바뀌고 로컬 항목이 이전 값과 새 원본 어느 쪽에도 맞지 않으면 후속 관계를 추측하지 않고 충돌로 처리합니다.

충돌 시에는 설정과 관리 기록을 쓰지 않습니다. 로컬 값을 원본에 반영하거나 관리 선언을 제거할지, 하네스 값을 적용할지 결정한 뒤 다시 계획합니다. 기존 관리 기록 삭제로 충돌을 우회하지 않습니다. 에이전트의 조사·선택·복구 절차는 [에이전트를 통한 하네스 도입](agent-onboarding.md)을 따릅니다.

`{{skillDistributionGuard}}`는 실제 체크아웃 경로의 실행 명령으로 변환합니다. 따라서 설정 원본에는 머신별 절대 경로가 들어가지 않습니다. 체크아웃을 옮긴 뒤에는 `link`의 기존 연결을 확인하고 `configure`를 다시 실행합니다.

이전 관리 값이 원본에서 제거되면 로컬에 같은 값이 남아 있는 경우에만 삭제합니다. 로컬에서 변경한 값은 보존하고 관리 대상에서 해제합니다. 원본을 `{}`로 비워도 외부 설정 전체를 지우지는 않습니다.

앱이 직접 수정하는 사용자 설정 파일은 symlink로 원본에 연결하지 않습니다. 설정 원본과 마지막 적용 값이 같으면 재적용은 파일을 쓰거나 백업을 추가하지 않습니다.

### 기존 설정 링크 이관

기존 settings가 dotfiles 등 다른 저장소의 symlink라면 일반 적용은 거절합니다. 계획을 검토한 뒤 이관 옵션을 명시합니다.

```bash
node scripts/configure.mjs --runtime claude --adopt-symlink
node scripts/configure.mjs --runtime claude --adopt-symlink --apply
```

이관은 symlink를 로컬 일반 파일로 교체하고 기존 대상 파일은 그대로 둡니다. 기존 내용과 링크 대상은 적용 전 백업에 남깁니다. 이전 저장소의 배포 선언도 제거해야 재설치 시 연결이 다시 만들어지지 않습니다.

관리 기록은 `~/.local/state/harness/<runtime>-settings.json`, 백업은 같은 디렉터리의 `backups/`에 둡니다. 이 파일들은 로컬 적용 이력이며 설정 원본이 아닙니다. 적용 결과에 백업 경로가 출력됩니다. 백업의 `before.json`은 원래 파일 내용·권한·symlink 대상을 포함합니다. 설정이나 관리 기록을 읽거나 쓰는 데 실패하면 적용을 중단하고, 쓰기 도중 실패하면 이전 파일을 복원합니다.

인증 정보·세션·캐시와 런타임이 기록하는 상태는 로컬에 유지합니다. 공용 설정 원본에 credential을 넣지 않습니다. 훅의 런타임 신뢰 절차는 [Codex 어댑터](../../../adapters/codex/README.md)를 확인합니다.

## 검증

```bash
node --test scripts/tests/*.test.mjs
node scripts/build.mjs
node scripts/check.mjs
node scripts/configure.mjs --runtime claude,codex
```

설정 적용 후 다시 계획을 출력했을 때 `changes`가 비고 `stateUpdate`가 false인지 확인합니다. `check`는 저장소 생성물의 정합성을 검사하며, 로컬 설정의 적용 상태는 `configure`가 확인합니다. 격리 시험은 `link`, `configure`의 `--home <임시 경로>`로 수행합니다. external 설치를 격리하려면 별도 체크아웃에서 HOME도 임시 경로로 지정합니다.

프로젝트 초기화는 `node scripts/init-project.mjs <dir>`를 사용합니다. 프로젝트 전용 지침·프로필·MCP는 프로젝트가 소유하고, 사용자 범위에 등록하는 공통 훅은 프로젝트 템플릿에서 중복 등록하지 않습니다. 예전에 생성한 프로젝트의 공통 훅 등록은 전역 적용을 확인한 뒤 제거합니다. `init-project`는 기존 파일을 덮어쓰지 않습니다.
