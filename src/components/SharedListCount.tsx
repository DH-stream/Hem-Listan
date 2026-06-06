import SharedHandshakeIcon from "./SharedHandshakeIcon";

interface SharedListCountProps {
  count?: number;
  className?: string;
}

export default function SharedListCount({ count, className = "" }: SharedListCountProps) {
  if (!count || count < 2) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-primary ${className}`}
      aria-label={`${count} medlemmar har tillgång till listan`}
      title={`${count} medlemmar`}
    >
      <SharedHandshakeIcon className="h-4 w-4" aria-hidden="true" />
      <span className="font-sans text-[11px] font-bold leading-none">{count}</span>
    </span>
  );
}
