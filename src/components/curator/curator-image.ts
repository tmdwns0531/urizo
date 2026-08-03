import {
  CURATOR_IMAGE_MAX_BYTES,
  type CuratorImageInput,
} from "../../contracts/curator";

const CLIENT_FILE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1_600;
const MAX_IMAGE_PIXELS = 40_000_000;
const ACCEPTED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface PreparedCuratorImage {
  payload: CuratorImageInput;
  previewUrl: string;
  name: string;
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("이미지를 변환하지 못했어요.")),
      "image/jpeg",
      quality,
    );
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary);
}

export async function prepareCuratorImage(
  file: File,
): Promise<PreparedCuratorImage> {
  if (!ACCEPTED_INPUT_TYPES.has(file.type)) {
    throw new Error("JPG, PNG, WebP 이미지만 첨부할 수 있어요.");
  }
  if (file.size > CLIENT_FILE_MAX_BYTES) {
    throw new Error("원본 이미지는 5MB 이하여야 해요.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("이미지를 열 수 없어요. 다른 파일을 선택해 주세요.");
  }
  try {
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width * bitmap.height > MAX_IMAGE_PIXELS
    ) {
      throw new Error("이미지 해상도가 너무 커요. 더 작은 파일을 선택해 주세요.");
    }
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 변환하지 못했어요.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    let blob = await canvasBlob(canvas, 0.84);
    if (blob.size > CURATOR_IMAGE_MAX_BYTES) {
      blob = await canvasBlob(canvas, 0.66);
    }
    if (blob.size > CURATOR_IMAGE_MAX_BYTES) {
      throw new Error("변환된 이미지가 2MB를 넘어요. 더 작은 파일을 골라 주세요.");
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      payload: {
        mediaType: "image/jpeg",
        base64: bytesToBase64(bytes),
      },
      previewUrl: URL.createObjectURL(file),
      name: file.name.trim() || "붙여넣은 이미지",
    };
  } finally {
    bitmap.close();
  }
}
