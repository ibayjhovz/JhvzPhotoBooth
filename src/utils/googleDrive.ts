/**
 * Google Drive API Helpers for uploading photostrips.
 */

export async function getOrCreateFolder(accessToken: string, folderNameOrUrl: string): Promise<string> {
  const trimmed = folderNameOrUrl.trim();
  let folderId = '';

  // Match Google Drive folder link pattern: /folders/ID or ?id=ID
  const foldersRegex = /\/folders\/([a-zA-Z0-9-_]{20,100})/;
  const idParamRegex = /[?&]id=([a-zA-Z0-9-_]{20,100})/;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const foldersMatch = trimmed.match(foldersRegex);
    const idParamMatch = trimmed.match(idParamRegex);
    if (foldersMatch && foldersMatch[1]) {
      folderId = foldersMatch[1];
    } else if (idParamMatch && idParamMatch[1]) {
      folderId = idParamMatch[1];
    }
  } else if (/^[a-zA-Z0-9-_]{20,100}$/.test(trimmed)) {
    // If it is just the raw Google Drive folder ID
    folderId = trimmed;
  }

  if (folderId) {
    console.log(`[DRIVE] Detected explicit Folder ID: ${folderId}`);
    try {
      // Validate that the folder exists and is accessible
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`[DRIVE] Folder validated successfully: "${data.name}"`);
        return folderId;
      } else {
        console.warn(`[DRIVE] Folder validation status code: ${res.status}. Falling back to using ID directly.`);
        return folderId;
      }
    } catch (err) {
      console.error('[DRIVE] Error validating folder ID, using directly anyway:', err);
      return folderId;
    }
  }

  // Query for the folder by name if no explicit ID/link was detected
  const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${trimmed}' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to query Google Drive folder: ${res.statusText}`);
  }
  
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  
  // Create the folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: trimmed,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  
  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
  }
  
  const createdFolder = await createRes.json();
  return createdFolder.id;
}

export async function uploadPhotostripToDrive(
  accessToken: string,
  base64DataUrl: string,
  fileName: string,
  folderId?: string
): Promise<{ id: string; webViewLink?: string }> {
  const base64Content = base64DataUrl.includes('base64,') 
    ? base64DataUrl.split('base64,')[1] 
    : base64DataUrl;
    
  const boundary = 'photobooth_drive_upload_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const metadata: any = {
    name: fileName,
    mimeType: 'image/png'
  };
  
  if (folderId) {
    metadata.parents = [folderId];
  }
  
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/png\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Content +
    closeDelimiter;
    
  // Upload file
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[DRIVE UPLOAD ERROR]', errorText);
    throw new Error(`Failed to upload to Google Drive: ${res.statusText}`);
  }
  
  const fileData = await res.json();
  
  // Create permission: anyone with the link can view (reader)
  // This resolves the 404/Access Denied error when guests scan the QR code to open the Google Drive file preview.
  try {
    const permissionRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    if (!permissionRes.ok) {
      console.warn(`[DRIVE-PERMISSIONS] Failed to create 'anyone-reader' permission on file ${fileData.id}:`, await permissionRes.text());
    } else {
      console.log(`[DRIVE-PERMISSIONS] Successfully shared file ${fileData.id} with 'anyone' (reader).`);
    }
  } catch (err) {
    console.error(`[DRIVE-PERMISSIONS] Error sharing file ${fileData.id}:`, err);
  }
  
  // Optionally, get more metadata including webViewLink so we can link directly to it!
  try {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=webViewLink,webContentLink`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      return { id: fileData.id, webViewLink: metaData.webViewLink };
    }
  } catch (err) {
    console.error('Failed to fetch full Drive file metadata:', err);
  }
  
  return { id: fileData.id };
}
