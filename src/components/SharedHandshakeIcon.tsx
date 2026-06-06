import type { SVGProps } from "react";

export default function SharedHandshakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="7" cy="6.5" r="2" />
      <circle cx="17" cy="6.5" r="2" />
      <path d="m3.5 16 3.2-3.2 3.1 2.7" />
      <path d="m20.5 16-3.2-3.2-3.1 2.7" />
      <path d="m9.8 15.5 1.2-1.1a1.5 1.5 0 0 1 2 0l1.2 1.1" />
      <path d="m9.8 15.5 1.25 1.2a1.35 1.35 0 0 0 1.9 0l1.25-1.2" />
      <path d="m5 14.5 2.6 2.6" />
      <path d="m19 14.5-2.6 2.6" />
    </svg>
  );
}
