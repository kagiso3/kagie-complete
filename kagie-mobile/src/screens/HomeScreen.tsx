import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, DashboardSectionSkeleton, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";
import { useSession } from "../session/SessionProvider";

function formatDate(value?: string) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return "Closed";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days left`;
}

export function HomeScreen() {
  const { user } = useSession();
  const { dashboard, catalog, notifications, sectionLoading, connection } = useKagieData();

  const readiness = Math.max(0, Math.min(100, dashboard?.readiness ?? 0));
  const application = dashboard?.latestApplication;

  const deadlineCards = useMemo(() => (
    (catalog?.institutions || [])
      .filter((item) => item.status !== "closed" && item.isActive !== false)
      .sort((left, right) => new Date(left.applicationDeadline).getTime() - new Date(right.applicationDeadline).getTime())
      .slice(0, 4)
  ), [catalog?.institutions]);

  const accommodationServices = useMemo(() => (
    (catalog?.services || [])
      .filter((item) => /accommodation|housing|residence/i.test(`${item.name} ${item.slug} ${item.description}`))
      .slice(0, 3)
  ), [catalog?.services]);

  const recommendations = useMemo(() => {
    const targeted = (catalog?.updates || []).filter((item) => item.category === "recommendation");
    return (targeted.length ? targeted : (catalog?.updates || [])).slice(0, 3);
  }, [catalog?.updates]);

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Kagie Android</Text>
        <Text style={styles.title}>Welcome back, {(user?.fullName || "Student").split(" ")[0]}</Text>
        <Text style={styles.copy}>Track your tertiary application progress, messages, and payment status from one mobile dashboard.</Text>
        {connection.cacheSavedAt ? (
          <Text style={styles.cacheMeta}>Cached for offline use: {formatDate(connection.cacheSavedAt)}</Text>
        ) : null}
      </View>

      {sectionLoading.summary && !dashboard ? (
        <DashboardSectionSkeleton rows={1} />
      ) : (
        <Card>
          <SectionTitle title="Dashboard summary" hint="Kagie checks your current draft and shows what still needs attention." />
          <View style={styles.readinessRow}>
            <Text style={styles.readinessValue}>{readiness}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${readiness}%` }]} />
            </View>
          </View>
          <Text style={styles.meta}>
            {dashboard?.pack ? `${dashboard.pack.name} selected` : "No package selected yet"}
          </Text>
        </Card>
      )}

      {sectionLoading.applications && !dashboard ? (
        <DashboardSectionSkeleton rows={2} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{dashboard?.quickStats.institutions ?? 0}</Text>
              <Text style={styles.statLabel}>Institutions</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>{dashboard?.quickStats.subjects ?? 0}</Text>
              <Text style={styles.statLabel}>Subjects</Text>
            </Card>
          </View>

          <Card>
            <SectionTitle title="Applications" hint="Your latest application state stays visible while Kagie refreshes the rest." />
            <Text style={styles.pulseTitle}>{application?.status || "Draft"}</Text>
            <Text style={styles.meta}>Payment: {application?.paymentStatus || "Payment Pending"}</Text>
            <Text style={styles.meta}>Support: {dashboard?.supportStatus === "open" ? "Conversation open" : "Resolved"}</Text>
            <Text style={styles.meta}>Unread alerts: {dashboard?.unreadCount ?? 0}</Text>
          </Card>

          <Card>
            <SectionTitle title="Pending tasks" hint="These are the fastest next wins in your Kagie journey." />
            {(dashboard?.pendingTasks || []).length ? (
              dashboard?.pendingTasks.map((item) => (
                <View key={item} style={styles.listItem}>
                  <View style={styles.dot} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))
            ) : (
              <Notice tone="success" message="Your draft looks strong right now. Head to checkout when you are ready." />
            )}
          </Card>
        </>
      )}

      {sectionLoading.deadlines && !catalog ? (
        <DashboardSectionSkeleton rows={3} />
      ) : (
        <Card>
          <SectionTitle title="Deadlines" hint="Upcoming institution deadlines load after the summary so the dashboard stays responsive." />
          {deadlineCards.length ? (
            deadlineCards.map((item) => (
              <View key={item.id} style={styles.deadlineRow}>
                <View style={styles.deadlineCopy}>
                  <Text style={styles.deadlineTitle}>{item.name}</Text>
                  <Text style={styles.meta}>{item.province} | {item.type}</Text>
                  <Text style={styles.meta}>Deadline: {formatDate(item.applicationDeadline)}</Text>
                </View>
                <Text style={styles.deadlineBadge}>{daysUntil(item.applicationDeadline)}</Text>
              </View>
            ))
          ) : (
            <Notice tone="info" message="No open institution deadlines are available yet." />
          )}
        </Card>
      )}

      {sectionLoading.notifications && !notifications.length ? (
        <DashboardSectionSkeleton rows={2} />
      ) : (
        <Card>
          <SectionTitle title="Notifications" hint="Kagie alerts are cached locally and update quietly when the API responds." />
          {notifications.length ? (
            notifications.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.notificationRow}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.message}</Text>
              </View>
            ))
          ) : (
            <Notice tone="info" message="No notifications yet. Deadline reminders and application updates will appear here." />
          )}
        </Card>
      )}

      {sectionLoading.accommodation && !catalog ? (
        <DashboardSectionSkeleton rows={2} />
      ) : (
        <Card>
          <SectionTitle title="Accommodation" hint="Residence and accommodation support stays close to your application flow." />
          {accommodationServices.length ? (
            accommodationServices.map((item) => (
              <View key={item.id} style={styles.serviceRow}>
                <View style={styles.serviceCopy}>
                  <Text style={styles.serviceTitle}>{item.name}</Text>
                  <Text style={styles.meta}>{item.description}</Text>
                </View>
                <Text style={styles.servicePrice}>R{item.price}</Text>
              </View>
            ))
          ) : (
            <Notice tone="info" message="Accommodation assistance will appear here when it is available in the Kagie catalog." />
          )}
        </Card>
      )}

      {sectionLoading.recommendations && !catalog ? (
        <DashboardSectionSkeleton rows={2} />
      ) : (
        <Card>
          <SectionTitle title="Recommendations" hint="Kagie surfaces guidance after core application data has loaded." />
          {recommendations.length ? (
            recommendations.map((item) => (
              <View key={item.id} style={styles.recommendationRow}>
                <Text style={styles.recommendationCategory}>{item.category}</Text>
                <Text style={styles.recommendationTitle}>{item.title}</Text>
                <Text style={styles.meta}>{item.body}</Text>
              </View>
            ))
          ) : (
            <Notice tone="info" message="Recommendations will appear after Kagie reviews more of your application profile." />
          )}
        </Card>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brand,
    borderRadius: 28,
    padding: 22,
    gap: 8
  },
  eyebrow: {
    color: colors.gold,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  copy: {
    color: "rgba(255,255,255,0.88)",
    lineHeight: 21
  },
  cacheMeta: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "700"
  },
  readinessRow: {
    gap: 10
  },
  readinessValue: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text
  },
  progressTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#edf2f9",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.sky
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20
  },
  statsRow: {
    flexDirection: "row",
    gap: 12
  },
  statCard: {
    flex: 1
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.text
  },
  statLabel: {
    color: colors.textMuted
  },
  listItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.orange
  },
  listText: {
    flex: 1,
    color: colors.text,
    lineHeight: 20
  },
  pulseTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.brandDark
  },
  deadlineRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  deadlineCopy: {
    flex: 1,
    gap: 3
  },
  deadlineTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  deadlineBadge: {
    color: colors.brandDark,
    backgroundColor: colors.dangerSoft,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "900"
  },
  notificationRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  notificationTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  serviceRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  serviceCopy: {
    flex: 1,
    gap: 4
  },
  serviceTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  servicePrice: {
    color: colors.brand,
    fontWeight: "900"
  },
  recommendationRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  recommendationCategory: {
    color: colors.sky,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  recommendationTitle: {
    color: colors.text,
    fontWeight: "900"
  }
});
