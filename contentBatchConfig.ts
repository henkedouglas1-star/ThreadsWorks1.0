export const CONTENT_BATCH_SIZES = [1, 4, 7] as const;
export const DEFAULT_CONTENT_BATCH_SIZE = 4;
export const MAX_CONTENT_BATCH_SIZE = 7;
export const CONTENT_BATCH_TARGET_MS = 20_000;

export function normalizeContentBatchSelection(value: unknown): string {
  return CONTENT_BATCH_SIZES.some(size => String(size) === value)
    ? String(value)
    : String(DEFAULT_CONTENT_BATCH_SIZE);
}
