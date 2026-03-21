import { IMAGE_MAX_SIZE } from "../constants/config";

export interface CompressedImage {
  uri: string;
  base64: string;
}

export function compressImage(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(IMAGE_MAX_SIZE / img.width, IMAGE_MAX_SIZE / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const base64 = dataUrl.split(",")[1];

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Blob creation failed"));
          resolve({ uri: URL.createObjectURL(blob), base64 });
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
