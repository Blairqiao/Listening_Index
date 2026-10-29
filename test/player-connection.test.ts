import { test } from "node:test";
import assert from "node:assert/strict";
import { createSingleFlight } from "../src/lib/async-utils";

test("AC-6a: createSingleFlight coalesces concurrent executions into a single invocation", async () => {
  const singleFlight = createSingleFlight<string>();
  let executions = 0;

  const slowTask = async () => {
    executions++;
    await new Promise((r) => setTimeout(r, 50));
    return `result-${executions}`;
  };

  // Launch three concurrent callers
  const [res1, res2, res3] = await Promise.all([
    singleFlight(slowTask),
    singleFlight(slowTask),
    singleFlight(slowTask),
  ]);

  assert.equal(executions, 1, "Underlying task should only execute once for concurrent calls");
  assert.equal(res1, "result-1");
  assert.equal(res2, "result-1");
  assert.equal(res3, "result-1");
});

test("AC-6b: createSingleFlight allows new execution after previous in-flight task settles", async () => {
  const singleFlight = createSingleFlight<number>();
  let counter = 0;

  const task = async () => {
    counter++;
    return counter;
  };

  const res1 = await singleFlight(task);
  assert.equal(res1, 1);
  assert.equal(counter, 1);

  const res2 = await singleFlight(task);
  assert.equal(res2, 2);
  assert.equal(counter, 2);
});

test("AC-6c: createSingleFlight resets properly after rejection", async () => {
  const singleFlight = createSingleFlight<string>();
  let attempts = 0;

  const failingTask = async () => {
    attempts++;
    throw new Error(`failure-${attempts}`);
  };

  await assert.rejects(
    () => Promise.all([singleFlight(failingTask), singleFlight(failingTask)]),
    /failure-1/
  );
  assert.equal(attempts, 1, "Concurrent failing calls should coalesce into one failed execution");

  // Subsequent call after failure should execute normally
  const successTask = async () => "recovered";
  const res = await singleFlight(successTask);
  assert.equal(res, "recovered");
});
