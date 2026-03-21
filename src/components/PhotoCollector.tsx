import { useRef } from "react";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

interface Props {
  photos: string[];
  onAddPhoto: (base64: string) => void;
  onRemovePhoto: (index: number) => void;
  maxPhotos: number;
}

const SLOT_LABELS = ["Front", "Side angle", "Other angle (optional)"];

export default function PhotoCollector({ photos, onAddPhoto, onRemovePhoto, maxPhotos }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > MAX_IMAGE_SIZE || h > MAX_IMAGE_SIZE) {
        const ratio = Math.min(MAX_IMAGE_SIZE / w, MAX_IMAGE_SIZE / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      onAddPhoto(dataUrl.split(",")[1]);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  return (
    <div className="photo-collector">
      <div className="photo-grid">
        {Array.from({ length: maxPhotos }).map((_, i) => (
          <div key={i} className="photo-slot">
            {photos[i] ? (
              <>
                <img src={`data:image/jpeg;base64,${photos[i]}`} alt={SLOT_LABELS[i]} />
                <button className="photo-remove" onClick={() => onRemovePhoto(i)}>×</button>
                <span className="photo-label">{SLOT_LABELS[i]}</span>
              </>
            ) : (
              <button
                className="photo-add"
                onClick={() => inputRef.current?.click()}
                disabled={i > photos.length}
              >
                + {SLOT_LABELS[i]}
              </button>
            )}
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
    </div>
  );
}
