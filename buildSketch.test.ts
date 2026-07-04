import test from "node:test";
import assert from "node:assert/strict";
import {
  BUILD_SKETCH_TASK_MARKER,
  DEFAULT_BUILD_SKETCH_DIMENSIONS,
  calculateFloorArea,
  calculateWallMeasurements,
  clampDimensionCm,
  createBuildSketchTaskData,
  parseBuildSketchData,
} from "./src/lib/buildSketch";
import type { List, TaskItem } from "./src/types";

test("build_sketch is a valid list category", () => {
  const list: List = { id: "b", name: "Byggskiss", icon: "architecture", themeColor: "#2f5f73", category: "build_sketch", tasks: [] };
  assert.equal(list.category, "build_sketch");
});

test("parse default dimensions when no marker task exists", () => {
  assert.deepEqual(parseBuildSketchData([]), DEFAULT_BUILD_SKETCH_DIMENSIONS);
});

test("parse saved dimensions from marker task", () => {
  const tasks: TaskItem[] = [{ id: "1", ...createBuildSketchTaskData({ lengthCm: 520, widthCm: 410, heightCm: 255 }) }];
  assert.deepEqual(parseBuildSketchData(tasks), { lengthCm: 520, widthCm: 410, heightCm: 255 });
});

test("ignore invalid JSON and fall back to defaults", () => {
  const tasks: TaskItem[] = [{ id: "1", text: BUILD_SKETCH_TASK_MARKER, checked: false, type: "note", notes: "{" }];
  assert.deepEqual(parseBuildSketchData(tasks), DEFAULT_BUILD_SKETCH_DIMENSIONS);
});

test("calculate floor area correctly", () => {
  assert.equal(calculateFloorArea({ lengthCm: 400, widthCm: 300, heightCm: 240 }), 12);
});

test("calculate wall lengths correctly", () => {
  const walls = calculateWallMeasurements({ lengthCm: 400, widthCm: 300, heightCm: 240 });
  assert.deepEqual(walls.map((wall) => [wall.id, wall.lengthCm, wall.heightCm]), [["A", 400, 240], ["B", 300, 240], ["C", 400, 240], ["D", 300, 240]]);
});

test("clamp dimensions to reasonable ranges", () => {
  assert.equal(clampDimensionCm(12), 50);
  assert.equal(clampDimensionCm(3500), 3000);
  assert.equal(clampDimensionCm(250.4), 250);
});
