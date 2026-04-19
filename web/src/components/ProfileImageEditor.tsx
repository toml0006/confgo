import { useCallback, useEffect, useRef, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../config/firebase";
import { patchMe } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AVATAR_GLYPHS, avatarGradient, glyphForAvatarId } from "../lib/avatars";
import { CloseIcon } from "./icons";

type View = "choose" | "crop" | "avatar";

interface Props {
  onClose: () => void;
}

export function ProfileImageEditor({ onClose }: Props) {
  const { user, refresh } = useAuth();
  const [view, setView] = useState<View>("choose");
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const ratio = imageBitmap.width / imageBitmap.height;
    let dw = w * zoom;
    let dh = (w * zoom) / ratio;
    if (dh < h * zoom) {
      dh = h * zoom;
      dw = h * zoom * ratio;
    }
    ctx.drawImage(
      imageBitmap,
      (w - dw) / 2 + offset.x,
      (h - dh) / 2 + offset.y,
      dw,
      dh
    );
  }, [imageBitmap, zoom, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  async function handleFile(file: File) {
    setErr(null);
    try {
      const bmp = await createImageBitmap(file);
      setImageBitmap(bmp);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setView("crop");
    } catch {
      setErr("Could not read image.");
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  async function savePhoto() {
    if (!imageBitmap || !user) return;
    setSaving(true);
    setErr(null);
    try {
      const out = document.createElement("canvas");
      out.width = 200;
      out.height = 200;
      const ctx = out.getContext("2d")!;
      const ratio = imageBitmap.width / imageBitmap.height;
      let dw = 200 * zoom;
      let dh = (200 * zoom) / ratio;
      if (dh < 200 * zoom) {
        dh = 200 * zoom;
        dw = 200 * zoom * ratio;
      }
      const scale = 200 / 180;
      ctx.drawImage(
        imageBitmap,
        (200 - dw) / 2 + offset.x * scale,
        (200 - dh) / 2 + offset.y * scale,
        dw,
        dh
      );
      const blob: Blob = await new Promise((resolve) =>
        out.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
      );
      const path = `profile-images/${user.id}/photo.jpg`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
      const downloadURL = await getDownloadURL(storageRef);
      await patchMe({ photoURL: downloadURL });
      await refresh();
      onClose();
    } catch (e) {
      setErr("Could not save photo.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseAvatar(id: number) {
    if (!user) return;
    setSaving(true);
    try {
      if (user.photoURL) {
        try {
          const storageRef = ref(storage, `profile-images/${user.id}/photo.jpg`);
          await deleteObject(storageRef);
        } catch {
          /* ignore */
        }
      }
      await patchMe({ avatarId: id, photoURL: null });
      await refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto() {
    if (!user) return;
    setSaving(true);
    try {
      try {
        await deleteObject(ref(storage, `profile-images/${user.id}/photo.jpg`));
      } catch {
        /* ignore */
      }
      await patchMe({ photoURL: null });
      await refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Edit profile image">
      <div className="modal glass">
        <header className="sheet-header">
          <h2 className="sheet-title">
            {view === "choose" && "Profile image"}
            {view === "crop" && "Position your photo"}
            {view === "avatar" && "Choose an avatar"}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        <div className="sheet-body">
          {view === "choose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="soft-button primary" style={{ cursor: "pointer" }}>
                Upload a photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  style={{ display: "none" }}
                />
              </label>
              <button className="soft-button" onClick={() => setView("avatar")}>
                Choose an avatar
              </button>
              {user?.photoURL && (
                <button className="soft-button danger" onClick={removePhoto} disabled={saving}>
                  Remove photo
                </button>
              )}
            </div>
          )}

          {view === "crop" && (
            <div>
              <div
                className="crop-stage"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <canvas ref={canvasRef} width={180} height={180} />
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="zoom-slider"
                aria-label="Zoom"
              />
              {err && <p className="form-error">{err}</p>}
              <div className="button-row" style={{ marginTop: 14 }}>
                <button className="soft-button primary" onClick={savePhoto} disabled={saving}>
                  Save
                </button>
                <button className="soft-button quiet" onClick={() => setView("choose")}>
                  Back
                </button>
              </div>
            </div>
          )}

          {view === "avatar" && (
            <div>
              <div className="avatar-grid">
                {AVATAR_GLYPHS.map((g, i) => (
                  <button
                    key={i}
                    aria-label={`Avatar ${i + 1}`}
                    aria-pressed={user?.avatarId === i && !user?.photoURL}
                    onClick={() => chooseAvatar(i)}
                    disabled={saving}
                    style={{
                      background: avatarGradient(i),
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "1.4rem",
                      fontFamily: "serif",
                      border:
                        user?.avatarId === i && !user?.photoURL
                          ? "2px solid var(--signal)"
                          : "2px solid transparent",
                    }}
                  >
                    <span aria-hidden>{glyphForAvatarId(i)}</span>
                  </button>
                ))}
              </div>
              <div className="button-row" style={{ marginTop: 14 }}>
                <button className="soft-button quiet" onClick={() => setView("choose")}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
