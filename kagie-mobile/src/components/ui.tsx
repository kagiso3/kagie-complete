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
import { colors, shadows } from "../theme";

export function ScreenScroll({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
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
  const [localLoading, setLocalLoading] = React.useState(false);
  const isLoading = Boolean(loading || localLoading);
  const locked = Boolean(disabled || isLoading);

  const handlePress = React.useCallback(() => {
    if (locked) return;
    const result = onPress();
    if (result && typeof result.then === "function") {
      setLocalLoading(true);
      void result.finally(() => setLocalLoading(false)).catch(() => {});
    }
  }, [locked, onPress]);

  return (
    <Pressable
      disabled={locked}
      onPress={handlePress}
      android_ripple={{ color: "rgba(15, 23, 42, 0.06)" }}
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
          {isLoading ? (loadingLabel || label) : label}
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
  radius = 18,
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
  screenContent: {
    padding: 18,
    gap: 16,
    paddingBottom: 110
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(217,227,241,0.85)",
    ...shadows.card
  },
  sectionHeader: {
    gap: 4
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
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
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textMuted
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f9fbff",
    paddingHorizontal: 14,
    paddingVertical: 13,
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
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  buttonPrimary: {
    backgroundColor: colors.sky
  },
  buttonSecondary: {
    backgroundColor: colors.goldSoft
  },
  buttonGhost: {
    backgroundColor: "#eef4ff"
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
    color: "#7d5800"
  },
  buttonGhostText: {
    color: colors.sky
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1
  },
  chipSky: {
    backgroundColor: "#f3f8ff",
    borderColor: "#c9defd"
  },
  chipGold: {
    backgroundColor: colors.goldSoft,
    borderColor: "#f6d883"
  },
  chipOrange: {
    backgroundColor: colors.orangeSoft,
    borderColor: "#ffc29c"
  },
  chipActive: {
    backgroundColor: colors.sky,
    borderColor: colors.sky
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
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  noticeInfo: {
    backgroundColor: "#e6f4ff"
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
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "rgba(217,227,241,0.7)"
  }
});
