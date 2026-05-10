import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Chip, Field, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";
import type { CheckoutInput } from "../types/mobile";

export function CartScreen() {
  const { cart, catalog, syncing, clearCart, checkout } = useKagieData();
  const [payment, setPayment] = useState<CheckoutInput>({
    payerName: "",
    phone: "",
    reference: "",
    method: "EFT",
    note: ""
  });
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn" | "info"; text: string } | null>(null);

  const packageLabel = useMemo(() => {
    if (!cart?.pack) return "No package selected";
    return `${cart.pack.name} · R${cart.pack.price}`;
  }, [cart?.pack]);

  async function handleCheckout() {
    try {
      await checkout(payment);
      setNotice({ tone: "success", text: "Payment submitted. Kagie marked the application as being processed." });
      setPayment({
        payerName: "",
        phone: "",
        reference: "",
        method: "EFT",
        note: ""
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Checkout failed." });
    }
  }

  async function handleClearCart() {
    try {
      await clearCart();
      setNotice({ tone: "warn", text: "Your current package and shortlist were cleared from the draft." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not clear the cart." });
    }
  }

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Cart and checkout</Text>
        <Text style={styles.heroText}>Review the Kagie package, institutions, and payment details before submission.</Text>
      </View>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

      <Card>
        <SectionTitle title="Order summary" hint="This section reflects the active Kagie draft ready for checkout." />
        <Text style={styles.packageLabel}>{packageLabel}</Text>
        <Text style={styles.meta}>Institutions: {cart?.institutions.length || 0}</Text>
        <Text style={styles.total}>Total: R{cart?.total || 0}</Text>
        <Text style={styles.meta}>Status: {cart?.status || "Draft"}</Text>
        <Text style={styles.meta}>Payment status: {cart?.paymentStatus || "Payment Pending"}</Text>
      </Card>

      <Card>
        <SectionTitle title="Shortlist inside this package" hint="Kagie will process these institution choices after payment review." />
        {(cart?.institutions || []).length ? (
          cart?.institutions.map((item) => (
            <View key={item.id} style={styles.instRow}>
              <Text style={styles.instTitle}>{item.institutionName}</Text>
              <Text style={styles.instMeta}>{item.faculty}</Text>
              <Text style={styles.instMeta}>{item.choice1} | {item.choice2} | {item.choice3}</Text>
            </View>
          ))
        ) : (
          <Notice tone="info" message="No institutions are attached yet. Go to the Apply tab to build your shortlist first." />
        )}
      </Card>

      <Card>
        <SectionTitle title="Payment details" hint="Use the same payer details you want Kagie to verify against your proof of payment." />
        <Field label="Payer full name" value={payment.payerName} onChangeText={(value) => setPayment((current) => ({ ...current, payerName: value }))} />
        <Field label="Payer phone" value={payment.phone} onChangeText={(value) => setPayment((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
        <Field label="Payment reference" value={payment.reference} onChangeText={(value) => setPayment((current) => ({ ...current, reference: value }))} placeholder="KAG-2026-001" />
        <Field label="Payment note" value={payment.note || ""} onChangeText={(value) => setPayment((current) => ({ ...current, note: value }))} multiline />
        <Text style={styles.smallLabel}>Payment method</Text>
        <View style={styles.methodRow}>
          {(catalog?.paymentMethods || []).map((item) => (
            <Chip key={item} label={item} active={payment.method === item} onPress={() => setPayment((current) => ({ ...current, method: item }))} tone="gold" />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Kagie bank details" hint="These details mirror the business values currently configured in the Kagie web app." />
        <Text style={styles.bankLine}>Bank: Capitec</Text>
        <Text style={styles.bankLine}>Account number: 1863038521</Text>
        <Text style={styles.bankLine}>Account type: Savings</Text>
        <Text style={styles.bankLine}>Branch code: 470010</Text>
      </Card>

      <View style={styles.actions}>
        <Button label={syncing ? "Submitting..." : "Confirm payment"} onPress={handleCheckout} disabled={!cart?.canCheckout || syncing} />
        <Button label="Clear cart" onPress={handleClearCart} tone="danger" disabled={!cart?.applicationId || syncing} />
      </View>
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
  packageLabel: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 22
  },
  total: {
    color: colors.brand,
    fontWeight: "900",
    fontSize: 20
  },
  meta: {
    color: colors.textMuted
  },
  instRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 4
  },
  instTitle: {
    fontWeight: "900",
    color: colors.text
  },
  instMeta: {
    color: colors.textMuted,
    lineHeight: 18
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textMuted
  },
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  bankLine: {
    color: colors.text,
    lineHeight: 21
  },
  actions: {
    gap: 10
  }
});
