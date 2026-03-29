import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";
import { useSession } from "../session/SessionProvider";

export function HomeScreen() {
  const { user } = useSession();
  const { dashboard } = useKagieData();

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Kagie Android</Text>
        <Text style={styles.title}>Welcome back, {(user?.fullName || "Student").split(" ")[0]}</Text>
        <Text style={styles.copy}>Track your tertiary application progress, messages, and payment status from one mobile dashboard.</Text>
      </View>

      <Card>
        <SectionTitle title="Readiness" hint="Kagie checks your current draft and shows what still needs attention." />
        <View style={styles.readinessRow}>
          <Text style={styles.readinessValue}>{dashboard?.readiness ?? 0}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${dashboard?.readiness ?? 0}%` }]} />
          </View>
        </View>
        <Text style={styles.meta}>
          {dashboard?.pack ? `${dashboard.pack.name} selected` : "No package selected yet"}
        </Text>
      </Card>

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

      <Card>
        <SectionTitle title="Application pulse" hint="Kagie keeps the latest submission and assistant lane visible." />
        <Text style={styles.pulseTitle}>{dashboard?.latestApplication?.status || "Draft"}</Text>
        <Text style={styles.meta}>Payment: {dashboard?.latestApplication?.paymentStatus || "Payment Pending"}</Text>
        <Text style={styles.meta}>Support lane: {dashboard?.supportStatus === "open" ? "Assistant conversation open" : "Resolved"}</Text>
        <Text style={styles.meta}>Unread alerts: {dashboard?.unreadCount ?? 0}</Text>
      </Card>
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
  }
});
