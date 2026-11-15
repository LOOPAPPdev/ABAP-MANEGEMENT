# packages/

Shared libraries used by more than one workspace.

| Package | Used by | What |
|---|---|---|
| [`ui/`](./ui/README.md) (`@abap/ui`) | `apps/abap` (tokens, recipes), `sites/loop-consultoria` (imports CSS at build) | One token contract, two themes (ABAP, LOOP), CSS recipes of the 7 primitives both use |

Add a package here only when two workspaces need the same code.
