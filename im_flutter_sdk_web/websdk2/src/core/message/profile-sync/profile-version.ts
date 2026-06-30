export const MAX_PROFILE_VERSION_SECONDS = 0x7fffffff;

export const normalizeProfileVersionSeconds = (value: unknown): number | undefined => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }
  const seconds = Math.floor(numericValue);
  if (seconds <= 0 || seconds > MAX_PROFILE_VERSION_SECONDS) {
    return undefined;
  }
  return seconds;
};

export const normalizeProfileVersionFromTimestamp = (
  value: number | undefined
): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  const normalizedValue =
    value > MAX_PROFILE_VERSION_SECONDS ? Math.floor(value / 1000) : Math.floor(value);
  return normalizeProfileVersionSeconds(normalizedValue);
};
