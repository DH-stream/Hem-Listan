import { motion } from "motion/react";
import LucideIcon from "./LucideIcon";

interface CelebrationCardProps {
  listName: string;
  totalTasks: number;
  onReset: () => void;
}

export default function CelebrationCard({ listName, totalTasks, onReset }: CelebrationCardProps) {
  // Generate random drifting organic confetti colors matching our calm palette
  const leaves = [
    { color: "bg-[#A5D6A7]", size: "w-2.5 h-2.5", delay: 0, x: -60 },
    { color: "bg-[#FFE0B2]", size: "w-3 h-2", delay: 0.3, x: 50 },
    { color: "bg-[#FFE4E1]", size: "w-2 h-3", delay: 0.6, x: -30 },
    { color: "bg-[#E0F2F1]", size: "w-2.5 h-2.5", delay: 1, x: 40 },
    { color: "bg-[#FFCC80]", size: "w-2 h-2", delay: 1.4, x: -10 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 180 }}
      className="bg-gradient-to-br from-white to-[#FDFBF7] p-8 rounded-2xl border border-primary/10 shadow-lg text-center relative overflow-hidden flex flex-col items-center justify-center my-6"
    >
      {/* Drifting subtle visual elements (confetti petals falling) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {leaves.map((l, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full opacity-60 ${l.color} ${l.size}`}
            initial={{ y: -20, x: l.x, opacity: 0, rotate: 0 }}
            animate={{
              y: [0, 200],
              x: [l.x, l.x + (i % 2 === 0 ? 30 : -30)],
              opacity: [0, 0.7, 0.7, 0],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              delay: l.delay,
              ease: "linear"
            }}
            style={{ left: `calc(50% + ${l.x}px)` }}
          />
        ))}
      </div>

      {/* Cozy Swedish Fika line art with steaming motion */}
      <div className="relative mb-6">
        <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center relative">
          {/* Animated Rising Steam */}
          <div className="absolute top-4 flex gap-1 justify-center w-full">
            {[1, 2, 3].map((val) => (
              <motion.div
                key={val}
                className="w-0.5 h-3 bg-primary/40 rounded-full"
                animate={{
                  y: [0, -10],
                  opacity: [0, 1, 0],
                  scaleY: [0.6, 1.2, 0.8]
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: val * 0.4,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>

          {/* Coffee/Tea Cup Line Art */}
          <svg
            className="w-12 h-12 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Cup outline */}
            <path d="M17 8H6c-1.1 0-2 .9-2 2v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4v-6c0-1.1-.9-2-2-2z" />
            {/* Cup handle */}
            <path d="M17 11h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" />
            {/* Heart symbol on the cup for a peaceful aesthetic */}
            <path
              d="M10 12.5c-.5-.5-1.2-.5-1.7 0a1.2 1.2 0 0 0 0 1.7L10 16l1.7-1.8a1.2 1.2 0 0 0 0-1.7c-.5-.5-1.2-.5-1.7 0z"
              fill="currentColor"
              className="text-primary/10"
              strokeWidth="0.5"
            />
            {/* Saucer */}
            <line x1="3" y1="22" x2="19" y2="22" />
          </svg>
        </div>

        {/* Shimmering Badge */}
        <motion.div
          className="absolute -bottom-2 -right-2 bg-accent-rust text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <LucideIcon name="favorite" className="w-4 h-4 text-white" />
        </motion.div>
      </div>

      <p className="font-sans text-[10px] uppercase font-bold tracking-widest text-accent-rust mb-1.5 leading-none">
        Underbart jobbat! ✨
      </p>
      
      <h3 className="font-display text-lg font-bold text-text-main mb-2">
        Helt klar med {listName}!
      </h3>

      <p className="font-sans text-xs text-outline font-medium max-w-sm mb-6 leading-relaxed">
        Du har bockat av alla <span className="font-bold text-primary">{totalTasks}</span> punkter på listan. Slå dig ner, ta en fika och njut av ett helt tomt schema!
      </p>

      <div className="flex flex-col sm:flex-row gap-2.5 w-full justify-center">
        <button
          onClick={onReset}
          className="bg-primary hover:bg-primary-container text-white rounded-xl px-5 py-3 font-display text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all outline-none flex items-center justify-center gap-2 cursor-pointer"
        >
          <LucideIcon name="refresh" className="w-4 h-4 text-white" />
          <span>Återställ listan</span>
        </button>
      </div>
    </motion.div>
  );
}
