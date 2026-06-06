import type { ListMember } from "../types";
import { getProfileInitials } from "../lib/profile";
import LucideIcon from "./LucideIcon";

interface ListMembersProps {
  members: ListMember[] | null;
  className?: string;
}

export default function ListMembers({ members, className = "" }: ListMembersProps) {
  if (!members || members.length < 2) return null;

  return (
    <div
      className={`flex items-center gap-2 text-outline ${className}`}
      aria-label={`${members.length} medlemmar har tillgång till listan`}
    >
      <div className="flex -space-x-1.5" aria-hidden="true">
        {members.slice(0, 4).map((member) => (
          <div
            key={member.userId}
            className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-surface-container-high font-sans text-[9px] font-bold text-text-main"
            title={member.displayName ?? (member.role === "owner" ? "Ägare" : "Medlem")}
          >
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : member.displayName ? (
              getProfileInitials(member.displayName)
            ) : (
              <LucideIcon name="user" className="h-3 w-3" />
            )}
          </div>
        ))}
      </div>
      <span className="font-sans text-[11px] font-medium leading-none">
        {members.length} medlemmar
      </span>
    </div>
  );
}
