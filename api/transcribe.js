export default async function handler() {
  return Response.json(
    {
      ok: false,
      error:
        '语音转写功能在云部署版暂不可用（需本地 Python + faster-whisper）。请使用本地启动：PYTHON_BIN=.venv311/bin/python npm start'
    },
    { status: 503 }
  );
}
