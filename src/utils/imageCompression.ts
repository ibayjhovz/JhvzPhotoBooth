/**
 * Utility to compress base64 images (PNG or JPEG) to a compact JPEG data URL.
 * Downscales dimensions to fit within maxWidth/maxHeight and compresses with the given quality.
 * This ensures that photostrips (which can be 2-4MB in raw PNG format) are stored in Firestore
 * and local storage as compact 30KB - 80KB JPEGs, avoiding size failures.
 */
export function compressBase64Image(
  base64DataUrl: string,
  maxWidth = 400,
  maxHeight = 1200,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!base64DataUrl) {
      resolve('');
      return;
    }

    // If it's already small or not a data URL, return it
    if (!base64DataUrl.startsWith('data:image/')) {
      resolve(base64DataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions preserving aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get 2D context for compression canvas');
        }

        // Draw image onto the canvas (downscaling)
        ctx.fillStyle = '#FFFFFF'; // Set solid white background (since JPEGs don't support transparency)
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (err) {
        console.error('[COMPRESSION ERROR] Failed during canvas operations:', err);
        // Fallback to original image on canvas failure
        resolve(base64DataUrl);
      }
    };

    img.onerror = (err) => {
      console.error('[COMPRESSION ERROR] Failed to load image for compression:', err);
      // Fallback to original image on load failure
      resolve(base64DataUrl);
    };

    img.src = base64DataUrl;
  });
}
