/**
 * Разметка schema.org для поисковиков — обычный <script type="application/ld+json"> в HTML с сервера
 * (рекомендация Next: node_modules/next/dist/docs/01-app/02-guides/json-ld.md). «<» экранируем — названия и
 * описания пишут сами бизнесы, без этого текст «</script>» сломал бы страницу.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
