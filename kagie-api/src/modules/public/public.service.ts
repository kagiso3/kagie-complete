import { getSupabasePublicClient } from "../../lib/supabase-public";

export type PublicStats = {
  openInstitutions: number;
  publishedOpportunities: number;
  generatedAt: string;
};

function requireExactCount(count: number | null, source: string) {
  if (!Number.isInteger(count) || (count ?? -1) < 0) {
    throw new Error(`${source} did not return an exact count.`);
  }
  return count as number;
}

export async function getPublicStats(): Promise<PublicStats> {
  const client = getSupabasePublicClient();
  const today = new Date().toISOString().slice(0, 10);

  const [institutionsResult, opportunitiesResult] = await Promise.all([
    client
      .from("institutions")
      .select("id", { count: "exact", head: true })
      .or("is_visible.is.null,is_visible.eq.true")
      .or("application_status.is.null,application_status.in.(open,closing_soon,auto)")
      .or(`opening_date.is.null,opening_date.lte.${today}`)
      .or(`closing_date.is.null,closing_date.gte.${today}`),
    client
      .from("career_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .in("content_type", ["job", "internship"])
  ]);

  if (institutionsResult.error || opportunitiesResult.error) {
    throw new Error("Public stats data is unavailable.", {
      cause: institutionsResult.error || opportunitiesResult.error
    });
  }

  return {
    openInstitutions: requireExactCount(institutionsResult.count, "Open institutions"),
    publishedOpportunities: requireExactCount(opportunitiesResult.count, "Published opportunities"),
    generatedAt: new Date().toISOString()
  };
}
