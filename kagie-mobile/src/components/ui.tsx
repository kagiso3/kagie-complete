import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
} from "react-native";
import { colors, radii, shadows } from "../theme";

export function ScreenScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

export function HeroPanel({
  eyebrow = "Kagie",
  title,
  copy,
  meta,
  tone = "brand"
}: {
  eyebrow?: string;
  title: string;
  copy: string;
  meta?: string;
  tone?: "brand" | "navy";
}) {
  const dark = tone === "navy";
  return (
    <View style={[styles.hero, dark && styles.heroNavy]}>
      <View style={styles.heroAccent} />
      <View style={styles.heroHeader}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>K</Text>
          <View style={styles.heroBadgeAccent} />
        </View>
        <Text style={[styles.heroEyebrow, dark && styles.heroEyebrowDark]}>{eyebrow}</Text>
      </View>
      <Text style={[styles.heroTitle, dark && styles.heroTitleDark]}>{title}</Text>
      <Text style={[styles.heroCopy, dark && styles.heroCopyDark]}>{copy}</Text>
      {meta ? <Text style={[styles.heroMeta, dark && styles.heroMetaDark]}>{meta}</Text> : null}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  editable = true
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline, !editable && styles.inputDisabled]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
  loading,
  loadingLabel
}: {
  label: string;
  onPress: () => void | Promise<void>;
  tone?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const actionLockedRef = React.useRef(false);
  const [localLoading, setLocalLoading] = React.useState(false);
  const isLoading = Boolean(loading || localLoading);
  const locked = Boolean(disabled || isLoading);

  const handlePress = React.useCallback(() => {
    if (locked || actionLockedRef.current) return;
    actionLockedRef.current = true;
    setLocalLoading(true);
    try {
      const result = onPress();
      if (!result || typeof result.then !== "function") {
        actionLockedRef.current = false;
        setLocalLoading(false);
        return;
      }
      setLocalLoading(true);
      void result
        .catch((error) => {
          console.warn("Kagie action failed:", error);
        })
        .finally(() => {
          actionLockedRef.current = false;
          setLocalLoading(false);
        });
    } catch (error) {
      actionLockedRef.current = false;
      setLocalLoading(false);
      console.warn("Kagie action failed:", error);
    }
  }, [locked, onPress]);

  return (
    <Pressable
      disabled={locked}
      onPress={handlePress}
      android_ripple={{ color: "rgba(15, 23, 42, 0.06)" }}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked, busy: isLoading }}
      accessibilityLabel={isLoading ? (loadingLabel || "Please wait...") : label}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && styles.buttonPrimary,
        tone === "secondary" && styles.buttonSecondary,
        tone === "ghost" && styles.buttonGhost,
        tone === "danger" && styles.buttonDanger,
        locked && styles.buttonDisabled,
        pressed && !locked && styles.buttonPressed
      ]}
    >
      <View style={styles.buttonContent}>
        {isLoading ? (
          <ActivityIndicator
            color={tone === "secondary" ? "#7d5800" : tone === "ghost" ? colors.sky : "#ffffff"}
            size="small"
          />
        ) : null}
        <Text
          style={[
            styles.buttonText,
            tone === "secondary" && styles.buttonSecondaryText,
            tone === "ghost" && styles.buttonGhostText
          ]}
        >
          {isLoading ? (loadingLabel || "Please wait...") : label}
        </Text>
      </View>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = "sky",
  disabled
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  tone?: "sky" | "gold" | "orange";
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active), disabled: Boolean(disabled) }}
      android_ripple={{ color: "rgba(15, 23, 42, 0.05)" }}
      style={[
        styles.chip,
        tone === "sky" && styles.chipSky,
        tone === "gold" && styles.chipGold,
        tone === "orange" && styles.chipOrange,
        active && styles.chipActive,
        disabled && styles.chipDisabled
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({
  tone = "info",
  message
}: {
  tone?: "info" | "success" | "warn" | "error";
  message: string;
}) {
  return (
    <View
      style={[
        styles.notice,
        tone === "info" && styles.noticeInfo,
        tone === "success" && styles.noticeSuccess,
        tone === "warn" && styles.noticeWarn,
        tone === "error" && styles.noticeError
      ]}
    >
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

export function SyncBanner({
  status,
  message,
  actionLabel,
  onAction,
  loading
}: {
  status: "online" | "offline" | "weak" | "syncing" | "restored" | "queued";
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  loading?: boolean;
}) {
  const tone = status === "offline" ? "warn" : status === "weak" ? "warn" : status === "restored" ? "success" : "info";
  return (
    <View style={styles.syncBannerWrap}>
      <Notice tone={tone} message={message} />
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          loadingLabel={actionLabel}
          onPress={onAction}
          loading={loading}
          disabled={loading}
          tone="ghost"
        />
      ) : null}
    </View>
  );
}

export function SkeletonBlock({
  height,
  width = "100%",
  radius = radii.card,
  style
}: {
  height: number;
  width?: number | `${number}%` | "100%";
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.skeleton, { height, width, borderRadius: radius }, style]} />;
}

export function SkeletonLines({
  widths = ["100%", "88%", "72%"],
  lineHeight = 12
}: {
  widths?: Array<number | `${number}%`>;
  lineHeight?: number;
}) {
  return (
    <View style={styles.skeletonLines}>
      {widths.map((width, index) => (
        <SkeletonBlock
          key={`${String(width)}-${index}`}
          height={lineHeight}
          width={width}
          radius={999}
        />
      ))}
    </View>
  );
}

export function DashboardSectionSkeleton({
  rows = 3,
  showHeader = true
}: {
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <Card>
      {showHeader ? (
        <View style={styles.skeletonSectionHead}>
          <SkeletonBlock height={15} width="36%" radius={999} />
          <SkeletonBlock height={12} width="62%" radius={999} />
        </View>
      ) : null}
      <View style={styles.skeletonSectionRows}>
        {Array.from({ length: rows }).map((_, index) => (
          <View key={index} style={styles.skeletonRowCard}>
            <SkeletonLines widths={["62%", "84%", "46%"]} />
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
    paddingBottom: 122
  },
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radii.card,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.card
  },
  hero: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radii.card,
    overflow: "hidden",
    paddingHorizontal: 21,
    paddingVertical: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.lift
  },
  heroNavy: {
    backgroundColor: colors.navy
  },
  heroAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: colors.sky
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  heroBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  heroBadgeAccent: {
    position: "absolute",
    right: -7,
    bottom: -7,
    width: 20,
    height: 20,
    borderRadius: 8,
    backgroundColor: colors.sky
  },
  heroBadgeText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700"
  },
  heroEyebrow: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  heroEyebrowDark: {
    color: colors.gold
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    maxWidth: "92%"
  },
  heroTitleDark: {
    color: "#ffffff"
  },
  heroCopy: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: "96%"
  },
  heroCopyDark: {
    color: "rgba(255,255,255,0.86)"
  },
  heroMeta: {
    alignSelf: "flex-start",
    color: "#2d9df9",
    backgroundColor: colors.skySoft,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "800"
  },
  heroMetaDark: {
    color: "#ffffff",
    backgroundColor: "rgba(45, 157, 249,0.24)"
  },
  sectionHeader: {
    gap: 4
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted
  },
  fieldWrap: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted
  },
  input: {
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    fontSize: 16,
    borderColor: colors.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: colors.text
  },
  inputDisabled: {
    opacity: 0.68
  },
  multiline: {
    minHeight: 94,
    textAlignVertical: "top"
  },
  button: {
    borderRadius: radii.control,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  buttonPrimary: {
    backgroundColor: colors.brand
  },
  buttonSecondary: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.border
  },
  buttonGhost: {
    backgroundColor: colors.skySoft
  },
  buttonDanger: {
    backgroundColor: colors.danger
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }]
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14
  },
  buttonSecondaryText: {
    color: colors.text
  },
  buttonGhostText: {
    color: colors.navy
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1
  },
  chipSky: {
    backgroundColor: "#eff8ff",
    borderColor: "#c5e4fd"
  },
  chipGold: {
    backgroundColor: colors.goldSoft,
    borderColor: "#ffb500"
  },
  chipOrange: {
    backgroundColor: colors.orangeSoft,
    borderColor: "#feafaf"
  },
  chipActive: {
    backgroundColor: colors.navy,
    borderColor: colors.navy
  },
  chipDisabled: {
    opacity: 0.55
  },
  chipText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13
  },
  chipTextActive: {
    color: "#ffffff"
  },
  notice: {
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  noticeInfo: {
    backgroundColor: "#e7f4fe"
  },
  noticeSuccess: {
    backgroundColor: colors.successSoft
  },
  noticeWarn: {
    backgroundColor: colors.goldSoft
  },
  noticeError: {
    backgroundColor: colors.dangerSoft
  },
  noticeText: {
    color: colors.text,
    lineHeight: 19
  },
  syncBannerWrap: {
    gap: 8
  },
  skeleton: {
    backgroundColor: "#e6edf6"
  },
  skeletonLines: {
    gap: 8
  },
  skeletonSectionHead: {
    gap: 10
  },
  skeletonSectionRows: {
    gap: 10
  },
  skeletonRowCard: {
    borderRadius: radii.card,
    padding: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "rgba(201, 230, 253,0.7)"
  }
});
