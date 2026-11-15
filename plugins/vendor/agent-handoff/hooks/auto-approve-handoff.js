#!/usr/bin/env node
// Auto-approve Write/Edit on .handoff/** state files.
// Reads PreToolUse hook input from stdin; emits hookSpecificOutput JSON if path matches.
// Silent (exit 0) for any other path — falls through to normal permission flow.

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const filePath = payload?.tool_input?.file_path;
    if (typeof filePath === 'string') {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.startsWith('.handoff/') || normalized.includes('/.handoff/')) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason: 'agent-handoff state file'
          }
        }));
      }
    }
  } catch {
    // Invalid JSON — silent fall-through
  }
});
