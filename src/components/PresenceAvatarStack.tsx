import { useState } from "react";
import { getPresenceInitials, getVisiblePresence, shouldShowPresence, type PresentUser } from "../lib/presence";

interface PresenceAvatarProps {
  user: PresentUser;
}

function PresenceAvatar({ user }: PresenceAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = `${user.displayName} är inne i listan`;

  return (
    <div
      className="presence-avatar relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-emerald-50 text-emerald-800"
      title={label}
      role="img"
      aria-label={label}
    >
      {user.avatarUrl && !imageFailed ? (
        <img
          src={user.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-[10px] font-bold tracking-wide" aria-hidden="true">
          {getPresenceInitials(user.displayName)}
        </span>
      )}
    </div>
  );
}

export default function PresenceAvatarStack({ users }: { users: PresentUser[] }) {
  if (!shouldShowPresence(users)) return null;
  const { visibleUsers, overflowCount } = getVisiblePresence(users);

  return (
    <div className="flex items-center pl-2" role="group" aria-label={`${users.length} aktiva i listan`}>
      {visibleUsers.map((user, index) => (
        <div key={`${user.userId}:${user.avatarUrl ?? "initials"}`} className={index === 0 ? "" : "-ml-2"}>
          <PresenceAvatar user={user} />
        </div>
      ))}
      {overflowCount > 0 && (
        <div
          className="presence-avatar -ml-2 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-surface-container-high px-1.5 text-[10px] font-bold text-text-main"
          title={`${overflowCount} fler är inne i listan`}
          role="img"
          aria-label={`${overflowCount} fler är inne i listan`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
