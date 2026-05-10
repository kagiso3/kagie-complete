import { ROLES } from "@kagie/shared";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Notice, ScreenScroll, SectionTitle } from "../components/ui";
import { apiClient } from "../lib/api";
import { useSession } from "../session/SessionProvider";
import { colors } from "../theme";

type AdminInstitution = {
  id: string;
  name: string;
  province: string;
  type: string;
  year?: string;
  status?: "open" | "closing_soon" | "closed";
  isActive?: boolean;
};

function displayStatus(institution: AdminInstitution) {
  if (institution.isActive === false) return "closed";
  return institution.status || "open";
}

export function AdminScreen() {
  const { user, logout } = useSession();
  const [institutions, setInstitutions] = useState<AdminInstitution[]>([]);
  const [loading, setLoading] = useState(user?.role === ROLES.MASTER_ADMIN);
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn" | "info"; text: string } | null>(null);

  async function loadAdminData() {
    if (user?.role !== ROLES.MASTER_ADMIN) return;
    setLoading(true);
    try {
      const rows = await apiClient.getAdminInstitutions("") as AdminInstitution[];
      setInstitutions(rows);
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not load master admin data." });
    } finally {
      setLoading(false);
    }
  }

  async function toggleInstitution(institution: AdminInstitution) {
    if (user?.role !== ROLES.MASTER_ADMIN || savingId) return;
    const nextStatus = displayStatus(institution) === "closed" ? "open" : "closed";
    setSavingId(institution.id);
    try {
      const updated = await apiClient.updateAdminInstitutionStatus(institution.id, nextStatus) as AdminInstitution;
      setInstitutions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice({ tone: "success", text: `${institution.name} is now ${nextStatus === "closed" ? "closed" : "open"} for applications.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not update this institution." });
    } finally {
      setSavingId("");
    }
  }

  useEffect(() => {
    loadAdminData();
  }, [user?.id, user?.role]);

  if (user?.role !== ROLES.MASTER_ADMIN) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenScroll>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Kagie staff access</Text>
            <Text style={styles.heroText}>This Android build keeps admin routes protected. Assistant admin tools stay server-controlled and are not exposed to learner screens.</Text>
          </View>
          <Notice tone="warn" message="Only master admins can manage institutions from the Android admin panel." />
          <Button label="Sign out" onPress={logout} tone="danger" />
        </ScreenScroll>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>Kagie Admin</Text>
          <Text style={styles.topMeta}>Master admin mobile control center</Text>
        </View>
        <Button label="Sign out" onPress={logout} tone="danger" />
      </View>

      <ScreenScroll>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Master Admin</Text>
          <Text style={styles.heroText}>Manage live institution availability from Android. Learner screens only see what the backend allows.</Text>
        </View>

        {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

        <Card>
          <SectionTitle title="Protected admin panels" hint="Career Hub, Housing, Question Papers, Announcements, and payments stay backend-protected. Use the web admin for rich editing; mobile exposes fast operational controls." />
          <Text style={styles.meta}>Role: {user.role}</Text>
          <Text style={styles.meta}>Account: {user.email}</Text>
        </Card>

        <Card>
          <SectionTitle title="Institutions open / closed" hint="Closing an institution blocks users from adding it to applications through the API." />
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.sky} />
              <Text style={styles.meta}>Loading institutions...</Text>
            </View>
          ) : institutions.length ? (
            institutions.slice(0, 40).map((institution) => {
              const status = displayStatus(institution);
              return (
                <View key={institution.id} style={styles.institutionRow}>
                  <View style={styles.institutionCopy}>
                    <Text style={styles.institutionTitle}>{institution.name}</Text>
                    <Text style={styles.meta}>{institution.province} | {institution.type} | {institution.year || "Current"}</Text>
                    <Text style={[styles.status, status === "closed" && styles.statusClosed]}>Status: {status}</Text>
                  </View>
                  <Button
                    label={savingId === institution.id ? "Saving..." : status === "closed" ? "Open" : "Close"}
                    onPress={() => toggleInstitution(institution)}
                    disabled={Boolean(savingId)}
                    tone={status === "closed" ? "secondary" : "danger"}
                  />
                </View>
              );
            })
          ) : (
            <Notice tone="info" message="No institutions loaded yet." />
          )}
        </Card>
      </ScreenScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(217,227,241,0.8)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  brand: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "900"
  },
  topMeta: {
    color: colors.textMuted
  },
  hero: {
    backgroundColor: "#102a56",
    borderRadius: 28,
    padding: 22,
    gap: 8
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900"
  },
  heroText: {
    color: "rgba(255,255,255,0.88)",
    lineHeight: 20
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 19
  },
  loadingRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  institutionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10
  },
  institutionCopy: {
    gap: 3
  },
  institutionTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  status: {
    color: colors.sky,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  statusClosed: {
    color: colors.danger
  }
});
