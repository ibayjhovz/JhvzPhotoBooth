/**
 * Public Anonymous File Upload Helpers for Photostrip sharing.
 * Provides a highly reliable multi-tier fallback chain (tmpfiles.org -> file.io).
 */

/**
 * Uploads a base64 image data URL to tmpfiles.org.
 * Files are stored for 1 hour with unlimited downloads.
 */
async function uploadToTmpFiles(base64DataUrl: string): Promise<string> {
  const arr = base64DataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const file = new File([u8arr], `photostrip_${Date.now()}.png`, { type: mime });

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`tmpfiles.org upload failed: ${res.statusText}`);
  }

  const result = await res.json();
  if (result.status === 'success' && result.data && result.data.url) {
    // Transform "https://tmpfiles.org/XXXX/file.png" into direct download "https://tmpfiles.org/dl/XXXX/file.png"
    let link = result.data.url;
    if (link.includes('tmpfiles.org/')) {
      link = link.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
    return link;
  }
  throw new Error('Invalid response from tmpfiles.org');
}

/**
 * Uploads a base64 image data URL to file.io.
 * File is deleted after the first download (used as backup fallback).
 */
async function uploadToFileIo(base64DataUrl: string): Promise<string> {
  const arr = base64DataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const file = new File([u8arr], `photostrip_${Date.now()}.png`, { type: mime });

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('https://file.io', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error(`file.io upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.success && data.link) {
    return data.link;
  }
  throw new Error('Invalid response from file.io');
}

/**
 * Primary helper that coordinates the fallback chain.
 */
export async function uploadToPublicFallback(base64DataUrl: string): Promise<string> {
  try {
    console.log('[PUBLIC-UPLOAD] Attempting primary upload to tmpfiles.org...');
    const url = await uploadToTmpFiles(base64DataUrl);
    console.log('[PUBLIC-UPLOAD] tmpfiles.org success:', url);
    return url;
  } catch (err) {
    console.warn('[PUBLIC-UPLOAD] tmpfiles.org failed, trying file.io:', err);
    try {
      const url = await uploadToFileIo(base64DataUrl);
      console.log('[PUBLIC-UPLOAD] file.io success:', url);
      return url;
    } catch (err2) {
      console.error('[PUBLIC-UPLOAD] Both upload channels failed:', err2);
      throw new Error('All public anonymous upload pathways failed.');
    }
  }
}
