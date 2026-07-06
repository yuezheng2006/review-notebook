export function ensureMediaRecorderSupport() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持麦克风采集。');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('当前浏览器不支持录音。');
  }
}

export async function postAudioForTranscription(blob) {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'audio/webm'
    },
    body: blob
  });

  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || '转写失败');
  }

  return payload;
}

export async function startAudioRecording() {
  ensureMediaRecorderSupport();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
  });

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.start();

  return {
    stop() {
      return new Promise((resolve) => {
        recorder.addEventListener(
          'stop',
          () => {
            stream.getTracks().forEach((track) => track.stop());
            resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
          },
          { once: true }
        );
        recorder.stop();
      });
    }
  };
}
