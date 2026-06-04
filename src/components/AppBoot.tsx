import { useEffect, useState } from "react";
import App from "../App";
import { ensureLatestAppVersion } from "../lib/appVersion";

const MIN_BOOT_DURATION_MS = 700;

const wait = (duration: number) => new Promise(resolve => window.setTimeout(resolve, duration));

export default function AppBoot() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      const [isReloading] = await Promise.all([
        ensureLatestAppVersion(),
        wait(MIN_BOOT_DURATION_MS),
      ]);

      if (isMounted && !isReloading) {
        setIsReady(true);
      }
    };

    boot();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {isReady && (
        <div className="hem-app-enter">
          <App />
        </div>
      )}

      <div
        className={`fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center bg-[#FAF9F5] px-8 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isReady ? "pointer-events-none scale-[1.01] opacity-0" : "opacity-100"
        }`}
        aria-hidden={isReady}
      >
        <div className="hem-boot-mark relative flex flex-col items-center">
          <div className="absolute -inset-12 rounded-full bg-[#B3F3A6]/25 blur-3xl" />
          <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white/80 shadow-[0_24px_70px_rgba(0,59,5,0.10)] ring-1 ring-[#003B05]/5 backdrop-blur-sm">
            <span className="hem-boot-ring absolute h-16 w-16 rounded-[1.55rem] border border-[#98D68C]/50" />
            <img src="/logo.png" alt="" className="relative h-12 w-12 object-contain" />
          </div>
          <p className="relative font-display text-[1.7rem] font-extrabold tracking-[-0.06em] text-[#003B05]">
            Hem-Listan
          </p>
          <span className="hem-boot-dot relative mt-4 h-2 w-2 rounded-full bg-[#98D68C] shadow-[0_0_24px_rgba(50,106,45,0.45)]" />
        </div>
      </div>
    </>
  );
}
