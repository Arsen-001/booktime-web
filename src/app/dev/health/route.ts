// Проверка готовности дев-сервера (scripts/ensure-dev.sh)
export function GET() {
  return Response.json({ ok: true, time: new Date().toISOString() });
}
