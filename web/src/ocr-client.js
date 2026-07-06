export async function postImageForOcr(fileOrBlob) {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': fileOrBlob.type || 'image/png'
    },
    body: fileOrBlob
  });

  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || 'OCR 识别失败');
  }

  return payload;
}
