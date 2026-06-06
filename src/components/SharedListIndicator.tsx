import { motion } from "motion/react";
import type { List } from "../types";
import SharedHandshakeIcon from "./SharedHandshakeIcon";

interface SharedListIndicatorProps {
  membershipRole?: List["membershipRole"];
  className?: string;
  iconOnly?: boolean;
}

export default function SharedListIndicator({
  membershipRole,
  className = "",
  iconOnly = false,
}: SharedListIndicatorProps) {
  if (membershipRole !== "member") return null;

  if (iconOnly) {
    return (
      <motion.span
        initial={{ opacity: 0, scale: 0.92, y: 2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className={`inline-flex shrink-0 items-center justify-center text-primary ${className}`}
        aria-label="Delad lista"
        title="Delad lista"
      >
        <SharedHandshakeIcon className="h-5 w-5" />
      </motion.span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-primary-fixed-dim/50 bg-primary-fixed/35 px-2 py-0.5 font-sans text-[10px] font-bold leading-none text-on-primary-fixed-variant ${className}`}
    >
      <SharedHandshakeIcon className="h-3 w-3" />
      Delad med dig
    </span>
  );
}
