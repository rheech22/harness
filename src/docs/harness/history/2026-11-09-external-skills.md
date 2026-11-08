---
title: "외부 스킬 설치 경로 (2026-11-09)"
domain: [harness]
kind: history
status: current
related:
  - 2026-11-09-report-skill-split.md
  - ../conventions/skills.md
---

# 외부 스킬 설치 경로 (2026-11-09)

## 요약

`harness.json`의 `external`에 선언만 돼 있던 스킬 넷(ast-grep, ast-grep-outline, find-skills, excalibridge)을 실제로 `dist/skills/`에 설치했습니다. 설치 자리를 정하는 `.agents/skills → dist/skills` 링크, Skills CLI를 감싸는 `scripts/add-external.mjs`, lock과 선언의 정합을 보는 `check` 항목을 함께 추가했습니다.

## 시간 순서

1. 임시 디렉터리에서 `.agents/skills`가 심링크일 때 Skills CLI가 링크를 따라가 실제 디렉터리에 쓰고 `skills-lock.json`을 루트에 남기는 것을 확인했다.
2. 레포 루트에 `.agents/skills → ../dist/skills` 링크를 만들어 커밋했다.
3. `scripts/add-external.mjs`를 추가했다. `external[name]`의 upstream을 `npx skills add <repo> -s <name> -a codex -y`로 설치하고, 설치 뒤 `dist/skills/<name>/SKILL.md`와 레포 안에 생긴 런타임 디렉터리를 확인한다.
4. `check`에 다섯째 검사를 추가했다. 설치 자리 링크, lock 출처와 선언의 일치, 선언 없는 lock 항목, 생성물도 external도 아닌 `dist/skills` 항목을 오류로 본다.
5. 넷을 설치했다. `build`의 stale 정리는 생성 표식이 없는 디렉터리를 건드리지 않아 외부 스킬이 지워지지 않는다.

## 발견 사항

- excalibridge는 upstream 루트에 `SKILL.md`가 있어 Skills CLI가 저장소 전체(Python 소스, 테스트, `pyproject.toml`)를 복사한다. 스킬 번들로는 과하지만 동작에는 문제가 없다. `src/tools/`로 들여와 번들 범위를 직접 정하는 쪽이 맞고, 그 작업은 백로그로 남긴다.
- `-a codex` 하나로 설치하면 레포 안에 `.claude/` 같은 런타임 디렉터리가 생기지 않는다. 다른 대상을 섞으면 생기므로 스크립트가 대상을 고정한다.

## 현재 상태

`check`의 외부 스킬 미설치 경고가 사라졌다. 같은 날 이 머신에 `link.mjs --profile common,writing --apply`를 적용해 Claude·Codex 전역 경로 37개가 하네스를 가리킨다. 적용 중 `dist/adapters`의 규칙을 프로필과 무관하게 전부 링크하는 결함을 발견해 선택한 프로필의 스킬이 선언한 것만 링크하도록 고쳤다.

채팅 우선 흐름도 같은 날 확인했다. 임시 저장소에서 `claude -p "/review staged"`(sonnet)는 `code-review` 스킬만 로드해 확정 지적 3건과 결정 필요 사항 1건을 채팅에 요약하고 반영 여부와 리포트 여부를 물은 뒤 파일을 만들지 않았다. 같은 세션을 이어 리포트만 요청하자 `html-report`를 로드해 `.review/main-staged.html`을 만들었고, 쉘 marker 6개·severity·고정 ID 3개·외부 요청 0건을 확인했다. `/explain knowledge`는 채팅에 설명을 끝내고 아티클 여부를 물었으며 파일을 만들지 않았다. Codex는 `codex debug prompt-input`에서 전역 지침과 common·writing 스킬 이름을 노출하고 web 스킬은 노출하지 않았다.
