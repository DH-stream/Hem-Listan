import type { List } from "../types";
import LucideIcon from "./LucideIcon";

interface SharedListIndicatorProps {
  membershipRole?: List["membershipRole"];
  className?: string;
}

export default function SharedListIndicator({
  membershipRole,
  className = "",
}: SharedListIndicatorProps) {
  if (membershipRole !== "member") return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-primary-fixed-dim/50 bg-primary-fixed/35 px-2 py-0.5 font-sans text-[10px] font-bold leading-none text-on-primary-fixed-variant ${className}`}
    >
      <LucideIcon name="person" className="h-3 w-3" />
      Delad med dig
    </span>
  );
}
