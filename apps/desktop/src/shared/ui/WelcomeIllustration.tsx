/** Vector hero: phone → sync ring → computer, with floating photo tiles. Decorative. */
export function WelcomeIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 300" fill="none" className={className} aria-hidden>
      {/* orbit rings */}
      <circle cx="180" cy="150" r="128" stroke="var(--illus-line)" strokeWidth="1.5" strokeDasharray="2 10" />
      <circle cx="180" cy="150" r="96" stroke="var(--illus-line)" strokeWidth="1" />
      <circle cx="180" cy="150" r="70" fill="var(--brand-base)" opacity="0.15" />

      {/* data path */}
      <path d="M78 170 C 120 100, 240 100, 282 170" stroke="var(--brand-base)" strokeWidth="2.5" strokeLinecap="round" />

      {/* phone */}
      <g >
        <rect x="46" y="128" width="64" height="112" rx="14" fill="var(--illus-body)" stroke="var(--illus-line)" strokeWidth="2" />
        <rect x="54" y="140" width="48" height="80" rx="6" fill="var(--illus-screen)" />
        <rect x="58" y="146" width="18" height="18" rx="3" fill="var(--illus-photo-2)" opacity="0.7" />
        <rect x="80" y="146" width="18" height="18" rx="3" fill="var(--brand-base)" opacity="0.7" />
        <rect x="58" y="168" width="18" height="18" rx="3" fill="var(--illus-photo-4)" opacity="0.6" />
        <rect x="80" y="168" width="18" height="18" rx="3" fill="var(--illus-photo-3)" opacity="0.5" />
        <rect x="58" y="190" width="40" height="6" rx="3" fill="var(--illus-line)" />
        <rect x="68" y="228" width="20" height="4" rx="2" fill="var(--illus-line)" />
      </g>

      {/* laptop */}
      <g >
        <rect x="238" y="136" width="96" height="66" rx="8" fill="var(--illus-body)" stroke="var(--illus-line)" strokeWidth="2" />
        <rect x="246" y="144" width="80" height="50" rx="4" fill="var(--illus-screen)" />
        <rect x="252" y="150" width="30" height="5" rx="2.5" fill="var(--text-primary)" opacity="0.7" />
        <rect x="252" y="160" width="50" height="4" rx="2" fill="var(--illus-line)" />
        <rect x="252" y="170" width="68" height="6" rx="3" fill="var(--brand-subtle)" />
        <rect x="252" y="170" width="44" height="6" rx="3" fill="var(--brand-base)" />
        <path d="M226 206 H346 L338 214 H234 Z" fill="var(--illus-line)" />
      </g>

      {/* center app icon */}
      <g>
        <rect x="140" y="86" width="80" height="80" rx="20" fill="var(--tile)" />
        <circle cx="180" cy="126" r="20" stroke="var(--tile-ring)" strokeWidth="7" strokeLinecap="round" transform="rotate(-90 180 126)" strokeDasharray="94 32" />
        <circle cx="180" cy="126" r="5.5" fill="var(--brand-base)" />
      </g>

      {/* floating tiles */}
      <g >
        <rect x="128" y="36" width="34" height="34" rx="8" fill="var(--illus-body)" stroke="var(--illus-line)" strokeWidth="1.5" />
        <circle cx="138" cy="47" r="4" fill="var(--illus-photo-2)" />
        <path d="M132 64 L142 54 L150 61 L156 56 L160 64 Z" fill="var(--brand-base)" opacity="0.8" />
      </g>
      <g >
        <rect x="214" y="30" width="28" height="28" rx="7" fill="var(--illus-body)" stroke="var(--illus-line)" strokeWidth="1.5" />
        <path d="M221 44 l5 5 l9 -10" stroke="var(--brand-base)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g >
        <rect x="160" y="236" width="40" height="22" rx="11" fill="var(--illus-body)" stroke="var(--illus-line)" strokeWidth="1.5" />
        <circle cx="172" cy="247" r="3.5" fill="var(--brand-base)" />
        <rect x="179" y="245" width="14" height="4" rx="2" fill="var(--illus-line)" />
      </g>
    </svg>
  );
}
