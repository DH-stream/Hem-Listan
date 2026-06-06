import type { SVGProps } from "react";

export default function SharedHandshakeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="7" cy="7" r="2.25" />
      <circle cx="17" cy="7" r="2.25" />
      <path d="M3.75 13c.35-1.65 1.55-2.6 3.25-2.6 1.15 0 2.1.45 2.7 1.25" />
      <path d="M20.25 13c-.35-1.65-1.55-2.6-3.25-2.6-1.15 0-2.1.45-2.7 1.25" />
      <path d="m8.6 14.25 1.45-1.05c.5-.35 1.15-.3 1.6.1l.35.3.35-.3c.45-.4 1.1-.45 1.6-.1l1.45 1.05" />
      <path d="m8.6 14.25 1.75 1.65c.45.4 1.1.4 1.5 0l.15-.15.15.15c.4.4 1.05.4 1.5 0l1.75-1.65" />
    </svg>
  );
}
