# AGENTS.md

모든 프로젝트, 모든 세션에 적용되는 전역 지침이다. 짧게 유지한다. 프로젝트 규칙은 각 저장소의 `AGENTS.md`와 `docs/`가 소유하며 이 문서보다 우선한다.

## 언어와 응답
- 기본은 한국어. code identifier, 기술 용어, 고유명사는 영어를 유지한다.
- 두세 항목이면 불릿 대신 문장으로 쓴다. 결산 상투구(`결론적으로`, `핵심은`)를 쓰지 않는다.
- 이모지는 요청받을 때만 쓴다.

## 작업 방식
- 큰 구조 변경 전에 묻는다. 재작성보다 외과적 수정을 택한다.
- 영구 설정 파일(`AGENTS.md`, `settings.json`, `config.toml`)은 확인 후 바꾼다.
- 완료·수정·검증 통과를 주장하기 전에 실제로 검증한다.

## Git
- force push와 `--no-verify`는 명시적 요청 없이는 쓰지 않는다.

## CLI 도구 라우팅
- 텍스트 검색은 `rg`, JSON은 `jq`, 구조 검색은 `ast-grep` skill, 구조 파악은 `ast-grep-outline` skill.
- `hyperfine`은 명시적 성능 작업에만 쓴다.

## Skill 라우팅
- 사용 가능한 skill의 `description`이 요청과 맞으면 첫 작업으로 그 skill을 로드한다.
