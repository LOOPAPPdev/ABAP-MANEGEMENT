# Agent Handoff Skills — Design Spec

> Date: 2026-05-05
> Status: Draft (under review)
> Repo: `agent-handoff` (to be created on GitHub)

---

## 1. Why this exists (Background)

코딩 에이전트로 일할 때 자주 보이는 세 가지 실패 패턴:

1. **같은 컨텍스트에서 plan + execute + verify를 다 돌리면, verify가 본인이 짠 코드를 검증하는 맹점이 생긴다.** 자기가 만든 plan을 자기가 따랐기 때문에 누락이 안 보인다.
2. **plan/execute/verify 워크플로우가 프로젝트 종속적으로 흩어져 있다.** 한 프로젝트에서 다듬은 패턴을 다른 프로젝트로 가져가기 어렵다.
3. **프로젝트 컨벤션 문서를 매번 손으로 알려줘야 한다.** "이 코드베이스의 컨벤션은 어디 있나?", "검증 명령은 뭔가?" 같은 질문에 매번 답하는 비용이 크다.

### 기존 솔루션과의 차이

- **Spec-Kit / BMAD / GSD**: 자체 프로세스를 강요하고 사용자 컨트롤을 빼앗는다. 버그가 났을 때 프로세스 안에서 풀기 어렵다.
- **mattpocock/skills**: 작고 composable한 스킬 묶음. 우리는 이 패턴을 따르되, **plan→execute→verify의 strict handoff**라는 한 가지 가치에 집중한다.

핵심 차별화: **각 단계가 별도 컨텍스트에서 실행될 수 있도록 디스크에 산출물(`.handoff/*.md`)을 남긴다.** 이로써 verify를 새 채팅에서 돌리면 컨텍스트 맹점이 사라진다.

---

## 2. 결정 요약

| 항목 | 결정 |
|---|---|
| 대상 사용자 | 글로벌 영어 사용자 (mattpocock 스타일) |
| 스킬 수 | 4개 (`setup-handoff`, `plan`, `execute`, `verify`) |
| setup 인터뷰 질문 수 | 5개 (verification cmd / response language / handoff dir / convention docs path / doc index). `--auto`로 스킵 가능 |
| 범용성 범위 | Stack-agnostic + Agent-agnostic |
| 핸드오프 디렉토리 (기본값) | `.handoff/` |
| 핸드오프 파일 형식 | markdown |
| Backlog 백업 | git에 의존 (`.bak` 파일 만들지 않음) |
| Repo 이름 | `agent-handoff` |
| 라이선스 | MIT |

---

## 3. 워크플로우 — 흐름과 게이트

```
[setup-handoff]   (최초 1회 — `--auto`로 인터뷰 스킵 가능. `--refresh`는 후속 릴리즈)
       │
       ▼
   .handoff/config.md      ← 자동 스캔 + (인터뷰 또는 --auto)

[plan]    ── reads config + backlog (있으면 인지) ─────── writes ──→ plan.md
   │      ↘ backlog 항목 처리 시: plan.md에 마커 + backlog의 항목에 🔄 표시
   ▼
[execute] ── reads config + plan.md ──────────────────── writes ──→ task.md  (+ 코드 변경)
   │
   ▼
[verify]  ── reads config + plan + task ──────────────── writes ──→ review.md
   │      ★ 새 채팅에서 실행 권장 (컨텍스트 맹점 회피)
   ▼
[verify cycle close — 결과에 따라]
   ✅ pass:               plan/task/review 삭제. 🔄 backlog 항목 자동 정리 (review에 안내)
   ⚠️ non-blocking only:   plan/task/review 삭제. non-blocking은 backlog에 append
   ❌ blocking:           plan/task/review 모두 유지 → 다음 plan이 보고 보강
```

### 시작 시 게이트 (각 스킬)

| 스킬 | 필수 입력 | 누락 시 동작 |
|---|---|---|
| `setup-handoff` | (없음) | 즉시 시작 |
| `plan` | `.handoff/config.md` | 중단 + "Run /setup-handoff first" 안내 |
| `execute` | `config.md` + `plan.md` | 중단 + 빠진 단계를 짚어 안내 |
| `verify` | `config.md` + `plan.md` + `task.md` | 중단 + 빠진 단계를 짚어 안내 |

**자동 호출 안 함**: 게이트 실패 시 사용자에게 다음 슬래시 명령을 안내만 하고, 자동으로 다음 스킬을 invoke하지 않는다. 의도와 다른 단계로 잘못 진입하는 것을 막기 위함.

### plan의 backlog 인지

| 상황 | plan의 동작 |
|---|---|
| backlog.md 비어 있거나 없음 | 평소대로 진행 |
| backlog 있음 + 사용자 인자 **없음** (`/plan` 만 호출) | "Backlog has N items. Process backlog or start new plan?" — 처리할 항목 번호 또는 새 작업 설명 받음 |
| backlog 있음 + 사용자 인자 **있음** (`/plan "add user search"`) | 새 작업 진행 + backlog 중 관련 항목이 있으면 "This may overlap with backlog #3 (...). Include in this plan?" 식으로 한 번 짚어줌 |

---

## 4. 각 스킬의 Boundary

**핵심 원칙**: `execute`는 plan.md에 **명시된** 명령만 실행한다. 자기 판단으로 추가 명령을 만들지 않는다. 어떤 명령을 plan에 적을지는 `plan` 스킬이 config의 `Detected toolchain`을 참조해서 결정한다 — 이로써 boundary 자체는 stack-agnostic으로 유지된다.

| 스킬 | 코드 수정 | 검증 명령(test/typecheck/lint) | 핸드오프 메타 정리 (config / plan / task / review / backlog) |
|---|:---:|:---:|---|
| `setup-handoff` | ❌ | ❌ | config 작성 / 갱신 ✅ |
| `plan` | ❌ | ❌ | plan.md 작성 + backlog 항목에 🔄 마킹 ✅ |
| `execute` | plan에 명시된 것만 ✅ | ❌ | task.md 작성 / 갱신 ✅ |
| `verify` | ❌ | ✅ | review.md 작성 + 사이클 종료 정리 (plan/task/review 삭제, backlog 처리) ✅ |

### Stack-agnostic 보장 방식 (예시)

| 시나리오 | plan에 적힐 Sync commands | execute 동작 |
|---|---|---|
| pnpm + GraphQL codegen | `pnpm install`, `pnpm fe:gen:main` | plan에 적힌 그대로 실행 |
| npm 단순 React | (없음) | 코드 변경만 |
| Cargo + sqlx | `cargo build`, `cargo sqlx prepare` | plan에 적힌 그대로 |
| Python + Django | `pip install -r requirements.txt`, `python manage.py makemigrations` | plan에 적힌 그대로 |
| 단순 버그 픽스 | (없음) | 코드 변경만 |

### 예외 처리 규칙

- `execute`가 구현 중 plan에 없는 치명적 블로커를 발견하면 작업을 중단하고 사용자에게 보고한다 — "다시 plan으로 돌아가야 합니다."
- `verify`가 코드 수정이 필요한 이슈를 발견하면 review.md에 기록만 하고, 코드는 절대 건드리지 않는다.
- "핸드오프 메타 정리"는 `.handoff/` 디렉토리 안의 메타 파일에 한정. 그 외 사용자 파일은 절대 건드리지 않는다.

---

## 5. setup-handoff 동작

### 5.1 자동 스캔 (모드와 무관하게 항상 실행)

| # | 스캔 대상 | 산출 |
|---|---|---|
| 1 | Agent guidance 파일 | CLAUDE.md, AGENTS.md, GEMINI.md, .cursor/rules/, .cursorrules, .github/copilot-instructions.md, .aider.conf.yml |
| 2 | Manifest | package.json scripts, pyproject.toml, Cargo.toml, Makefile, composer.json, Gemfile, go.mod 등에서 test/typecheck/lint 후보 추출 |
| 3 | 문서 디렉토리 트리 | docs/, documentation/, wiki/, .agent/rules/ 등 1~2 depth (파일 50개 상한) |
| 4 | README 요약 | 첫 ~200줄에서 프로젝트 성격 + 스택 추출 |
| 5 | 툴체인 감지 | lock 파일 / 설정 파일로 PM, 모노레포 도구, 주요 프레임워크 식별 |

### 5.2 자동 감지 강도와 사용자 입력 부담

| # | 인터뷰 항목 | 자동 감지 | 사용자 입력 (기본 모드) |
|---|---|---|---|
| 1 | Verification commands | **강함** — manifest scripts 매칭 | **Enter** (default 그대로) |
| 2 | Response language | 기본값 = `en`. CLAUDE.md/AGENTS.md에 언어 룰이 있으면 추측 | 보통 **Enter** |
| 3 | Convention docs path | **강함** — `conventions/rules/guidelines/patterns` 키워드 + 흔한 위치 ★ 표시 | 후보 중 **숫자 한 키** |
| 4 | Project doc index | **가장 강함** — docs 트리 + agent guidance + toolchain 모두 자동 수집 | **Y** (confirm) |

→ 기본 모드에서도 키 입력 4번 정도, 1분 미만. `handoff_dir`은 항상 `.handoff/`로 고정 (질문 안 함).

### 5.3 두 가지 실행 모드

| 모드 | 자동 스캔 | 인터뷰 | 결과 |
|---|---|---|---|
| `/setup-handoff` (기본) | ✅ 항상 | ✅ 한 질문씩 (default 제시) | 사용자 confirm을 거친 config.md |
| `/setup-handoff --auto` | ✅ 항상 | ❌ 스킵 | 자동 감지값 그대로 작성된 config.md |

**Fallback 룰** — `--auto` 사용 시 자동 감지가 실패한 항목이 있으면:
> "Couldn't auto-detect [item]. Falling back to interview for that item."
→ 그 항목만 사용자에게 묻고, 나머지 자동값은 그대로. `--auto`의 가치를 살리면서 안전.

**Non-interactive fallback** — `AskUserQuestion`이 차단된 환경 (don't-ask 모드 등)에서는 묻는 fallback 대신 기본값을 silent하게 사용 (`response_language: en`, verification commands는 empty, convention/doc index는 detected만). 작성 후 `⚠️ Used defaults for: ...` 한 줄 안내. 에러로 흐름이 끊기지 않게 함.

### 5.4 인터뷰 스크립트 (기본 모드)

```
[1] Verification commands
    Detected from package.json:
      test:      pnpm turbo test       (✓ default)
      typecheck: pnpm turbo typecheck  (✓ default)
      lint:      pnpm lint             (✓ default)
    Use these? [Y/edit/skip]

[2] Response language          (default: en)         [y/N to change]
[3] Convention docs path
    Detected: ★ docs/conventions/  /  docs/features/  /  .agent/rules/
    Which? [1/2/3/none]

[4] Project documentation index
    Auto-collected:
      Agent guidance: CLAUDE.md, AGENTS.md
      Docs:           README, docs/conventions/ (12), docs/features/ (47)
      Toolchain:      pnpm + turborepo + NestJS + React
    Confirm or edit? [Y/edit]
```

### 5.5 산출물 — `.handoff/config.md`

> **(예시 — 실제 값은 자동 감지에 따라 달라진다. 아래는 pnpm + turborepo + NestJS + React 프로젝트에서 나올 법한 모습.)**

```markdown
# Handoff Config

## Verification Commands
test:      pnpm turbo test
typecheck: pnpm turbo typecheck
lint:      pnpm lint
build:     (optional)

## Conventions
response_language: en
handoff_dir:       .handoff
commit_style:      conventional

## Project Documentation Index

### Agent guidance
- CLAUDE.md
- AGENTS.md

### Project docs
- README.md
- docs/conventions/ — coding patterns
  - apollo-client.md
  - component-design-pattern.md
- docs/features/ — module-by-module reference

### Detected toolchain
- package manager: pnpm (from pnpm-lock.yaml)
- monorepo: turborepo (from turbo.json)
- frameworks: NestJS, React, Apollo Client (from package.json deps)
```

### 5.6 `--refresh` 옵션 (Out of scope, 후속 릴리즈)

`/setup-handoff --refresh` — 자동 스캔 재실행 → 기존 값을 default로 제시 → 차이만 갱신. 1차 릴리즈에는 미포함, 사용자가 직접 config.md 편집.

---

## 6. Backlog Lifecycle

`.handoff/backlog.md`는 **누적되는 tech debt 백로그**이다. verify의 non-blocking 항목이 누적되어, plan이 새 작업 시작 시 참조한다.

### 6.1 항목 생성 — verify의 non-blocking append

verify가 검증 통과(또는 blocking 없는 통과) 후 non-blocking 개선 권장이 있으면 backlog.md 끝에 append:

```markdown
## 2026-05-04 (from review)
- [ ] #1 Extract user-search hook into packages/logic/
- [ ] #2 Add error boundary to Container
```

번호(#N)는 backlog.md 안에서 단조 증가.

### 6.2 항목 처리 — plan의 마킹

사용자가 backlog 항목을 처리하기로 결정하면 (Section 3 "plan의 backlog 인지" 참조) plan은 두 가지를 동시에 한다:

1. **plan.md 상단에 마커 추가**:
   ```markdown
   > Addresses backlog: #2, #5
   ```
2. **backlog.md의 해당 항목을 in-progress로 마킹**:
   ```markdown
   - [🔄] #2 Add error boundary to Container
   - [🔄] #5 Extract user-search hook into packages/logic/
   ```

→ 다른 plan 사이클이 같은 항목을 중복 진입하지 않도록 보호. 또한 사용자가 backlog.md를 보고 "어느 항목이 처리 중인지" 즉시 파악 가능.

### 6.3 자동 정리 — verify의 마무리

verify가 검증 통과 시:

1. plan.md의 `> Addresses backlog: #N, #M` 마커 파싱
2. `.handoff/backlog.md`에서 해당 항목 삭제
3. review.md 끝에 명시:
   ```markdown
   ## Closed backlog items
   - #2: Add error boundary to Container
   - #5: Extract user-search hook into packages/logic/
   ```
4. 그 후 plan/task/review 삭제 (사이클 종료 정리)

검증 **실패** 시: backlog.md는 그대로 (🔄 마크 유지). 다음 사이클이 같은 항목을 이어받는다.

### 6.4 안전성 — git에 의존

`.bak` 백업 파일을 만들지 않는다. 이유:

- 사용자가 `.handoff/`를 git tracked로 두면 git 이력이 진짜 백업 (`git diff` / `git restore`).
- `.handoff/`를 gitignore로 두는 사용자도, backlog 항목이 코드 문제와 연관된 거라면 다음 verify에서 다시 발견됨.
- `.bak` 파일은 워킹 디렉토리 노이즈 + cleanup 부담만 추가.

대신 review.md의 "Closed backlog items" 섹션이 그 사이클 동안의 가시적 기록 역할을 한다 (review.md는 사이클 종료 시 삭제되지만, 사용자가 그 사이에 살펴볼 시간은 충분).

---

## 7. Repo 구조

```
agent-handoff/
├── .claude-plugin/plugin.json    # 4개 스킬 등록
├── README.md                     # "Why handoff" + Install + 4 skill index
├── LICENSE                       # MIT
├── docs/
│   ├── why-handoff.md            # 디자인 철학 (긴 글)
│   ├── specs/                    # design specs (이 문서가 그 첫 번째)
│   └── examples/                 # 실제 산출물 샘플
│       ├── config.md
│       ├── plan.md
│       ├── task.md
│       ├── review.md
│       └── backlog.md
└── skills/
    ├── setup-handoff/
    │   ├── SKILL.md
    │   ├── auto-scan.md          # 자동 스캔 룰 reference
    │   └── interview.md          # 인터뷰 스크립트 + --auto fallback reference
    ├── plan/
    │   ├── SKILL.md
    │   ├── plan-template.md      # plan.md 표준 구조
    │   └── backlog-handling.md   # backlog 인지 + 마킹 룰
    ├── execute/
    │   ├── SKILL.md
    │   └── boundaries.md         # 코드 수정 boundary 룰 reference
    └── verify/
        ├── SKILL.md
        ├── checks.md             # 검증 항목 + 순서 reference
        ├── review-template.md
        └── cycle-close.md        # 사이클 종료 정리 + backlog 자동 정리 룰
```

### plugin.json

```json
{
  "name": "agent-handoff",
  "skills": [
    "./skills/setup-handoff",
    "./skills/plan",
    "./skills/execute",
    "./skills/verify"
  ]
}
```

설치 후 `/setup-handoff`, `/plan`, `/execute`, `/verify` 슬래시 명령 자동 등록.

---

## 8. 산출물 샘플 (`docs/examples/`)

각 파일에 미니 샘플을 둔다. 사용자가 README만 봐도 무엇이 만들어지는지 즉시 파악 가능.

- `config.md` — setup-handoff 산출 예시 (위 5.5 참조)
- `plan.md` — 가벼운 기능 추가 사례. 표준 구조 (`plan-template.md`):
  - (선택) `> Addresses backlog: #N, #M`
  - 변경 파일 목록 / 각 파일의 변경 내용
  - Sync commands (있을 때만)
  - 테스트 전략
  - 검증 계획
- `task.md` — execute의 체크리스트 형태 (plan 항목별 체크 + 진행 상황)
- `review.md` — verify의 검증 결과 표 (테스트/타입체크/린트 통과 여부, 코드 리뷰 소견, 닫힌 backlog 항목)
- `backlog.md` — non-blocking 누적 + in-progress 마크 예시:
  ```markdown
  # Improvement Backlog

  ## 2026-05-04 (from review)
  - [ ] #1 Extract user-search hook into packages/logic/
  - [🔄] #2 Add error boundary to Container

  ## 2026-05-05 (from review)
  - [ ] #3 Add loading state to ProductList
  ```

---

## 9. SKILL.md frontmatter 표준 (Agent-agnostic)

각 SKILL.md 상단:

```markdown
---
name: plan
description: Use when starting a new feature, fix, or refactor that needs explicit planning before code changes. Reads .handoff/config.md and writes a structured plan.md to .handoff/. Does NOT modify code or run build commands. Pair with /execute and /verify.
---
```

- `name`: 슬래시 명령 이름과 동일
- `description`: trigger 정확도가 핵심. "Use when..." 패턴으로 시작, 어떤 상황에 호출되어야 하는지 명시
- 영어로 작성 (글로벌 + trigger 정확도)

**Agent-agnostic 전략**:
- SKILL.md frontmatter (`name` + `description`) 형식 자체가 Claude Code, Cursor, Codex 등 주요 코딩 에이전트가 공통으로 인식 가능한 표준에 가깝다. 1차 릴리즈는 이 공통 표준만 따르며 도구별 분기 없음.
- 만약 어떤 도구에서 추가 메타데이터가 필요하다면 (예: Cursor의 `.cursor/rules/` 별도 포맷), README 하단에 "Tool-specific install notes" 섹션을 두고 사용자가 직접 변환할 수 있는 가이드를 제공. 도구별 어댑터 자동화는 후속 릴리즈로 미룬다.

---

## 10. Out of scope (1차 릴리즈 제외)

- `git-push`, `self-check`, `pr-analyzer`, `verify-all` 등 추가 워크플로우 (후속 릴리즈)
- `/setup-handoff --refresh` 옵션 (1차에는 사용자가 직접 config.md 편집)
- `/verify --close-backlog`, `/verify --clean-backlog` 등 backlog 수동 조작 옵션 (자동 정리만 1차에 포함)
- Cursor / Codex / Gemini 도구별 어댑터 (1차는 SKILL.md 표준만 준수)
- 한국어 / 기타 언어 README (영어 단일)
- 자동 GraphQL/Codegen 동기화 같은 프로젝트 종속 로직

**1차 릴리즈에 포함**: `/setup-handoff --auto` (인터뷰 스킵 + 자동 감지 실패 시 인터뷰 fallback)

---

## 11. Open Questions (구현 단계에서 해소)

1. **자동 스캔 구현 방식** — 셸 명령 묶음으로 충분한가, 아니면 작은 Python 스크립트가 필요한가? (mattpocock의 `setup-matt-pocock-skills`처럼 SKILL.md 안에 셸 명령으로 처리할 가능성 높음.)
2. **plan/verify가 "Doc Index"를 어떻게 활용할지** — config의 doc list를 단순 reference로 SKILL.md에 노출할지, 아니면 plan이 해당 디렉토리를 능동적으로 grep할지.
3. **examples를 얼마나 디테일하게 둘지** — 미니 샘플 (각 ~50줄) vs 실제 사용 사례 (~200줄).
4. **backlog 항목 번호 정책** — 단조 증가만 할지, 아니면 처리된 항목의 번호를 재사용할지. 단조 증가가 추적 쉬움.

이 질문들은 `writing-plans` 단계에서 구체화한다.

---

## 12. 다음 단계

1. **사용자 검토** — 이 design doc 검토 + 변경 요청 수렴
2. **Approve** → `writing-plans` 스킬로 implementation plan 작성
3. **사용자가 GitHub repo 생성** → URL 알려줌
4. **로컬 → 새 repo 연결** → 첫 commit + push
5. **implementation plan을 따라** SKILL.md ×4, README, examples, plugin.json 작성

---

## Appendix A. 워크플로우 검증 시나리오 (수동)

릴리즈 전 다음 시나리오를 한 번 손으로 돌려본다:

1. **첫 설치**: 빈 repo에서 `/setup-handoff` → 인터뷰 5질문 → config.md 생성
2. **`--auto` 모드**: 다른 repo에서 `/setup-handoff --auto` → 인터뷰 없이 즉시 config.md 생성
3. **`--auto` fallback**: package.json도 manifest도 없는 repo에서 `/setup-handoff --auto` → verification 항목만 인터뷰 fallback
4. **일반 사이클**: `/plan "add user search"` → 새 채팅 `/execute` → 새 채팅 `/verify` → 통과 시 plan/task/review 모두 삭제
5. **non-blocking 누적**: verify가 ⚠️ 항목 발견 → backlog.md에 append → 다음 `/plan` 시 backlog 인지
6. **backlog 처리**: `/plan` (인자 없음) → "Process backlog?" → 사용자가 #2 #5 선택 → plan.md 마커 + backlog 🔄 → execute → verify 통과 → backlog 자동 정리 + review에 "Closed: #2, #5"
7. **backlog 처리 실패**: 위와 같지만 verify에서 blocking 발견 → backlog.md 그대로 (🔄 유지) → 다음 사이클이 이어받음
8. **게이트 실패**: `/plan` 직전 config 삭제 → "Run /setup-handoff first"

이 8가지 시나리오가 깨지지 않으면 1차 릴리즈 가능.
