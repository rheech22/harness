# Codex 어댑터

Codex CLI가 전역 수준에서 읽는 것과, 이 하네스가 그 자리에 무엇을 링크하는지 정리한다. 경로 선언은 [`adapter.json`](adapter.json)이 소유하고, 이 문서는 근거와 검증을 소유한다. 근거는 아래 공식 문서 링크이며, 확인한 시점은 history의 검증 기록이 가진다.

## 이 런타임이 읽는 것

| 자리 | 하네스 소스 | 근거 |
| --- | --- | --- |
| `~/.codex/AGENTS.md` | `AGENTS.md` (symlink) | Codex home(`CODEX_HOME`, 기본 `~/.codex`)에서 `AGENTS.override.md` → `AGENTS.md` 순으로 첫 파일을 읽는다. 프로젝트는 git root부터 cwd까지 `AGENTS.md`를 이어 붙인다 (`project_doc_max_bytes` 32KiB) |
| `~/.agents/skills/<name>/SKILL.md` | 공용 배포 그대로 | 사용자 범위 스킬 경로는 `$HOME/.agents/skills`. **`~/.codex/skills`는 문서에 없다.** symlink 폴더를 따라간다. 같은 이름이 둘이면 병합하지 않고 둘 다 노출된다 |
| `~/.codex/rules/*.rules` | `rules/*.rules` | Starlark `prefix_rule(pattern, decision, justification, match, not_match)`. decision 기본 `allow`, 충돌 시 더 엄격한 쪽. experimental |
| `~/.codex/hooks.json` | `hooks.json` (`configure`로 적용) | 사용자 훅. 프로젝트 `.codex/hooks.json`과 **함께** 로드된다. 비관리 훅은 새 세션의 `/hooks`에서 신뢰해야 실행된다 |
| `~/.codex/prompts/` | 두지 않음 | custom prompt는 **deprecated**. 명시 호출은 스킬을 `$name`으로 한다 |
| `~/.codex/config.toml` | **런타임의 로컬 설정** | 모델, marketplace, plugin, 프로젝트 trust, `hooks.state`를 앱이 쓴다. 하네스가 링크하지 않는다 |

공식 문서: [AGENTS.md](https://learn.chatgpt.com/codex/agent-configuration/agents-md), [Skills](https://learn.chatgpt.com/docs/build-skills), [Rules](https://learn.chatgpt.com/codex/agent-configuration/rules), [Hooks](https://learn.chatgpt.com/docs/hooks), [Custom prompts (deprecated)](https://learn.chatgpt.com/docs/custom-prompts), [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## 프로젝트 뼈대 (`project/`)

- `.codex/config.toml`: 프로젝트 MCP 등록만. 모델·credential·개인 절대 경로는 사용자 설정에
공통 훅은 프로젝트에 복사하지 않고 `node scripts/configure.mjs --runtime codex --apply`로 사용자 훅 설정에 적용한다. 실행 경로는 실제 하네스 체크아웃 위치로 변환한다. 다른 훅 항목을 보존하며 `config.toml`은 변경하지 않는다. 이관과 백업은 [설치와 로컬 설정](../../docs/harness/guides/setup.md)을 따른다.

## 검증

모델 호출 없이 모델 입력을 그대로 볼 수 있다. 전역 지침과 스킬 설명에 심은 고유 토큰이 출력에 있는지, 음성 대조군이 없는지, custom 스킬 이름이 모두 노출되는지 본다.

```bash
HOME=/tmp/fake-home codex debug prompt-input "hello" > /tmp/prompt.json
grep -o 'HARNESS-TOKEN-[A-Z]*-[0-9a-f]*' /tmp/prompt.json
```

`.rules` 파일이 있는 상태로 위 명령이 정상 실행되면 문법은 통과한 것이다. 권한 규칙 단독 검증은 `codex execpolicy check --pretty --rules ~/.codex/rules/harness.rules -- <명령>`. 결과는 런타임 버전과 함께 `src/docs/harness/history/`의 검증 기록에 남긴다.

## 함정

- 훅은 파일을 놓는 것으로 끝나지 않는다. 새 세션 `/hooks`에서 신뢰해야 하고, 정의가 바뀌면 다시 신뢰해야 한다.
- `~/.codex/rules/default.rules`는 TUI가 승인 내역을 누적 기록하는 파일이라 하네스가 소유하지 않는다. 하네스 규칙은 별도 파일(`harness.rules`)로 둔다.
- `CODEX_HOME`을 바꾸면 `auth.json`도 그 안에서 찾는다. 격리 검증 시 로그인 파일을 임시로 복사한다.
