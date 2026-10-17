import { Router } from "express";
import { getPublicStats } from "./public.service";

const router = Router();
const PUBLIC_STATS_CACHE_CONTROL = "public, max-age=60, s-maxage=900, stale-while-revalidate=3600";
const PUBLIC_STATS_CDN_CACHE_CONTROL = "public, max-age=900, stale-while-revalidate=3600";

router.get("/stats", async (_req, res) => {
  try {
    const stats = await getPublicStats();
    res.setHeader("Cache-Control", PUBLIC_STATS_CACHE_CONTROL);
    res.setHeader("CDN-Cache-Control", PUBLIC_STATS_CDN_CACHE_CONTROL);
    res.setHeader("Vercel-CDN-Cache-Control", PUBLIC_STATS_CDN_CACHE_CONTROL);
    return res.status(200).json({
      data: {
        available: true,
        ...stats
      }
    });
  } catch (error) {
    console.warn(
      "[Kagie public stats] Public counts are unavailable.",
      error instanceof Error ? error.message : "Unknown public stats error."
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Vercel-CDN-Cache-Control", "no-store");
    return res.status(503).json({
      data: {
        available: false,
        generatedAt: new Date().toISOString()
      },
      message: "Public stats are temporarily unavailable."
    });
  }
});

export { router as publicRouter };
