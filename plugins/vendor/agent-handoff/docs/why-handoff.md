# Why Handoff

**English** | [한국어](why-handoff.ko.md)

If you have spent any real time pairing with a coding agent on a non-trivial codebase, you have already felt the friction this plugin tries to remove. This doc is the long version of the README's pitch — the argument for why four small skills, organized around a strict plan -> execute -> verify handoff, make agent-assisted work measurably less painful.

## The three failure modes

**Same-context blindness.** When the same chat session plans the work, writes the code, and then reviews itself, the review is structurally compromised. The agent that just argued "this approach is correct" is now asked "is this approach correct?" — and it answers from the same mental model that produced the plan in the first place. Real example: an agent plans a refactor that splits a `UserService` into three modules. It executes cleanly. Asked to verify, it confirms the modules look good, the imports resolve, the tests pass. What it does not notice is that the plan never mentioned the upstream `AdminController` which still imports the old shape, because that file was never opened during planning. A fresh chat looking at the same diff catches the missing wiring in seconds — it has no investment in the plan being right.

**Project-locked workflows.** You build up a working rhythm with an agent on Project A — a way of writing tickets, a checklist of things to verify, a habit of quoting the relevant convention doc before asking for code. None of it survives the move to Project B. The patterns live as scattered turns in a chat history nobody can replay. You start over: re-explaining your testing philosophy, re-establishing how strict you are about types, re-discovering which command runs the linter. Six months later you are doing the same teaching for the third project. The workflow was real, but it was implicit, and implicit workflows do not migrate.

**Conventions on demand.** Every fresh chat begins with the same scavenger hunt. Where are the coding conventions? What is the test command? Which directory holds the feature docs? Is this a pnpm workspace or a single package? The agent cannot know — it has no memory across sessions — so it either asks (slow) or guesses (worse). You end up pasting the same three paragraphs of context into every new conversation. The cost is small per chat and enormous over a quarter, and the recurring nature of it is what makes it especially demoralizing: you are paying to re-establish state that has not actually changed.

## What the handoff fixes

**Disk-backed state.** Each phase writes its output to `.handoff/*.md`. `verify` reads `plan.md` and `task.md` from disk — it does not share memory with the chat that produced them. Running `/verify` in a fresh chat is the whole point: the reviewer arrives with no prior commitment to the plan being right, only the plan as written. Same-context blindness disappears because there is no shared context to be blind in.

**Stack-agnostic boundaries.** `plan` decides what commands belong in the plan, by reading the toolchain captured in `config.md`. `execute` mechanically follows whatever the plan says. The skills themselves know nothing about pnpm, Cargo, Django, or Go modules — they only know the boundary: planner writes commands, executor runs them, reviewer checks them. The same four skills work in any language or framework because the project-specific knowledge lives in `config.md`, not in the skill prompts.

**Conventions captured once.** `setup-handoff` runs once per project and scans for the things every new chat used to ask about: agent guidance files, manifest scripts, doc directories, toolchain markers. The result lands in `.handoff/config.md`. Every subsequent `/plan`, `/execute`, and `/verify` reads from that file. You stop re-explaining your project on every chat boundary because the explanation is on disk.

## What this is NOT

- **Not a process framework** like Spec-Kit, BMAD, or GSD. Those impose a full lifecycle and ask you to live inside it. This plugin is four small skills you invoke as the situation calls for. If you want to skip planning for a one-line fix, nothing stops you.
- **Not a test runner.** `verify` runs whatever commands your `config.md` already lists — your existing `pnpm test`, `cargo test`, `pytest`. There is no test scaffolding shipped here.
- **Not an LLM or an agent.** This is markdown plus a plugin manifest. Your existing coding agent does the work; the skills just give it a shared shape to work in.

## When to skip a step

The handoff has overhead. Use it when the overhead pays for itself, skip it when it does not.

- **Single-file refactor with an obvious diff:** skip `plan`. Just edit the file and run `/verify` if you want a fresh-eye check.
- **Throwaway prototyping:** skip the whole pipeline. Save it for code that will live longer than the afternoon.
- **The handoff earns its keep** when a change touches three or more files, or when you know you will want to verify the result in a fresh chat where the original reasoning is not available.

## Where the magic isn't

This plugin encodes a working pattern. It does not make your agent smarter, it does not rescue a bad plan, and it does not catch what `verify` did not think to look for. The discipline of separating plan from execute from verify is what produces better outcomes — the markdown files and slash commands are just scaffolding that makes the discipline easy to follow. If you are already rigorous about handing off between phases manually, this plugin will feel like packaging for what you already do. If you are not, the packaging is the whole point.
