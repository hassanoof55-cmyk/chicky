export type ImagePurpose = 'banner' | 'product' | 'logoRed' | 'logoWhite';

// Every upload has a new URL, so a long browser cache cannot hide a replacement.
export const IMAGE_CACHE_SECONDS = '31536000';
export const IMAGE_LIMITS = {
  banner: { maxDimension: 1920, maxBytes: 400 * 1024 },
  product: { maxDimension: 960, maxBytes: 200 * 1024 },
  logoRed: { maxDimension: 640, maxBytes: 150 * 1024 },
  logoWhite: { maxDimension: 640, maxBytes: 150 * 1024 },
} as const;

export function fitImage(width: number, height: number, maxDimension: number) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) {
    throw new Error('تعذّر قراءة أبعاد الصورة.');
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function optimizeImage(file: File, purpose: ImagePurpose): Promise<File> {
  const limit = IMAGE_LIMITS[purpose];
  if (!file.type.startsWith('image/') || file.size === 0) {
    throw new Error('اختار ملف صورة صالح.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('الصورة أكبر من 20 ميجابايت. صغّرها قبل الرفع.');
  }

  // Keep animation and vector logos intact instead of flattening them to a frame.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    if (file.size > limit.maxBytes) {
      throw new Error('ملف GIF أو SVG كبير. استخدم نسخة أصغر أو صورة ثابتة.');
    }
    return file;
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    let { width, height } = fitImage(image.naturalWidth, image.naturalHeight, limit.maxDimension);
    if (file.size <= limit.maxBytes && width === image.naturalWidth && height === image.naturalHeight) {
      return file;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('المتصفح لا يدعم تجهيز الصور. جرّب متصفحًا أحدث.');

    // Reduce dimensions only if WebP at a reasonable quality still exceeds the budget.
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [0.85, 0.75, 0.65]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) throw new Error('تعذّر ضغط الصورة. استخدم ملف PNG أو JPEG آخر.');
        if (blob.size <= limit.maxBytes) {
          const extension = blob.type === 'image/webp' ? 'webp' : 'png';
          const name = file.name.replace(/\.[^.]+$/, '') || 'image';
          return new File([blob], `${name}.${extension}`, { type: blob.type });
        }
      }
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
    throw new Error('الصورة لسه كبيرة بعد الضغط. اختار صورة أبسط أو أصغر.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
