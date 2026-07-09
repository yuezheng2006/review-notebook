export default async function handler() {
  return Response.json(
    {
      ok: false,
      error:
        'OCR 功能在云部署版暂不可用（需本地 Python + rapidocr）。请使用本地启动：PYTHON_BIN=.venv311/bin/python npm start'
    },
    { status: 503 }
  );
}
