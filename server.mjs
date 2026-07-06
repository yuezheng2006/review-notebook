import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanupTempImageFile,
  extensionFromImageContentType,
  runImageOcrRecognition,
  writeTempImageFile
} from './server/ocr-runner.mjs';
import {
  cleanupTempFile,
  extensionFromContentType,
  runWhisperTranscription,
  writeTempAudioFile
} from './server/transcribe-runner.mjs';
import { getApiErrorStatus, resolveStaticPath } from './server/http-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, 'web');
const port = Number(process.env.PORT || 5173);

const contentTypeMap = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon']
]);

async function serveStatic(req, res) {
  const fullPath = resolveStaticPath(webRoot, req.url || '/');
  if (!fullPath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = contentTypeMap.get(ext) || 'application/octet-stream';
    const content = await fs.readFile(fullPath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

function readRequestBody(req, maxBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('payload_too_large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

async function handleTranscribe(req, res) {
  let tempFilePath = null;
  try {
    const buffer = await readRequestBody(req);
    if (buffer.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'empty_audio' }));
      return;
    }

    const contentType = req.headers['content-type'] || '';
    const extension = extensionFromContentType(contentType);
    tempFilePath = await writeTempAudioFile(buffer, extension);

    const result = await runWhisperTranscription({
      audioPath: tempFilePath,
      language: 'zh',
      model: 'small'
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (error) {
    const statusCode = getApiErrorStatus(error);
    const message =
      error?.message === 'payload_too_large'
        ? '音频文件过大，请控制在 20MB 内。'
        : `语音转写失败：${error?.message || 'unknown error'}`;
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  } finally {
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}

async function handleOcr(req, res) {
  let tempFilePath = null;
  try {
    const buffer = await readRequestBody(req);
    if (buffer.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'empty_image' }));
      return;
    }

    const contentType = req.headers['content-type'] || '';
    const extension = extensionFromImageContentType(contentType);
    tempFilePath = await writeTempImageFile(buffer, extension);

    const result = await runImageOcrRecognition({
      imagePath: tempFilePath
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (error) {
    const statusCode = getApiErrorStatus(error);
    const message =
      error?.message === 'payload_too_large'
        ? '图片文件过大，请控制在 20MB 内。'
        : `OCR 识别失败：${error?.message || 'unknown error'}`;
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
  } finally {
    if (tempFilePath) {
      await cleanupTempImageFile(tempFilePath);
    }
  }
}

createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (req.method === 'POST' && req.url === '/api/transcribe') {
    await handleTranscribe(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/ocr') {
    await handleOcr(req, res);
    return;
  }

  await serveStatic(req, res);
}).listen(port, () => {
  console.log(`Local web app is running on http://localhost:${port}`);
});
