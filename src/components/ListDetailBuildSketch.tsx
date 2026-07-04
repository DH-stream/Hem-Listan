import React, { useMemo, useState } from "react";
import type { List, ListMember, TaskItem } from "../types";
import {
  BUILD_SKETCH_TASK_MARKER,
  calculateFloorArea,
  calculateWallMeasurements,
  clampDimensionCm,
  createBuildSketchTaskData,
  findBuildSketchTask,
  parseBuildSketchData,
  type BuildSketchDimensions,
  type BuildSketchWallId,
} from "../lib/buildSketch";
import type { PresentUser } from "../lib/presence";
import LucideIcon from "./LucideIcon";
import ListNameEditor from "./ListNameEditor";
import PresenceAvatarStack from "./PresenceAvatarStack";
import SharedListCount from "./SharedListCount";

interface ListDetailBuildSketchProps {
  list: List;
  members: ListMember[] | null;
  presentUsers: PresentUser[];
  onBack: () => void;
  onAddTask: (listId: string, text: string, categoryName?: string, taskType?: "task" | "note" | "progress" | "link", url?: string, notes?: string, progress?: number) => void;
  onUpdateTask: (listId: string, taskId: string, updates: Partial<TaskItem>) => void;
  onRenameList: (listId: string, name: string) => Promise<boolean>;
}

const formatM2 = (value: number) => `${value.toFixed(1)} m²`;

export default function ListDetailBuildSketch({
  list,
  members,
  presentUsers,
  onBack,
  onAddTask,
  onUpdateTask,
  onRenameList,
}: ListDetailBuildSketchProps) {
  const dimensions = useMemo(() => parseBuildSketchData(list.tasks), [list.tasks]);
  const walls = useMemo(() => calculateWallMeasurements(dimensions), [dimensions]);
  const [selectedWallId, setSelectedWallId] = useState<BuildSketchWallId>("A");
  const selectedWall = walls.find((wall) => wall.id === selectedWallId) ?? walls[0];
  const floorArea = calculateFloorArea(dimensions);

  const persistDimensions = (next: BuildSketchDimensions) => {
    const task = findBuildSketchTask(list.tasks);
    const taskData = createBuildSketchTaskData(next);
    if (task) {
      onUpdateTask(list.id, task.id, { notes: taskData.notes, text: BUILD_SKETCH_TASK_MARKER, type: "note", checked: false });
    } else {
      onAddTask(list.id, taskData.text, undefined, taskData.type, undefined, taskData.notes);
    }
  };

  const handleDimensionChange = (field: keyof BuildSketchDimensions, value: string) => {
    persistDimensions({ ...dimensions, [field]: clampDimensionCm(value) });
  };

  const wallClass = (wallId: BuildSketchWallId) =>
    selectedWallId === wallId ? "fill-[#6BA4B8]/45 stroke-[#1F5F75]" : "fill-white/65 stroke-[#7CA7B5]/70 hover:fill-[#DDEFF5]";

  return (
    <div className="w-full max-w-[768px] mx-auto px-5 pb-28">
      <header className="relative sticky top-0 z-40 mb-3 h-[76px] w-full bg-surface/80 backdrop-blur-xl">
        <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
          <button onClick={onBack} className="shrink-0 rounded-full p-1.5 text-primary transition-all hover:bg-surface-container active:scale-90" title="Gå tillbaka">
            <LucideIcon name="arrow_back" className="h-6 w-6" />
          </button>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[calc(100%_-_15rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:w-[calc(100%_-_26.5rem)] [&>div]:pointer-events-auto [&>div]:max-w-full [&>form]:pointer-events-auto [&>form]:max-w-full">
          <ListNameEditor name={list.name} canRename={list.membershipRole !== "member"} onRename={(name) => onRenameList(list.id, name)} headingClassName="min-w-0 truncate font-display text-xl font-bold text-text-main" />
          <SharedListCount count={members?.length ?? list.memberCount} className="mt-1" />
        </div>
        <div className="absolute right-0 top-1/2 flex w-20 -translate-y-1/2 justify-end sm:w-28">
          <PresenceAvatarStack users={presentUsers} />
        </div>
      </header>

      <section className="mb-5 rounded-2xl p-5 text-white shadow-[0px_4px_20px_rgba(0,59,5,0.04)]" style={{ backgroundColor: list.themeColor || "#2F5F73" }}>
        <p className="mb-1 font-sans text-[10px] font-bold uppercase leading-none tracking-widest text-white/70">Byggskiss</p>
        <h2 className="mb-4 font-display text-2xl font-bold tracking-tight">Skissa rum och väggmått</h2>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/18 px-3 py-1.5">4 väggar</span>
          <span className="rounded-full bg-white/18 px-3 py-1.5">{formatM2(floorArea)}</span>
          <span className="rounded-full bg-white/18 px-3 py-1.5">Takhöjd {dimensions.heightCm} cm</span>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-3 gap-3">
        {(["lengthCm", "widthCm", "heightCm"] as const).map((field) => (
          <label key={field} className="rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-outline/10">
            <span className="block text-[11px] font-bold text-on-surface-variant">{field === "lengthCm" ? "Längd" : field === "widthCm" ? "Bredd" : "Höjd"}</span>
            <input type="number" min={50} max={3000} inputMode="numeric" value={dimensions[field]} onChange={(event) => handleDimensionChange(field, event.target.value)} className="mt-2 w-full rounded-xl bg-surface-muted px-3 py-3 text-sm font-bold text-text-main outline-none focus:ring-2 focus:ring-primary" />
            <span className="mt-1 block text-[10px] text-on-surface-variant">cm</span>
          </label>
        ))}
      </section>

      <section className="mb-5 rounded-3xl bg-[#F7FBFC] p-4 shadow-sm ring-1 ring-[#B9D2DB]/50">
        <svg viewBox="0 0 360 280" role="img" aria-label="Isometrisk rumsskiss" className="h-auto w-full">
          <defs>
            <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#DCECEF" strokeWidth="1" /></pattern>
          </defs>
          <rect width="360" height="280" rx="24" fill="url(#blueprint-grid)" />
          <polygon points="92,126 190,72 294,126 194,190" className="fill-[#EAF4F7] stroke-[#7CA7B5]" strokeWidth="2" />
          <polygon points="92,126 194,190 194,244 92,180" className={`cursor-pointer transition-colors ${wallClass("A")}`} strokeWidth="2" onClick={() => setSelectedWallId("A")} />
          <polygon points="194,190 294,126 294,180 194,244" className={`cursor-pointer transition-colors ${wallClass("B")}`} strokeWidth="2" onClick={() => setSelectedWallId("B")} />
          <polygon points="92,72 190,20 294,72 294,126 190,72 92,126" className={`cursor-pointer transition-colors ${wallClass("C")}`} strokeWidth="2" onClick={() => setSelectedWallId("C")} />
          <polygon points="92,72 92,126 92,180 56,154 56,100" className={`cursor-pointer transition-colors ${wallClass("D")}`} strokeWidth="2" onClick={() => setSelectedWallId("D")} />
          <g className="select-none font-sans text-[13px] font-bold fill-[#1F5F75]">
            <text x="138" y="184">A</text><text x="244" y="184">B</text><text x="190" y="62">C</text><text x="68" y="130">D</text>
            <text x="142" y="222">{dimensions.lengthCm} cm</text><text x="246" y="222">{dimensions.widthCm} cm</text><text x="304" y="156">{dimensions.heightCm} cm</text>
          </g>
        </svg>
      </section>

      <section className="rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-outline/10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Vald vägg</p>
        <h3 className="mt-1 font-display text-xl font-bold text-text-main">Vägg {selectedWall.id}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-surface-muted p-3"><b className="block text-sm text-text-main">{selectedWall.lengthCm}</b>Längd cm</div>
          <div className="rounded-xl bg-surface-muted p-3"><b className="block text-sm text-text-main">{selectedWall.heightCm}</b>Höjd cm</div>
          <div className="rounded-xl bg-surface-muted p-3"><b className="block text-sm text-text-main">{formatM2(selectedWall.areaM2)}</b>Yta</div>
        </div>
      </section>
    </div>
  );
}
