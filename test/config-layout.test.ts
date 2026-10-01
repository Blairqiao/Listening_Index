import assert from "node:assert";
import test from "node:test";
import { normalizeSiteConfig, areSiteConfigsEqual, DEFAULT_SITE_CONFIG } from "../src/lib/config-utils";

test("SiteConfigState handles livePlayerLayout normalization", () => {
  const cfg = normalizeSiteConfig({ livePlayerLayout: "stacked" });
  assert.strictEqual(cfg.livePlayerLayout, "stacked");

  const defaultCfg = normalizeSiteConfig({});
  assert.strictEqual(defaultCfg.livePlayerLayout, "split");

  const invalidCfg = normalizeSiteConfig({ livePlayerLayout: "invalid" as any });
  assert.strictEqual(invalidCfg.livePlayerLayout, "split");
});

test("areSiteConfigsEqual detects livePlayerLayout changes", () => {
  const a = { ...DEFAULT_SITE_CONFIG, livePlayerLayout: "split" as const };
  const b = { ...DEFAULT_SITE_CONFIG, livePlayerLayout: "stacked" as const };
  assert.strictEqual(areSiteConfigsEqual(a, b), false);
  assert.strictEqual(areSiteConfigsEqual(a, { ...a }), true);
});
