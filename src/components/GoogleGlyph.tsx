// Google's own multi-color "G" mark, inlined as SVG rather than pulled from
// an icon font/library — lucide-react (this app's icon set everywhere else)
// has no brand icons, and Google's own brand guidelines expect the mark's
// real colors preserved, not recolored to match a single-color icon set.
export function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.1-5.1C33.8 5.4 29.2 3.6 24 3.6 12.9 3.6 3.9 12.6 3.9 23.7s9 20.1 20.1 20.1 20.1-9 20.1-20.1c0-1.1-.1-2.2-.5-3.2z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.4l6 4.4C13.9 15 18.6 12 24 12c3.1 0 5.8 1.2 8 3l5.1-5.1C33.8 6.4 29.2 4.6 24 4.6c-7.7 0-14.4 4.4-17.7 10.8z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.8c5.1 0 9.7-1.9 13.2-5.1l-6.1-5.2c-2 1.5-4.6 2.5-7.1 2.5-5.3 0-9.7-3.4-11.3-8h-6.2v5.4c3.3 6.5 10 10.9 17.5 10.9z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.1 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.1-.1-2.2-.3-3z"
      />
    </svg>
  );
}
