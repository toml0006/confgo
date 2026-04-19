import { useState } from "react";
import { createConference, ApiError } from "../lib/api";
import { CloseIcon } from "./icons";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function AddConferenceModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [topics, setTopics] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await createConference({
        name,
        locationName,
        latitude: Number(latitude),
        longitude: Number(longitude),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate || startDate).toISOString(),
        topics: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        url: url.trim() || null,
      });
      onCreated();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) setErr(e.message);
      else setErr("Could not create conference.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Add a conference">
      <form className="modal glass" onSubmit={submit}>
        <header className="sheet-header">
          <h2 className="sheet-title">Add a conference</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="sheet-body">
          <div className="field">
            <label>Name</label>
            <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Location (city, state)</label>
            <input
              required
              maxLength={200}
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label>Latitude</label>
              <input
                required
                type="number"
                step="0.0001"
                min={-90}
                max={90}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Longitude</label>
              <input
                required
                type="number"
                step="0.0001"
                min={-180}
                max={180}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field">
              <label>Start date</label>
              <input
                required
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>End date</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Topics (comma-separated)</label>
            <input value={topics} onChange={(e) => setTopics(e.target.value)} />
          </div>
          <div className="field">
            <label>URL (optional)</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          {err && <p className="form-error" role="alert">{err}</p>}

          <div className="button-row">
            <button type="submit" className="soft-button primary" disabled={busy}>
              Create
            </button>
            <button type="button" className="soft-button quiet" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
