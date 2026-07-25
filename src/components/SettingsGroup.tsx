/** A small uppercase group label above a cluster of related setting
 * cards — shared between settings.tsx and profile.tsx, both of which
 * grew section by section with no visual grouping between them, reading
 * as one long undifferentiated list. Purely a label, not a new layout:
 * the cards underneath are unchanged, just organized under a heading
 * that matches what they're actually about. */
export function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-prestige-mid">
        {label}
      </p>
      {children}
    </div>
  );
}
