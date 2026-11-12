export function meta() {
  return [{ title: "Projects · Governance System" }];
}

export default function Projects() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Projects</h1>
      <p className="inline-block rounded bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-fg">Planned</p>
      <p className="text-sm text-muted-foreground">Multi-project support is an open decision (D-007). The MVP runs one seeded project.</p>
    </div>
  );
}
