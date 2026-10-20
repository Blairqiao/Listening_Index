/**
 * Backwards-compatible aggregator for mock listening data and domain types.
 * Canonical domain types are defined in @/lib/types.
 * Modular mock datasets are in @/lib/mock/.
 */

export * from "./types";
export { CATALOG } from "./mock/catalog";
export { MOCK_DATA } from "./mock/overview-data";
export {
  ALL_MOCK_STREAM_LOG_ENTRIES,
  getMockStreamLog,
} from "./mock/stream-log";
