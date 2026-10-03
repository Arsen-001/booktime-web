/**
 * Открытая карточка в адресе (?u=<id>, ?b=<id>): ссылкой можно поделиться с командой и открыть карточку с другого
 * экрана. replaceState, а не переход: история не копит каждое открытие, страница не перерисовывается.
 */
export function setUrlParam(key: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(window.history.state, '', url);
}
