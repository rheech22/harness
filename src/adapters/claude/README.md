# Claude Code 어댑터

Claude Code가 전역 수준에서 읽는 것과, 이 하네스가 그 자리에 무엇을 링크하는지 정리한다. 경로 선언은 [`adapter.json`](adapter.json)이 소유하고, 이 문서는 근거와 검증을 소유한다.

## 이 런타임이 읽는 것

| 자리 | 하네스 소스 | 근거 |
| --- | --- | --- |
| `~/.claude/CLAUDE.md` | `AGENTS.md` (symlink) | 전역 지침은 `CLAUDE.md` 이름으로 읽는다. 프로젝트 수준에서는 2.1.277+ 가 `AGENTS.md`를 직접 읽지만 **홈 수준에서 `~/.claude/AGENTS.md`를 읽는지는 미측정**이라 symlink로 맞춘다 |
| `~/.claude/skills/<name>/SKILL.md` | `~/.agents/skills/<name>` (2차 symlink) | 스킬은 `description`으로 자동 라우팅. 커맨드도 같은 목록에 노출된다 |
| `~/.claude/rules/*.md` | `dist/adapters/claude/rules/*.md` (생성물) | `paths` frontmatter가 있으면 해당 파일을 다룰 때만 로드되는 **경로 조건 계층**. 이 런타임에만 있다. 스킬 선언의 `rules`에서 `build`가 생성하며 문서 본문을 인라인한다 |
| `~/.claude/commands/*.md` | `dist/adapters/claude/commands/*.md` (생성물) | `/<name>`으로 호출되는 slash command. 스킬 선언의 `commands`에서 `build`가 생성하며 본문은 "어떤 스킬을 로드하라"뿐이다 |
| `~/.claude/settings.json` | **dotfiles 소유** | 모델·테마·권한 허용 목록·훅 등록이 한 파일이라 하네스가 링크하지 않는다. 훅 스크립트 본체는 `src/hooks/`에 두고 settings가 그 경로를 부른다 |

공식 문서: [Memory / CLAUDE.md](https://docs.anthropic.com/en/docs/claude-code/memory), [Skills](https://docs.anthropic.com/en/docs/claude-code/skills), [Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks), [Settings](https://docs.anthropic.com/en/docs/claude-code/settings).

## 프로젝트 뼈대 (`project/`)

`init-project`가 저장소 루트에 겹쳐 복사한다.

- `.claude/settings.json`: 읽기 전용 명령 허용 목록과 생성물 직접 수정 안내 훅. `~/harness/src/hooks/skill-distribution-guard.mjs`를 호출한다
- `.claude/rules/always.md`: 저장소 code-style을 항상 로드하는 stub (`@import`)

저장소에 `CLAUDE.md`, `CLAUDE.local.md`, `.claude/CLAUDE.md`를 두지 않는다. 하나라도 있으면 Claude가 그 저장소의 `AGENTS.md`를 읽지 않는다.

## 검증

새 프로세스에서 고유 토큰 도달을 확인한다. 전역 지침, 스킬 설명, 경로 조건 규칙에 각각 다른 토큰을 심고, 존재하지 않는 토큰 하나를 음성 대조군으로 함께 묻는다. 모델 호출이 한 번 필요하다.

```bash
HOME=/tmp/fake-home CLAUDE_CONFIG_DIR=/tmp/fake-home/.claude \
  claude -p --model haiku "list every HARNESS-TOKEN string in your context and the skills available to you"
```

확인할 것은 세 가지다. 토큰이 전부 도달하고 음성 대조군이 없는지, custom 스킬 이름이 목록에 모두 보이는지, 규칙이 걸리는 파일을 편집한 뒤 규칙 토큰이 도달하는지. 명령은 `/<name>`을 직접 호출해 해당 스킬을 로드하는지 본다. 결과는 런타임 버전과 함께 `src/docs/harness/history/`의 검증 기록에 남긴다.

## 함정

- **격리된 HOME에서는 인증이 안 된다.** 유효 토큰은 Keychain(`Claude Code-credentials`)에 있고 `~/.claude/.credentials.json`은 낡을 수 있다. 검증 시에는 Keychain 값을 임시 `.credentials.json`으로 내보내고 끝나면 지운다.
- 전역 스킬과 프로젝트 스킬 이름이 같으면 어느 쪽이 이기는지 런타임 버전에 따라 다르다. 같은 이름을 피한다.
