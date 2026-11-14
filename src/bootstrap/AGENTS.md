# AGENTS.md

이 저장소에서 작업하는 코딩 에이전트의 공통 진입 문서다. 전역 지침(개인 하네스 `AGENTS.md`)을 따르되, 여기 적힌 규칙이 우선한다.

## 먼저 읽기
- `README.md`
- `docs/README.md`

## Skill 라우팅
- 사용 가능한 skill의 `description`이 요청과 맞으면 첫 작업으로 로드한다.

## 프로젝트 프로필
- 하네스 스킬이 읽는 프로젝트 고유 값은 `docs/profiles/<skill>.md`에 둔다. 절 제목은 스킬 번들의 `references/profile.default.md`와 같게 쓰고, 정하지 않은 절은 기본값을 따른다.
- 프로필에는 이 저장소의 값만 적는다. 절차나 기준을 다시 쓰지 않는다.
