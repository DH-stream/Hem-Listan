import type { TaskItem } from "../types";

export type BuildSketchDimensions = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type BuildSketchWallId = "A" | "B" | "C" | "D";

export type BuildSketchWallMeasurement = {
  id: BuildSketchWallId;
  lengthCm: number;
  heightCm: number;
  areaM2: number;
};

export const BUILD_SKETCH_TASK_MARKER = "__BUILD_SKETCH_DATA__";

export const DEFAULT_BUILD_SKETCH_DIMENSIONS: BuildSketchDimensions = {
  lengthCm: 400,
  widthCm: 300,
  heightCm: 240,
};

const MIN_DIMENSION_CM = 50;
const MAX_DIMENSION_CM = 3000;

export const clampDimensionCm = (value: unknown): number => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return MIN_DIMENSION_CM;
  return Math.min(MAX_DIMENSION_CM, Math.max(MIN_DIMENSION_CM, Math.round(numericValue)));
};

const normalizeDimensions = (value: Partial<BuildSketchDimensions>): BuildSketchDimensions => ({
  lengthCm: clampDimensionCm(value.lengthCm ?? DEFAULT_BUILD_SKETCH_DIMENSIONS.lengthCm),
  widthCm: clampDimensionCm(value.widthCm ?? DEFAULT_BUILD_SKETCH_DIMENSIONS.widthCm),
  heightCm: clampDimensionCm(value.heightCm ?? DEFAULT_BUILD_SKETCH_DIMENSIONS.heightCm),
});

export const findBuildSketchTask = (tasks: TaskItem[]): TaskItem | undefined =>
  tasks.find((task) => task.type === "note" && task.text === BUILD_SKETCH_TASK_MARKER);

export const parseBuildSketchData = (tasks: TaskItem[]): BuildSketchDimensions => {
  const task = findBuildSketchTask(tasks);
  if (!task?.notes) return DEFAULT_BUILD_SKETCH_DIMENSIONS;

  try {
    const parsed: unknown = JSON.parse(task.notes);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_BUILD_SKETCH_DIMENSIONS;
    }
    return normalizeDimensions(parsed as Partial<BuildSketchDimensions>);
  } catch (_) {
    return DEFAULT_BUILD_SKETCH_DIMENSIONS;
  }
};

export const createBuildSketchTaskData = (dimensions: BuildSketchDimensions): Omit<TaskItem, "id"> => ({
  text: BUILD_SKETCH_TASK_MARKER,
  checked: false,
  type: "note",
  notes: JSON.stringify(normalizeDimensions(dimensions)),
});

export const calculateFloorArea = (dimensions: BuildSketchDimensions): number =>
  (dimensions.lengthCm * dimensions.widthCm) / 10000;

export const calculateWallMeasurements = (
  dimensions: BuildSketchDimensions,
): BuildSketchWallMeasurement[] => {
  const { lengthCm, widthCm, heightCm } = dimensions;
  return [
    { id: "A", lengthCm, heightCm, areaM2: (lengthCm * heightCm) / 10000 },
    { id: "B", lengthCm: widthCm, heightCm, areaM2: (widthCm * heightCm) / 10000 },
    { id: "C", lengthCm, heightCm, areaM2: (lengthCm * heightCm) / 10000 },
    { id: "D", lengthCm: widthCm, heightCm, areaM2: (widthCm * heightCm) / 10000 },
  ];
};
