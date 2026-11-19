export const MAX_IMAGE_BYTES = 1048576; // 1 MB strict per-image ceiling
export const DEFAULT_TARGET_BYTES = 280 * 1024; // ~280 KB modern web delivery target
export const DEFAULT_MAX_DIMENSION = 1600;

const VECTOR_OR_ICON_MIME_TYPES = new Set([
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const PASSTHROUGH_MODERN_MIME_TYPES = new Set([
  'image/webp',
  'image/avif',
]);

/**
 * Computes aspect-ratio-preserving dimensions bounded by maxDimension.
 */
export function computeScaledDimensions(width, height, maxDimension = DEFAULT_MAX_DIMENSION) {
  const safeW = Number(width);
  const safeH = Number(height);
  const limit = Math.max(1, Math.round(Number(maxDimension) || DEFAULT_MAX_DIMENSION));

  if (!Number.isFinite(safeW) || !Number.isFinite(safeH) || safeW <= 0 || safeH <= 0) {
    return { width: limit, height: limit };
  }

  if (safeW <= limit && safeH <= limit) {
    return { width: Math.round(safeW), height: Math.round(safeH) };
  }

  const ratio = Math.min(limit / safeW, limit / safeH);
  return {
    width: Math.max(1, Math.round(safeW * ratio)),
    height: Math.max(1, Math.round(safeH * ratio)),
  };
}

/**
 * Selects the best compressed candidate under maxBytes.
 * Prefers the highest-resolution / highest-quality candidate within targetBytes;
 * otherwise picks the smallest candidate that still respects maxBytes.
 */
export function chooseBestCompressedCandidate(
  candidates,
  { maxBytes = MAX_IMAGE_BYTES, targetBytes = DEFAULT_TARGET_BYTES } = {}
) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const safeMax = Math.max(1, Number(maxBytes) || MAX_IMAGE_BYTES);
  const safeTarget = Math.min(safeMax, Math.max(1, Number(targetBytes) || DEFAULT_TARGET_BYTES));
  const getSize = (c) => Number(c?.size ?? c?.blob?.size ?? Infinity);

  const valid = candidates.filter((c) => {
    const s = getSize(c);
    return Number.isFinite(s) && s > 0 && s <= safeMax;
  });

  if (valid.length === 0) return null;

  const withinTarget = valid.filter((c) => getSize(c) <= safeTarget);
  if (withinTarget.length > 0) {
    return [...withinTarget].sort((a, b) => {
      const pixelsA = (Number(a.width) || 0) * (Number(a.height) || 0);
      const pixelsB = (Number(b.width) || 0) * (Number(b.height) || 0);
      if (pixelsB !== pixelsA) return pixelsB - pixelsA;
      const qualA = Number(a.quality) || 0;
      const qualB = Number(b.quality) || 0;
      if (qualB !== qualA) return qualB - qualA;
      return getSize(a) - getSize(b);
    })[0];
  }

  return [...valid].sort((a, b) => getSize(a) - getSize(b))[0];
}

function replaceFileExtension(filename, mimeType) {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'webp';
  const base = String(filename || 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${ext}`;
}

async function decodeImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          if (typeof bitmap.close === 'function') bitmap.close();
        },
      };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => {
            if (typeof bitmap.close === 'function') bitmap.close();
          },
        };
      } catch {
        // Fallback to HTMLImageElement below
      }
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof URL === 'undefined') {
      reject(new Error('مرورگر امکان پردازش تصویر را ندارد.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('فایل تصویر قابل خواندن نیست.'));
    };
    img.src = url;
  });
}

async function renderCanvasBlob(decoded, width, height, mimeType, quality) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('خطا در آماده‌سازی بوم فشرده‌سازی تصویر.');
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, width, height);
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  if (typeof document === 'undefined') {
    throw new Error('محیط اجرای مرورگر برای فشرده‌سازی تصویر در دسترس نیست.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('خطا در آماده‌سازی بوم فشرده‌سازی تصویر.');
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.source, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Compresses an uploaded image in the browser using OffscreenCanvas / WebP
 * (with JPEG fallback) while enforcing the strict 1 MB per-image ceiling.
 */
export async function compressImageForUpload(
  file,
  {
    maxBytes = MAX_IMAGE_BYTES,
    targetBytes = DEFAULT_TARGET_BYTES,
    maxDimension = DEFAULT_MAX_DIMENSION,
    allowVectorPassthrough = false,
  } = {}
) {
  const safeMaxBytes = Math.min(MAX_IMAGE_BYTES, Math.max(1, Number(maxBytes) || MAX_IMAGE_BYTES));
  const safeTargetBytes = Math.min(safeMaxBytes, Math.max(1, Number(targetBytes) || DEFAULT_TARGET_BYTES));
  const mime = String(file?.type || '').toLowerCase();

  if (!file || !mime.startsWith('image/')) {
    throw new Error('فقط فایل‌های تصویری مجاز هستند.');
  }

  if (allowVectorPassthrough && VECTOR_OR_ICON_MIME_TYPES.has(mime)) {
    if (file.size > safeMaxBytes) {
      throw new Error('حجم هر تصویر باید حداکثر ۱ مگابایت باشد.');
    }
    return file;
  }

  const decoded = await decodeImageSource(file);
  try {
    // Fast-path: modern formats that are already small and within dimensional cap
    if (
      PASSTHROUGH_MODERN_MIME_TYPES.has(mime) &&
      file.size <= safeTargetBytes &&
      decoded.width <= maxDimension &&
      decoded.height <= maxDimension
    ) {
      return file;
    }

    const dimensionLadder = [maxDimension, Math.min(maxDimension, 1280), 960, 720, 560]
      .filter((d, idx, arr) => d >= 320 && arr.indexOf(d) === idx)
      .sort((a, b) => b - a);

    const candidates = [];

    for (let dIdx = 0; dIdx < dimensionLadder.length; dIdx++) {
      const dimLimit = dimensionLadder[dIdx];
      const { width, height } = computeScaledDimensions(decoded.width, decoded.height, dimLimit);
      const qualities = dIdx === 0 ? [0.84, 0.74, 0.62] : [0.74, 0.58, 0.44];

      for (const quality of qualities) {
        let blob = await renderCanvasBlob(decoded, width, height, 'image/webp', quality);
        if (!blob || blob.type !== 'image/webp') {
          blob = await renderCanvasBlob(decoded, width, height, 'image/jpeg', quality);
        }
        if (!blob || !blob.size) continue;

        const candidate = {
          blob,
          size: blob.size,
          mimeType: blob.type || 'image/webp',
          width,
          height,
          quality,
        };
        candidates.push(candidate);

        if (candidate.size <= safeTargetBytes) {
          break;
        }
      }

      const bestSoFar = chooseBestCompressedCandidate(candidates, {
        maxBytes: safeMaxBytes,
        targetBytes: safeTargetBytes,
      });
      if (bestSoFar && bestSoFar.size <= safeTargetBytes) {
        break;
      }
    }

    const best = chooseBestCompressedCandidate(candidates, {
      maxBytes: safeMaxBytes,
      targetBytes: safeTargetBytes,
    });

    // If an existing raster image was already tiny and smaller than re-encoding, preserve it
    if (
      file.size <= safeTargetBytes &&
      decoded.width <= maxDimension &&
      decoded.height <= maxDimension &&
      (!best || file.size <= best.size)
    ) {
      return file;
    }

    if (!best) {
      if (file.size <= safeMaxBytes) return file;
      throw new Error('حجم تصویر حتی پس از فشرده‌سازی بیشتر از ۱ مگابایت است. لطفا تصویر دیگری انتخاب کنید.');
    }

    const outputFile = new File([best.blob], replaceFileExtension(file.name, best.mimeType), {
      type: best.mimeType,
      lastModified: Date.now(),
    });

    if (outputFile.size > safeMaxBytes) {
      throw new Error('حجم هر تصویر باید حداکثر ۱ مگابایت باشد.');
    }

    return outputFile;
  } finally {
    decoded.cleanup();
  }
}
