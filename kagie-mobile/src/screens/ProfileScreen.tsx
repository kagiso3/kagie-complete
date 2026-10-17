import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, HeroPanel, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { useSession } from "../session/SessionProvider";
import { colors } from "../theme";

export function ProfileScreen() {
  const { user, logout, refreshProfile } = useSession();
  const { profile, syncing } = useKagieData();

  return (
    <ScreenScroll>
      <HeroPanel
        eyebrow="Profile"
        title="Your learner record"
        copy="Review the account, school, guardian, and application information Kagie currently has on file."
        tone="navy"
      />

      <Card>
        <SectionTitle title="Account" hint="This comes from your secure Kagie session." />
        <Text style={styles.value}>{user?.fullName || "Student"}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>{user?.phone}</Text>
        <Text style={styles.meta}>Role: {user?.role}</Text>
      </Card>

      <Card>
        <SectionTitle title="Learner summary" hint="Your mobile app reads this from the latest Kagie draft or application." />
        <Text style={styles.value}>{profile?.learner.fullNames || "No learner details saved yet"}</Text>
        <Text style={styles.meta}>ID number: {profile?.learner.idNumber || "-"}</Text>
        <Text style={styles.meta}>Province: {profile?.learner.province || "-"}</Text>
        <Text style={styles.meta}>Language: {profile?.learner.homeLanguage || "-"}</Text>
        <Text style={styles.meta}>Address: {profile?.learner.address || "-"}</Text>
      </Card>

      <Card>
        <SectionTitle title="School and guardian" hint="These details travel with your application draft and support flow." />
        <Text style={styles.value}>{profile?.school.schoolName || "No school saved yet"}</Text>
        <Text style={styles.meta}>School province: {profile?.school.schoolProvince || "-"}</Text>
        <Text style={styles.meta}>Completion year: {profile?.school.completionYear || "-"}</Text>
        <Text style={styles.meta}>Guardian: {profile?.parent.fullNames || "-"}</Text>
        <Text style={styles.meta}>Guardian phone: {profile?.parent.phone1 || "-"}</Text>
      </Card>

      <Card>
        <SectionTitle title="Application summary" hint="A quick view of your most recent application state." />
        <Text style={styles.value}>{profile?.latestApplication.status || "Draft"}</Text>
        <Text style={styles.meta}>Payment: {profile?.latestApplication.paymentStatus || "Payment Pending"}</Text>
        <Text style={styles.meta}>Institutions: {profile?.latestApplication.institutions.length || 0}</Text>
        <Text style={styles.meta}>Subjects: {profile?.marks.length || 0}</Text>
        {!profile?.marks.length ? (
          <Notice tone="warn" message="Your marks are still empty. Add them on the Apply tab so Kagie can guide your shortlist better." />
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Privacy" hint="Kagie collects student profile, institution, payment, and support information so it can assist with tertiary applications." />
        <Text style={styles.meta}>Privacy policy URL: https://kagie.app/privacy.html</Text>
        <Text style={styles.meta}>Support email: kagisowitness79@gmail.com</Text>
        <Pressable onPress={() => Linking.openURL("https://kagie.app/privacy.html").catch(() => null)}>
          <Text style={styles.link}>Open privacy policy</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL("https://kagie.app/account-deletion.html").catch(() => null)}>
          <Text style={styles.link}>Request account or data deletion</Text>
        </Pressable>
      </Card>

      <View style={styles.actions}>
        <Button label="Refresh profile" loadingLabel="Refreshing..." onPress={refreshProfile} loading={syncing} disabled={syncing} tone="ghost" />
        <Button label="Logout" loadingLabel="Signing out..." onPress={logout} tone="danger" />
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  value: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 20
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 20
  },
  actions: {
    gap: 10
  },
  link: {
    color: colors.sky,
    fontWeight: "800"
  }
});
