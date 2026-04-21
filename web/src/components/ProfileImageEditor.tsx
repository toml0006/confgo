import { useMemo, useRef, useState } from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { avatarPresentation } from "@shared/domain";

import { storage } from "../lib/firebase";
import { avatarStyle } from "../lib/avatar";

type Props = {
  userId: string;
  avatarId: number;
  existingPhotoURL: string | null;
  onClose: () => void;
  onSave: (value: { avatarId?: number; photoURL?: string | null }) => Promise<void>;
};

export function ProfileImageEditor({ userId, avatarId, existingPhotoURL, onClose, onSave }: Props) {
  const [mode, setMode] = useState<"choose" | "crop" | "avatar">("choose");
  const [source, setSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedAvatar, setSelectedAvatar] = useState(avatarId);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const avatars = useMemo(
    () => Array.from({ length: 48 }, (_, index) => ({
      id: index,
      glyph: avatarPresentation(index).glyph
    })),
    []
  );

  async function saveCanvas() {
    if (!source) {
      return;
    }
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.beginPath();
    context.arc(100, 100, 100, 0, Math.PI * 2);
    context.closePath();
    context.clip();

    const width = image.width * zoom;
    const height = image.height * zoom;
    const x = 100 - width / 2 + offset.x;
    const y = 100 - height / 2 + offset.y;
    context.drawImage(image, x, y, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) {
      return;
    }
    const fileRef = ref(storage, `profile-images/${userId}/photo.jpg`);
    await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
    const photoURL = await getDownloadURL(fileRef);
    await onSave({ photoURL });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide">
        <div className="sheet-header">
          <div className="sheet-kicker">Profile Image</div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        {mode === "choose" ? (
          <div className="profile-editor-grid">
            <button className="soft-button primary" onClick={() => document.getElementById("profile-upload-input")?.click()}>Upload a photo</button>
            <button className="soft-button quiet" onClick={() => setMode("avatar")}>Choose an avatar</button>
            {existingPhotoURL ? <button className="soft-button danger" onClick={() => onSave({ photoURL: null })}>Remove photo</button> : null}
            <input
              id="profile-upload-input"
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setSource(URL.createObjectURL(file));
                setMode("crop");
              }}
            />
          </div>
        ) : null}

        {mode === "crop" && source ? (
          <div className="crop-layout">
            <div
              className="crop-preview"
              onPointerDown={(event) => {
                dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!dragRef.current) {
                  return;
                }
                setOffset({
                  x: event.clientX - dragRef.current.x,
                  y: event.clientY - dragRef.current.y
                });
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
            >
              <img
                src={source}
                alt="Crop preview"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
                }}
              />
            </div>
            <label className="slider-label">
              <span>Zoom</span>
              <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </label>
            <div className="inline-actions">
              <button className="soft-button quiet" onClick={() => setMode("choose")}>Back</button>
              <button
                className="soft-button primary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  await saveCanvas();
                  setSaving(false);
                  onClose();
                }}
              >
                {saving ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "avatar" ? (
          <div className="avatar-grid">
            {avatars.map((avatar) => (
              <button
                key={avatar.id}
                className={`avatar-choice ${selectedAvatar === avatar.id ? "selected" : ""}`}
                onClick={() => setSelectedAvatar(avatar.id)}
              >
                <span style={avatarStyle(avatar.id)}>{avatar.glyph}</span>
              </button>
            ))}
            <div className="inline-actions">
              <button className="soft-button quiet" onClick={() => setMode("choose")}>Back</button>
              <button
                className="soft-button primary"
                onClick={async () => {
                  await onSave({ avatarId: selectedAvatar, photoURL: null });
                  onClose();
                }}
              >
                Save avatar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}
