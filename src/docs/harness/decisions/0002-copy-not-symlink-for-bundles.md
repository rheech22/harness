---
title: "스킬 번들의 references는 symlink가 아니라 복사한다"
domain: [harness]
kind: decision
status: accepted
decision_date: "2026-11-08"
principle: "4. 어느 도구에도 묶이지 않는다"
related:
  - 0001-single-source-docs.md
  - ../conventions/skills.md
---

# 스킬 번들의 references는 symlink가 아니라 복사한다

## 배경

socra-tutor-fe의 custom 스킬은 "이 문서들을 읽어라"는 포인터입니다. 같은 저장소 안에서는 충분하지만 개인 하네스의 스킬은 `~/.agents/skills`로 링크되고, 다른 프로젝트에는 `skills add`로 복사되며, 다른 사람에게도 나갑니다. 어느 경우든 스킬이 로드되는 자리에서 하네스의 `src/docs/`가 보이지 않습니다.

## 결정

`build`가 원본 문서를 `dist/skills/<name>/references/`에 **파일로 복사**하고 생성물 표시 주석을 붙입니다. symlink를 쓰지 않습니다. Anthropic 스킬 형식(`SKILL.md` + `references/` + `scripts/`)과 같은 모양이라 어느 런타임에서나 자급자족합니다.

## 고려한 대안

- **symlink**: 내 머신에서는 동작하지만 저장소 밖으로 나가면 깨집니다. Skills CLI의 lock은 symlink를 거부하고 실제 바이트를 해시합니다. Git의 symlink 취급도 플랫폼마다 다릅니다.
- **SKILL.md 본문에 문서를 인라인 생성**: 파일 수는 줄지만 한 문서가 여러 스킬에 들어갈 때 스킬이 금방 커집니다.

## 영향

저장소 안에 같은 내용이 두 번 존재합니다. "생성물은 손대지 않는다"와 drift 검사, 훅 경고 세 장치로 막습니다. 문서 하나가 여러 스킬에 들어가면 각 번들에 따로 복사됩니다.
