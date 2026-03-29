import React from "react";
import {
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
  return <ScrollView contentContainerStyle={styles.screenContent}>{children}</ScrollView>;
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
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && styles.buttonPrimary,
        tone === "secondary" && styles.buttonSecondary,
        tone === "ghost" && styles.buttonGhost,
        tone === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          tone === "secondary" && styles.buttonSecondaryText,
          tone === "ghost" && styles.buttonGhostText
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = "sky"
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  tone?: "sky" | "gold" | "orange";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        tone === "sky" && styles.chipSky,
        tone === "gold" && styles.chipGold,
        tone === "orange" && styles.chipOrange,
        active && styles.chipActive
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
  multiline: {
    minHeight: 94,
    textAlignVertical: "top"
  },
  button: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
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
    opacity: 0.55
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }]
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
  }
});
