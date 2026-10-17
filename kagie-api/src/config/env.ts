function splitOrigins(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || "development";
const primaryWebAppUrl = (
  process.env.WEB_APP_URL ||
  (nodeEnv === "production" ? "https://kagie.app" : "http://localhost:8080")
).replace(/\/+$/, "");

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  webAppUrl: primaryWebAppUrl,
  allowedOrigins: [
    primaryWebAppUrl,
    ...splitOrigins(process.env.KAGIE_ALLOWED_ORIGINS),
    "https://kagie.co.za",
    "https://www.kagie.co.za",
    "https://kagie.app",
    "https://www.kagie.app"
  ].filter((origin, index, list) => origin && list.indexOf(origin) === index),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || (nodeEnv === "production" ? "" : "dev-access-secret-change-me"),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || (nodeEnv === "production" ? "" : "dev-refresh-secret-change-me"),
  databaseProvider: process.env.DATABASE_PROVIDER || "postgres",
  databaseUrl: process.env.DATABASE_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
};
