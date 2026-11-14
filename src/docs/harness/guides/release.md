---
title: "릴리스와 외부 배포"
domain: [harness]
kind: guide
status: current
related:
  - ../conventions/skills.md
  - ../decisions/0005-export-lag-is-not-an-error.md
---

# 릴리스와 외부 배포

## 언제 쓰는가

`dist/packages/<name>/`을 갱신해 외부(다른 프로젝트, 다른 사람)가 고정할 수 있는 버전을 내놓을 때 씁니다. 내 머신에 반영하는 데는 필요 없습니다. 그쪽은 `build`와 `link`로 끝납니다.

## 절차

1. 원본을 고치고 `node scripts/build.mjs`로 `dist/skills/`를 맞춥니다. `node scripts/check.mjs`가 해당 패키지를 `export pending`으로 보고합니다.
2. `harness.json`의 `publish.<name>`을 확인합니다. `from`이 원본 위치, `strip`이 밖에 내보내지 않을 경로입니다. 테스트, 내부 메모, 프로필 문서가 `strip`에 들어갑니다. Python 코드 패키지는 `versionFile`로 패키지 루트 기준 `__version__` 선언 파일을 지정합니다.
3. 코드 패키지는 `versionFile`의 `__version__`와 changelog를 갱신합니다. 버전은 안정 릴리스 형식 `MAJOR.MINOR.PATCH`를 사용합니다.
4. `node scripts/export.mjs <name> --version <ver>`를 실행합니다. `dist/packages/<name>/`이 다시 만들어지고 `.export.json`에 버전·소스 해시·패키지 해시가 기록됩니다. 패키지 버전과 다른 입력, 이미 존재하는 로컬 태그, 같은 버전으로 다른 내용을 재export하는 요청은 쓰기 전에 거절합니다. 태그 확인 전에 원격 태그를 fetch해야 합니다. 태그 전에는 동일 내용의 재export를 허용합니다.
5. `check`가 `v<ver> is current`로 바뀐 것을 확인하고 커밋합니다. 태그는 `<name>-v<ver>`입니다. 패키지마다 독립된 버전 축을 가지며 하네스 전체 버전과 섞지 않습니다.
6. 태그를 발행할 때 `harness.json`의 `tools.<name>.install`과 패키지 설치 안내도 같은 버전으로 맞춥니다. 새 태그가 원격에 올라간 뒤 소비자에게 설치 경로를 알립니다.
   - 문서 스킬: `npx skills add rheech22/harness --skill <name>`
   - 코드 패키지: `uv tool install '<name> @ git+https://github.com/rheech22/harness@<name>-v<ver>#subdirectory=dist/packages/<name>'`

## 검증

- `check`에 `export pending`이 남아 있으면 의도된 것인지 확인합니다. 릴리스하지 않기로 한 변경이면 그대로 둡니다.
- `dist/packages/`를 손으로 고친 흔적(`edited by hand`)은 오류입니다. 되돌리고 export를 다시 실행합니다.
- 코드 패키지는 export 전에 `src/tools/<name>/`에서 테스트를 통과시킵니다. `dist/packages/`에는 테스트가 들어가지 않습니다.

## excalibridge 릴리스

버전 원본은 `src/tools/excalibridge/excalibridge/__init__.py`입니다. `pyproject.toml`은 이 값을 읽습니다. CLI 버전과 export 버전은 같은 값을 사용해야 합니다.

```bash
cd src/tools/excalibridge
python -m unittest discover -s tests
node --test tests/test_embeddable.mjs
cd ../../..
node --test scripts/tests/export.test.mjs
node scripts/build.mjs
node scripts/export.mjs excalibridge --version <ver>
node scripts/check.mjs
```

원본과 배포 스냅샷을 함께 커밋하고 `excalibridge-v<ver>` 태그를 붙입니다. 태그 발행은 별도 Git 작업이며 export가 자동으로 수행하지 않습니다. `excalibridge-v*` 태그를 push하면 GitHub Actions가 테스트와 버전 일치를 확인하고 스냅샷에서 wheel·sdist를 빌드해 GitHub Release에 첨부합니다. 하네스는 이 패키지를 PyPI에 자동 발행하지 않습니다.

## 관련 문서

- [스킬 규칙](../conventions/skills.md)
