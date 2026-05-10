import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";

export function InboxScreen() {
  const { notifications, support, syncing, markNotificationRead, sendSupportMessage, requestCallback } = useKagieData();
  const [message, setMessage] = useState("");
  const [callback, setCallback] = useState({ phone: "", preferredTime: "", note: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn" | "info"; text: string } | null>(null);

  async function handleSend() {
    if (!message.trim()) {
      setNotice({ tone: "warn", text: "Type your support message first." });
      return;
    }

    try {
      await sendSupportMessage(message.trim());
      setMessage("");
      setNotice({ tone: "success", text: "Your support message was sent to Kagie." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not send the message." });
    }
  }

  async function handleCallback() {
    if (!callback.phone.trim()) {
      setNotice({ tone: "warn", text: "Enter the phone number Kagie should use for the callback." });
      return;
    }

    try {
      await requestCallback(callback);
      setCallback({ phone: "", preferredTime: "", note: "" });
      setNotice({ tone: "success", text: "Callback request sent to Kagie support." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not request the callback." });
    }
  }

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Inbox and assistance</Text>
        <Text style={styles.heroText}>Read Kagie alerts, message the support team, and request a callback from one place.</Text>
      </View>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

      <Card>
        <SectionTitle title="Notifications" hint="These are the latest Kagie updates tied to your account." />
        {notifications.length ? (
          notifications.map((item) => (
            <View key={item.id} style={[styles.notificationRow, item.read && styles.notificationRead]}>
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                <Text style={styles.notificationText}>{item.message}</Text>
              </View>
              {!item.read ? (
                <Button label={syncing ? "Saving..." : "Mark read"} disabled={syncing} onPress={() => {
                  markNotificationRead(item.id).catch((error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not mark this notification as read." }));
                }} tone="ghost" />
              ) : null}
            </View>
          ))
        ) : (
          <Notice tone="info" message="No notifications yet. Kagie alerts will appear here." />
        )}
      </Card>

      <Card>
        <SectionTitle title="Support chat" hint="Send a message when you need help with documents, payments, institutions, or application questions." />
        {(support?.messages || []).map((item) => (
          <View key={item.id} style={[styles.messageBubble, item.senderRole === "user" ? styles.messageUser : styles.messageAssistant]}>
            <Text style={styles.messageRole}>{item.senderRole === "user" ? "You" : "Kagie support"}</Text>
            <Text style={styles.messageText}>{item.message}</Text>
          </View>
        ))}
        <Field label="Message" value={message} onChangeText={setMessage} multiline />
        <Button label={syncing ? "Sending..." : "Send support message"} onPress={handleSend} disabled={syncing} />
      </Card>

      <Card>
        <SectionTitle title="Request a callback" hint="Kagie can call you back to guide you through your next step." />
        <Field label="Phone number" value={callback.phone} onChangeText={(value) => setCallback((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
        <Field label="Preferred time" value={callback.preferredTime} onChangeText={(value) => setCallback((current) => ({ ...current, preferredTime: value }))} placeholder="After 3pm or Weekend morning" />
        <Field label="What should Kagie prepare?" value={callback.note} onChangeText={(value) => setCallback((current) => ({ ...current, note: value }))} multiline />
        <Button label={syncing ? "Sending..." : "Request callback"} onPress={handleCallback} tone="secondary" disabled={syncing} />
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
  notificationRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10
  },
  notificationRead: {
    opacity: 0.75
  },
  notificationCopy: {
    gap: 4
  },
  notificationTitle: {
    fontWeight: "900",
    color: colors.text
  },
  notificationText: {
    color: colors.textMuted,
    lineHeight: 19
  },
  messageBubble: {
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  messageUser: {
    backgroundColor: "#e7f3ff"
  },
  messageAssistant: {
    backgroundColor: "#fff3dc"
  },
  messageRole: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textMuted
  },
  messageText: {
    color: colors.text,
    lineHeight: 19
  }
});
