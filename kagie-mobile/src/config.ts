const configuredApiBaseUrl = String(process.env.EXPO_PUBLIC_KAGIE_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
const defaultDevApiBaseUrl = "http://10.0.2.2:4000/v1";
const isDevRuntime = typeof __DEV__ !== "undefined" ? __DEV__ : false;
const resolvedApiBaseUrl = configuredApiBaseUrl || (isDevRuntime ? defaultDevApiBaseUrl : "");
const localApiPattern = /(?:^https?:\/\/)?(?:10\.0\.2\.2|127\.0\.0\.1|localhost|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/i;
const retiredHostPattern = /(?:kagie\.co\.za)/i;

export const mobileConfig = {
  apiBaseUrl: resolvedApiBaseUrl,
  isDevRuntime,
  hasConfiguredApiBaseUrl: Boolean(configuredApiBaseUrl),
  usesLocalApiBaseUrl: localApiPattern.test(resolvedApiBaseUrl),
  usesRetiredHostApiBaseUrl: retiredHostPattern.test(resolvedApiBaseUrl),
  playStoreReadyApi: Boolean(resolvedApiBaseUrl)
    && (!localApiPattern.test(resolvedApiBaseUrl) || isDevRuntime)
    && !retiredHostPattern.test(resolvedApiBaseUrl)
};
