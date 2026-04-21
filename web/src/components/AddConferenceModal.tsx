import { useState } from "react";

type Props = {
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    locationName: string;
    latitude: number;
    longitude: number;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
};

export function AddConferenceModal({ onClose, onSubmit }: Props) {
  const [form, setForm] = useState({
    name: "",
    locationName: "",
    latitude: "44.9778",
    longitude: "-93.2650",
    startDate: "",
    endDate: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="sheet-header">
          <div className="sheet-kicker">Add Conference</div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError(null);
            try {
              await onSubmit({
                name: form.name,
                locationName: form.locationName,
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
                startDate: new Date(form.startDate).toISOString(),
                endDate: new Date(form.endDate).toISOString()
              });
            } catch (submissionError) {
              setError(submissionError instanceof Error ? submissionError.message : "Unable to create conference");
            } finally {
              setSaving(false);
            }
          }}
        >
          <label><span>Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label>
          <label><span>Location</span><input value={form.locationName} onChange={(event) => setForm((current) => ({ ...current, locationName: event.target.value }))} required /></label>
          <label><span>Latitude</span><input value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} required /></label>
          <label><span>Longitude</span><input value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} required /></label>
          <label><span>Start</span><input type="datetime-local" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required /></label>
          <label><span>End</span><input type="datetime-local" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required /></label>
          {error ? <p className="error-copy">{error}</p> : null}
          <button className="soft-button primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Create conference"}</button>
        </form>
      </div>
    </div>
  );
}

