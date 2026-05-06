import { useEffect, useState } from "react";
import { Button, Card, EmptyState, SectionHeading, StatusPill } from "../components/ui";
import { formatMoney } from "../lib/format";
import type { KagieCartItem, KagieUser, LegacyApi, ProtectedRouteKey } from "../lib/types";

export function CartPage({
  api,
  user,
  onNavigate
}: {
  api: LegacyApi;
  user: KagieUser;
  onNavigate: (route: ProtectedRouteKey) => void;
}) {
  const [items, setItems] = useState<KagieCartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function hydrate() {
    setLoading(true);
    try {
      const [nextItems, nextTotal] = await Promise.all([
        api.getCartAsync ? api.getCartAsync(user.id) : Promise.resolve(api.getCart(user.id)),
        api.getCartTotalAsync ? api.getCartTotalAsync(user.id) : Promise.resolve(api.getCartTotal(user.id))
      ]);
      setItems(nextItems || []);
      setTotal(nextTotal || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    hydrate();
  }, [api, user.id]);

  async function removeItem(itemId: string) {
    if (api.removeCartItemAsync) await api.removeCartItemAsync(itemId, user.id);
    else api.removeCartItem(itemId, user.id);
    await hydrate();
  }

  async function clearCart() {
    if (api.clearCartAsync) await api.clearCartAsync(user.id);
    else api.clearCart(user.id);
    await hydrate();
  }

  return (
    <div className="kg-page-stack">
      <Card className="kg-hero-card soft">
        <SectionHeading
          eyebrow="Cart"
          title="Your Kagie checkout basket"
          copy="Packages and extra Kagie support items stay together here before payment."
          actions={
            <div className="kg-action-row">
              <Button tone="ghost" onClick={() => onNavigate("apply")}>
                Back to apply
              </Button>
              <Button tone="secondary" onClick={() => onNavigate("checkout")} disabled={!items.length}>
                Continue to checkout
              </Button>
            </div>
          }
        />
        <div className="kg-metric-grid">
          <div className="kg-summary-chip">{items.length} item{items.length === 1 ? "" : "s"}</div>
          <div className="kg-summary-chip">{formatMoney(total)} total</div>
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Cart items"
          copy="The application pack controls institution limits, while support services stay as separate paid items."
          actions={
            <Button tone="danger" onClick={clearCart} disabled={!items.length}>
              Clear cart
            </Button>
          }
        />
        {loading ? (
          <div className="kg-loading-inline">Loading your cart...</div>
        ) : items.length ? (
          <div className="kg-list-stack">
            {items.map((item) => (
              <div className="kg-list-card" key={item.id}>
                <div className="kg-list-title-row">
                  <strong>{item.packName || item.serviceName || item.name || "Cart item"}</strong>
                  <StatusPill label={item.type === "application_pack" ? "Package" : item.type === "service" ? "Service" : item.type} />
                </div>
                <p>
                  {formatMoney(item.packPrice || item.price || 0)}
                  {item.institutionLimit ? (
                    <>
                      <br />
                      Institution limit: {item.institutionLimit === "unlimited" ? "Unlimited" : item.institutionLimit}
                    </>
                  ) : null}
                  {item.institutions?.length ? (
                    <>
                      <br />
                      Institutions: {item.institutions.length}
                    </>
                  ) : null}
                </p>
                <div className="kg-action-row">
                  <Button tone="ghost" onClick={() => removeItem(item.id)}>
                    Remove
                  </Button>
                </div>
                {item.institutions?.length ? (
                  <div className="kg-sublist">
                    {item.institutions.map((institution) => (
                      <div className="kg-sublist-item" key={institution.id}>
                        <strong>{institution.institutionName}</strong>
                        <span>{institution.faculty || "Faculty pending"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Your cart is empty" copy="Go to the application workspace and add a package or Kagie support item first." />
        )}
      </Card>
    </div>
  );
}
