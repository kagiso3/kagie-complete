import { useEffect, useState } from "react";
import { Button, Card, EmptyState, SectionHeading, TextAreaField, TextField } from "../components/ui";
import { formatMoney } from "../lib/format";
import type { KagieApplication, KagieCartItem, KagieSettings, KagieUser, LegacyApi } from "../lib/types";

const paymentMethods = ["EFT", "Cash Deposit", "Card Transfer", "Mobile Payment"];

export function CheckoutPage({
  api,
  user
}: {
  api: LegacyApi;
  user: KagieUser;
}) {
  const [items, setItems] = useState<KagieCartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState<KagieSettings>({});
  const [latest, setLatest] = useState<KagieApplication | null>(null);
  const [payerName, setPayerName] = useState(user.fullName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState("EFT");
  const [note, setNote] = useState("");
  const [proofName, setProofName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function hydrate() {
    setLoading(true);
    try {
      const [nextItems, nextTotal, nextSummary] = await Promise.all([
        api.getCartAsync ? api.getCartAsync(user.id) : Promise.resolve(api.getCart(user.id)),
        api.getCartTotalAsync ? api.getCartTotalAsync(user.id) : Promise.resolve(api.getCartTotal(user.id)),
        api.getDashboardSummaryAsync ? api.getDashboardSummaryAsync(user.id) : Promise.resolve(api.getDashboardSummary(user.id))
      ]);
      setItems(nextItems || []);
      setTotal(nextTotal || 0);
      setLatest(nextSummary.latestApplication || null);
      setSettings(api.getSettings ? api.getSettings() : {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    hydrate();
  }, [api, user.id]);

  useEffect(() => {
    if (!reference.trim()) {
      const prefix = String(settings.payments?.referencePrefix || settings.appName || "KAG")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .slice(0, 6);
      const seed = String(latest?.id || user.id || Date.now()).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      setReference(`${prefix || "KAG"}-${seed.slice(-6) || "000001"}`);
    }
  }, [latest?.id, reference, settings.appName, settings.payments?.referencePrefix, user.id]);

  async function handleCheckout() {
    if (!items.length || busy) return;
    if (!payerName.trim() || !phone.trim() || !reference.trim()) {
      setMessage("Enter payer name, phone number, and payment reference before confirming.");
      return;
    }
    if (!confirmChecked) {
      setMessage("Confirm that you used the correct Kagie payment reference before continuing.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const submitted = api.submitApplicationFromCartAsync
        ? await api.submitApplicationFromCartAsync({ payerName, phone, reference, method, note })
        : api.submitApplicationFromCart
          ? api.submitApplicationFromCart({ payerName, phone, reference, method, note })
          : api.submitPayment
            ? api.submitPayment({ payerName, phone, reference, method, note })
            : null;

      if (proofFile) {
        const payload = {
          file: proofFile,
          name: proofName || proofFile.name,
          type: proofFile.type,
          size: proofFile.size,
          category: "proof_of_payment",
          applicationId: submitted?.id || latest?.id || null
        };
        if (api.saveDocumentsAsync) await api.saveDocumentsAsync(payload, user.id);
        else if (api.saveDocuments) api.saveDocuments(payload, user.id);
      }

      setMessage("Payment submitted. Kagie has moved the application into verification and kept you on this page.");
      setProofFile(null);
      setProofName("");
      setConfirmChecked(false);
      await hydrate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kagie could not submit the payment right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kg-page-stack">
      <Card className="kg-hero-card soft">
        <SectionHeading eyebrow="Checkout" title="Confirm payment and proof" copy="Use the correct reference, then keep proof of payment attached to the same Kagie application." />
        <div className="kg-metric-grid">
          <div className="kg-summary-chip">{items.length} item{items.length === 1 ? "" : "s"}</div>
          <div className="kg-summary-chip">{formatMoney(total)} total</div>
          <div className="kg-summary-chip">{latest?.paymentStatus || "Awaiting payment"}</div>
        </div>
      </Card>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Order summary" copy="Your package and paid Kagie services ready for payment." />
          {loading ? (
            <div className="kg-loading-inline">Loading checkout summary...</div>
          ) : items.length ? (
            <div className="kg-list-stack">
              {items.map((item) => (
                <div className="kg-list-card" key={item.id}>
                  <div className="kg-list-title-row">
                    <strong>{item.packName || item.serviceName || item.name || "Checkout item"}</strong>
                    <span>{formatMoney(item.packPrice || item.price || 0)}</span>
                  </div>
                  <p>{item.institutionLimit ? `Institution limit: ${item.institutionLimit === "unlimited" ? "Unlimited" : item.institutionLimit}` : "Support item"}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing to pay yet" copy="Add a package or a paid support item before opening checkout." />
          )}
        </Card>

        <Card>
          <SectionHeading title="Payment details" copy="The student stays on checkout after confirming, while Kagie moves the record into verification." />
          <div className="kg-form-stack">
            <TextField label="Payer name" value={payerName} onChange={setPayerName} />
            <TextField label="Phone" value={phone} onChange={setPhone} />
            <TextField label="Payment reference" value={reference} onChange={setReference} />
            <label className="kg-field">
              <span>Method</span>
              <select className="kg-input" value={method} onChange={(event) => setMethod(event.target.value)}>
                {paymentMethods.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <TextAreaField label="Payment note" value={note} onChange={setNote} placeholder="Branch reference, deposit note, or any detail Kagie should see." />
            <TextField label="Proof label" value={proofName} onChange={setProofName} placeholder="Proof of payment" />
            <label className="kg-field">
              <span>Proof file</span>
              <input className="kg-input kg-file-input" type="file" onChange={(event) => setProofFile(event.target.files?.[0] || null)} />
            </label>
            <label className="kg-check">
              <input type="checkbox" checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)} />
              <span>I used the correct Kagie payment reference and I want verification to start.</span>
            </label>
            {settings.payments?.bankName || settings.payments?.accountNumber ? (
              <div className="kg-bank-panel">
                <strong>{settings.payments?.merchantName || settings.appName || "Kagie"}</strong>
                <p>
                  {settings.payments?.bankName || "Bank pending"}
                  <br />
                  {settings.payments?.accountNumber || "Account number pending"}
                  <br />
                  {settings.payments?.accountType || "Business Account"} | Branch {settings.payments?.branchCode || "-"}
                </p>
              </div>
            ) : null}
            {message ? <div className="kg-inline-message info">{message}</div> : null}
            <Button onClick={handleCheckout} disabled={!items.length || busy}>
              {busy ? "Submitting payment..." : "Confirm payment"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
