import { useEffect, useState } from 'react';

/**
 * Object URL for a File/Blob with automatic revoke on change/unmount.
 * Prefer this over resolveImagePreviewUrl(file) when the URL is shown in React UI.
 */
export function useObjectUrl(fileOrBlob) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!(fileOrBlob instanceof Blob)) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(fileOrBlob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [fileOrBlob]);

  return url;
}
