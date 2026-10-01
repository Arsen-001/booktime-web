/**
 * «Поделиться» обычными ссылками мессенджеров — без ботов, без платных сообщений (наше решение: пуш и ссылки).
 *   whatsAppShareUrl('Привет! https://…')        → wa.me с готовым текстом (ссылка внутри текста)
 *   telegramShareUrl('https://…', 'Привет!')      → t.me/share: ссылка и текст отдельно
 */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
