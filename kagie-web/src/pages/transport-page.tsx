import { useDeferredValue, useEffect, useState } from "react";
import { Button, Card, EmptyState, SectionHeading, TextAreaField, TextField } from "../components/ui";
import { formatMoney } from "../lib/format";
import type { KagieUser, LegacyApi, TransportOption } from "../lib/types";

export function TransportPage({
  api,
  user
}: {
  api: LegacyApi;
  user: KagieUser;
}) {
  const [options, setOptions] = useState<TransportOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [phone, setPhone] = useState(user.phone || "");
  const [note, setNote] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const nextOptions = api.getTransportOptionsAsync
          ? await api.getTransportOptionsAsync()
          : api.getTransportOptions
            ? api.getTransportOptions()
            : [];
        if (active) setOptions(nextOptions || []);
      } catch {
        if (active) {
          setOptions(api.getTransportOptions?.() || []);
          setLoadMessage("New travel options could not load. Showing saved routes.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [api]);

  const filteredOptions = options.filter((option) => {
    const searchText = `${option.company} ${option.departureCity} ${option.destinationCity} ${option.optionName || ""}`.toLowerCase();
    return !deferredSearch.trim() || searchText.includes(deferredSearch.trim().toLowerCase());
  });
  const selectedOption = filteredOptions.find((option) => option.id === selectedId) || options.find((option) => option.id === selectedId) || null;

  async function submitRequest() {
    if (requesting) return;
    if (!selectedOption) {
      setMessage("Choose a transport option first.");
      return;
    }
    const payload = {
      optionId: selectedOption.id,
      company: selectedOption.company,
      departureCity: selectedOption.departureCity,
      destinationCity: selectedOption.destinationCity,
      optionName: selectedOption.optionName,
      supportFee: selectedOption.supportFee,
      travelDate,
      phone,
      note
    };
    setRequesting(true);
    try {
      if (api.submitTransportRequestAsync) await api.submitTransportRequestAsync(payload, user.id);
      else if (api.submitTransportRequest) api.submitTransportRequest(payload, user.id);
      setMessage("Transport request saved. Kagie will track it in your dashboard.");
      setTravelDate("");
      setNote("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kagie could not submit the transport request right now.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="kg-page-stack">
      {loadMessage ? <div className="kg-inline-message info" role="status">{loadMessage}</div> : null}
      <Card className="kg-hero-card soft">
        <SectionHeading eyebrow="Transport" title="Intercity transport support" copy="Explore travel routes and keep your transport requests together." />
      </Card>

      <div className="kg-grid two">
        <Card>
          <SectionHeading title="Browse routes" copy="Search available travel options by company, departure city, or destination." />
          <TextField label="Search" value={search} onChange={setSearch} placeholder="Search company or route" />
          {loading ? (
            <div className="kg-loading-inline">Loading transport options...</div>
          ) : filteredOptions.length ? (
            <div className="kg-list-stack">
              {filteredOptions.map((option) => (
                <button key={option.id} type="button" className={`kg-list-card selectable ${selectedId === option.id ? "selected" : ""}`} onClick={() => setSelectedId(option.id)}>
                  <div className="kg-list-title-row">
                    <strong>{option.company}</strong>
                    <span>{option.supportFee ? formatMoney(option.supportFee) : "Support included"}</span>
                  </div>
                  <p>
                    {option.departureCity} to {option.destinationCity}
                    <br />
                    {option.optionName || "Intercity booking support"}
                    {option.departureTime ? <><br />Departure: {option.departureTime}</> : null}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No transport options found" copy="Try another route search or wait for more transport companies to be added." />
          )}
        </Card>

        <Card>
          <SectionHeading title="Request ticket support" copy="Kagie can keep the route details and support request under your student profile." />
          {selectedOption ? (
            <div className="kg-list-card">
              <div className="kg-list-title-row">
                <strong>{selectedOption.company}</strong>
                <span>{selectedOption.departureCity} to {selectedOption.destinationCity}</span>
              </div>
              <p>{selectedOption.optionName || "Intercity ticket support"}</p>
            </div>
          ) : null}
          <div className="kg-form-stack">
            <TextField label="Phone" value={phone} onChange={setPhone} />
            <TextField label="Travel date" value={travelDate} onChange={setTravelDate} type="date" />
            <TextAreaField label="Notes" value={note} onChange={setNote} placeholder="Passenger count, luggage, student move-in plans, or any special notes." />
            {message ? <div className="kg-inline-message info">{message}</div> : null}
            <Button onClick={submitRequest} disabled={requesting} loading={requesting} loadingLabel="Sending request...">
              Request transport support
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
