import { useDeferredValue, useEffect, useState } from "react";
import { Button, Card, EmptyState, SectionHeading, TextAreaField, TextField } from "../components/ui";
import { formatMoney } from "../lib/format";
import type { AccommodationListing, KagieUser, LegacyApi } from "../lib/types";

export function AccommodationPage({
  api,
  user
}: {
  api: LegacyApi;
  user: KagieUser;
}) {
  const [listings, setListings] = useState<AccommodationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [phone, setPhone] = useState(user.phone || "");
  const [moveInDate, setMoveInDate] = useState("");
  const [note, setNote] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const nextListings = api.getAccommodationListingsAsync
          ? await api.getAccommodationListingsAsync()
          : api.getAccommodationListings
            ? api.getAccommodationListings()
            : [];
        if (active) setListings(nextListings || []);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [api]);

  const filteredListings = listings.filter((listing) => {
    const searchText = `${listing.propertyName} ${listing.location} ${listing.institutionName || ""}`.toLowerCase();
    return !deferredSearch.trim() || searchText.includes(deferredSearch.trim().toLowerCase());
  });
  const selectedListing = filteredListings.find((listing) => listing.id === selectedId) || listings.find((listing) => listing.id === selectedId) || null;

  async function submitRequest() {
    if (!selectedListing) {
      setMessage("Choose an accommodation listing first.");
      return;
    }
    const payload = {
      listingId: selectedListing.id,
      propertyName: selectedListing.propertyName,
      location: selectedListing.location,
      roomType: selectedListing.roomType,
      price: selectedListing.price,
      distanceFromCampus: selectedListing.distanceFromCampus,
      phone,
      preferredMoveInDate: moveInDate,
      note
    };
    if (api.submitAccommodationRequestAsync) await api.submitAccommodationRequestAsync(payload, user.id);
    else if (api.submitAccommodationRequest) api.submitAccommodationRequest(payload, user.id);
    setMessage("Accommodation request saved. Kagie will show it in your dashboard tracking.");
    setNote("");
    setMoveInDate("");
  }

  return (
    <div className="kg-page-stack">
      <Card className="kg-hero-card soft">
        <SectionHeading eyebrow="Accommodation" title="Student housing marketplace" copy="Master Admin listings are now available in the React app as a housing discovery and booking-support flow." />
      </Card>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Browse listings" copy="Search by property name, location, or linked institution." />
          <TextField label="Search" value={search} onChange={setSearch} placeholder="Search housing listings" />
          {loading ? (
            <div className="kg-loading-inline">Loading accommodation listings...</div>
          ) : filteredListings.length ? (
            <div className="kg-list-stack">
              {filteredListings.map((listing) => (
                <button key={listing.id} type="button" className={`kg-list-card selectable ${selectedId === listing.id ? "selected" : ""}`} onClick={() => setSelectedId(listing.id)}>
                  <div className="kg-list-title-row">
                    <strong>{listing.propertyName}</strong>
                    <span>{formatMoney(listing.price)}</span>
                  </div>
                  <p>
                    {listing.location}
                    <br />
                    {listing.roomType} | {listing.distanceFromCampus}
                    <br />
                    {listing.availabilityStatus}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No listings found" copy="Try another search or wait for more accommodation stock to be added." />
          )}
        </Card>

        <Card>
          <SectionHeading title="Request booking help" copy="Select a listing, then send Kagie the details you want tracked." />
          {selectedListing ? (
            <div className="kg-list-card">
              <div className="kg-list-title-row">
                <strong>{selectedListing.propertyName}</strong>
                <span>{formatMoney(selectedListing.price)}</span>
              </div>
              <p>
                {selectedListing.location}
                <br />
                {selectedListing.roomType} | {selectedListing.distanceFromCampus}
              </p>
            </div>
          ) : null}
          <div className="kg-form-stack">
            <TextField label="Phone" value={phone} onChange={setPhone} />
            <TextField label="Preferred move-in date" value={moveInDate} onChange={setMoveInDate} type="date" />
            <TextAreaField label="Notes" value={note} onChange={setNote} placeholder="Budget, room-sharing, campus preference, or anything Kagie should know." />
            {message ? <div className="kg-inline-message info">{message}</div> : null}
            <Button onClick={() => void submitRequest()}>Request booking support</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
