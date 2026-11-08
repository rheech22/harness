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

`check`의 외부 스킬 미설치 경고가 사라졌다. 전역 연결(`link.mjs --apply`)은 이 기록 시점에 아직 적용하지 않았다.
