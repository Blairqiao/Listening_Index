import assert from "node:assert";
import test from "node:test";
import { getRibbonLabels } from "../src/components/MetricRibbon";

test("getRibbonLabels returns queue & device telemetry labels for Mode 3", () => {
  const labels = getRibbonLabels(3);
  assert.deepStrictEqual(labels, ["ACTIVE DEVICE", "PREVIOUS", "UP NEXT", "CONTEXT"]);
});
