export function meta() {
  return [{ title: "Settings · Governance System" }];
}

export default function Settings() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="inline-block rounded bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-fg">Planned</p>
      <p className="text-sm text-muted-foreground">Authentication, roles and environment settings are open decisions (D-006). Nothing to configure yet.</p>
    </div>
  );
}
