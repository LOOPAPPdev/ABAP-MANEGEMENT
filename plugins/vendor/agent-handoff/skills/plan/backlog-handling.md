# Backlog Handling

Decision tree run at the start of `/plan`, after the config gate passes.

## 1. Detect backlog state

Read `.handoff/backlog.md`. State:
- **Empty / missing** → proceed normally (no backlog interaction).
- **Has open items** (lines starting `- [ ]`) → branch on user input.

## 2. Branch on user input

| User input | Action |
|---|---|
| `/plan` (no argument) | Ask: "Backlog has N open items. Process backlog or start a new plan? Reply with item numbers (e.g. `2,5`) or describe the new task." |
| `/plan "<task>"` (argument given) | New task takes priority. After investigating, scan backlog titles for keyword overlap with the new task. If overlap found, ask: "This may overlap with backlog #N (<title>). Include in this plan?" |

## 3. When backlog items will be addressed

Two writes happen together:

### plan.md gets a marker (top of file, before "Background"):

```markdown
> Addresses backlog: #2, #5
```

### backlog.md items get the in-progress marker:

Replace `- [ ]` with `- [🔄]` for each item being addressed.

Before:
```markdown
- [ ] #2 Add error boundary to Container
```

After:
```markdown
- [🔄] #2 Add error boundary to Container
```

This protects the items from being picked up by another plan cycle in flight.

## 4. Cycle outcomes

`verify` handles cleanup; this skill only marks. See `skills/verify/cycle-close.md`.
