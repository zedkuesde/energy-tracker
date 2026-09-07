export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 28 28"
      role="img"
      aria-label="Energy Tracker"
    >
      <path
        d="M6 22V11"
        fill="none"
        stroke="var(--energy)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M14 22V6"
        fill="none"
        stroke="var(--fatigue)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M22 22V13"
        fill="none"
        stroke="var(--desire)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
