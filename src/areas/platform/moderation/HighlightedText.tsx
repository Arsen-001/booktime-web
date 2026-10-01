/** Текст на проверку с подсвеченными контактами и ссылками — то, из-за чего чаще всего отклоняем. */
const CONTACT_RE = /(\+?\d[\d\s()-]{7,}\d|https?:\/\/\S+|www\.\S+|@[\w.]{3,}|whatsapp|instagram|telegram)/gi;

export function HighlightedText({ text }: { text: string }) {
  const parts = text.split(CONTACT_RE);
  return (
    <p className="text-base leading-relaxed whitespace-pre-line text-fg">
      {parts.map((part, i) => (i % 2 === 1 ? <mark key={i} className="rounded bg-warning-soft px-0.5 text-fg">{part}</mark> : part))}
    </p>
  );
}
