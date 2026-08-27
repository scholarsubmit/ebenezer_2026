// Shared client-side image helpers — used by both the admin upload page
// and the public photo-submission page, so photos are always shrunk the
// same way before they ever leave the browser (keeps requests well under
// Vercel's 4.5MB serverless function body limit).
window.CAC_IMG = (function () {
  function slugify(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function sanitizeName(name) {
    return String(name).replace(/[^a-zA-Z0-9._-]/g, '-');
  }

  function compressImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) resolve(blob);
            else reject(new Error('Could not process image'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read image'));
      };
      img.src = objectUrl;
    });
  }

  // Tries progressively smaller/lower-quality passes until the result
  // fits comfortably under the server's limit (accounting for base64's
  // ~33% size inflation), or gives up after a few tries.
  async function prepareForUpload(file) {
    const SAFE_LIMIT = 2.2 * 1024 * 1024;
    if (file.size <= SAFE_LIMIT && /^image\/(jpeg|png|webp)$/.test(file.type)) {
      return { blob: file, renamedJpeg: false };
    }
    const attempts = [
      { maxDim: 2000, quality: 0.82 },
      { maxDim: 1600, quality: 0.78 },
      { maxDim: 1300, quality: 0.72 },
      { maxDim: 1000, quality: 0.68 },
    ];
    let lastErr;
    for (const attempt of attempts) {
      try {
        const blob = await compressImage(file, attempt.maxDim, attempt.quality);
        if (blob.size <= SAFE_LIMIT) return { blob, renamedJpeg: true };
        lastErr = new Error('Still too large after compression');
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Could not compress image enough to upload.');
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error('Could not read the compressed image'));
      reader.readAsDataURL(blob);
    });
  }

  return { slugify, sanitizeName, compressImage, prepareForUpload, blobToBase64 };
})();
