import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";

export function ExploreScreen() {
  const { catalog, syncing, requestService } = useKagieData();
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn" | "info"; text: string } | null>(null);

  async function handleService(serviceId: string, serviceName: string) {
    try {
      await requestService(serviceId);
      setNotice({ tone: "success", text: `${serviceName} was sent to Kagie support.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not request the service." });
    }
  }

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Explore Kagie</Text>
        <Text style={styles.heroText}>Stay on top of deadlines, prospectus guidance, and extra paid services from the Android app.</Text>
      </View>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

      <Card>
        <SectionTitle title="Latest updates" hint="These updates reflect the core guidance already present in Kagie web." />
        {(catalog?.updates || []).map((item) => (
          <View key={item.id} style={styles.updateItem}>
            <Text style={styles.updateCategory}>{item.category}</Text>
            <Text style={styles.updateTitle}>{item.title}</Text>
            <Text style={styles.updateBody}>{item.body}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title="Prospectus highlights" hint="Use this to spot institutions, deadlines, and study areas worth prioritising." />
        {(catalog?.prospectus || []).slice(0, 10).map((item) => (
          <View key={item.id} style={styles.prospectusItem}>
            <Text style={styles.prospectusTitle}>{item.institution}</Text>
            <Text style={styles.prospectusMeta}>{item.province} · {item.type}</Text>
            <Text style={styles.prospectusMeta}>Deadline: {item.applicationDeadline}</Text>
            <Text style={styles.prospectusSummary}>{item.summary}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title="More Services" hint="Request premium assistance directly from mobile and let Kagie support take it from there." />
        {(catalog?.services || []).map((item) => (
          <View key={item.id} style={styles.serviceItem}>
            <View style={styles.serviceCopy}>
              <Text style={styles.serviceTitle}>{item.name}</Text>
              <Text style={styles.servicePrice}>R{item.price}</Text>
              <Text style={styles.serviceBody}>{item.description}</Text>
            </View>
            <Button label={syncing ? "Sending..." : "Request"} onPress={() => handleService(item.id, item.name)} tone="secondary" disabled={syncing} />
          </View>
        ))}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#102a56",
    borderRadius: 28,
    padding: 22,
    gap: 8
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900"
  },
  heroText: {
    color: "rgba(255,255,255,0.88)",
    lineHeight: 20
  },
  updateItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  updateCategory: {
    color: colors.sky,
    textTransform: "uppercase",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.8
  },
  updateTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  updateBody: {
    color: colors.textMuted,
    lineHeight: 19
  },
  prospectusItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 3
  },
  prospectusTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  prospectusMeta: {
    color: colors.textMuted
  },
  prospectusSummary: {
    color: colors.text,
    lineHeight: 19,
    marginTop: 2
  },
  serviceItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10
  },
  serviceCopy: {
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
  serviceBody: {
    color: colors.textMuted,
    lineHeight: 19
  }
});
