# packages/

Shared libraries used by more than one workspace.

| Package | Used by | What |
|---|---|---|
| [`ui/`](./ui/README.md) (`@abap/ui`) | `apps/abap` (tokens, recipes) | One token contract, two themes (ABAP, LOOP), CSS recipes of the shared primitives |
| [`loop-ui/`](./loop-ui/README.md) (`@loop/ui`) | `sites/loop-consultoria` only | Exclusive LOOP package: Screens v2 tokens and page patterns, one to one with the design (exception D-040) |

Add a package here only when two workspaces need the same code. Exception: a brand package that must follow one design exactly (D-040, `loop-ui`).
