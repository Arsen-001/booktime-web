import Link from 'next/link';

// Служебные страницы для разработки и замеров (тексты здесь можно по-русски без словарей).
export default function DevLayout({ children }: LayoutProps<'/dev'>) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <nav className="no-scrollbar mx-auto flex h-14 max-w-6xl flex-nowrap items-center gap-1 overflow-x-auto px-4 text-sm">
          <span className="mr-3 shrink-0 font-semibold text-fg">dev</span>
          {[
            ['/dev/ui', 'UI-кит'],
            ['/dev/ui/a', 'Формы'],
            ['/dev/ui/b', 'Оверлеи и данные'],
            ['/dev/ui/c', 'Панели и выбор'],
            ['/', 'Клиент'],
            ['/biz', 'Кабинет'],
            ['/platform', 'Панель'],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 whitespace-nowrap text-muted hover:bg-surface-2 hover:text-fg">
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
