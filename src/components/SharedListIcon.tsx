import type { SVGProps } from "react";

export default function SharedListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="7.5" y="3" width="9" height="10" rx="1.5" />
      <line x1="9.5" y1="6" x2="14.5" y2="6" />
      <line x1="9.5" y1="8.5" x2="14.5" y2="8.5" />
      <line x1="9.5" y1="11" x2="13" y2="11" />
      <circle cx="4.5" cy="16" r="1.4" />
      <path d="M1.5 21 Q2.5 19 4.5 19 Q6.5 19 7.5 21" />
      <path d="M7 20 Q8 17 9.5 13" />
      <circle cx="19.5" cy="16" r="1.4" />
      <path d="M16.5 21 Q17.5 19 19.5 19 Q21.5 19 22.5 21" />
      <path d="M17 20 Q16 17 14.5 13" />
    </svg>
  );
}
