import LucideIcon from "./LucideIcon";

type InviteStatus = "idle" | "loading" | "success" | "error";

type CollaborativeInviteViewProps = {
  isLoggedIn: boolean;
  status: InviteStatus;
  onLogin: () => void;
  onAccept: () => void;
  onDone: () => void;
};

export default function CollaborativeInviteView({
  isLoggedIn,
  status,
  onLogin,
  onAccept,
  onDone,
}: CollaborativeInviteViewProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl" aria-labelledby="invite-title">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
            <LucideIcon name="person-add" className="h-5 w-5" />
          </div>
          <div>
            <h1 id="invite-title" className="text-lg font-bold text-gray-900">Inbjudan till lista</h1>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">
              Du har blivit inbjuden att samarbeta i en lista. Alla med åtkomst kan ändra listan.
            </p>
          </div>
        </div>

        {!isLoggedIn ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm font-medium text-gray-700">
              Logga in eller skapa ett konto för att gå med i listan.
            </p>
            <button type="button" onClick={onLogin} className="min-h-[44px] w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-[background-color,transform] hover:bg-secondary active:scale-[0.97]">
              Logga in för att fortsätta
            </button>
          </div>
        ) : status === "success" ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-800">
              Klart! Listan har lagts till på din startsida.
            </p>
            <button type="button" onClick={onDone} className="min-h-[44px] w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-[background-color,transform] hover:bg-secondary active:scale-[0.97]">
              Visa mina listor
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {status === "error" && (
              <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                Inbjudan är ogiltig, har gått ut eller har redan använts.
              </p>
            )}
            <button type="button" onClick={onAccept} disabled={status === "loading"} className="min-h-[44px] w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-[background-color,transform] hover:bg-secondary active:scale-[0.97] disabled:cursor-wait disabled:opacity-60">
              {status === "loading" ? "Går med..." : status === "error" ? "Försök igen" : "Gå med i listan"}
            </button>
            {status === "error" && (
              <button type="button" onClick={onDone} className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97]">
                Till startsidan
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
