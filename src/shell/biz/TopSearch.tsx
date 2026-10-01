'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { SearchInput } from '@/ui/SearchInput';
import { Sheet } from '@/ui/Sheet';

/**
 * Поиск в верхней полосе кабинета: Enter → /biz/clients?q=… (раздел clients разбирает q).
 * Десктоп — поле в полосе. Телефон — кнопка-лупа рядом с колокольчиком, поле открывается шторкой снизу
 * (раньше на телефоне поиска не было вовсе).
 */
export function TopSearch() {
  const t = useT('common');
  const tu = useT('ui');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);

  const go = () => {
    const q = value.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/biz/clients?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <form
        role="search"
        noValidate
        className="hidden w-full max-w-md md:block"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <Input
          type="search"
          size="sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('shell.searchPlaceholder')}
          aria-label={t('shell.searchPlaceholder')}
          leftIcon={<Search className="size-4" aria-hidden />}
        />
      </form>

      <IconButton
        className="ml-auto md:hidden"
        variant="ghost"
        label={tu('search.placeholder')}
        icon={<Search />}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen} side="bottom" title={tu('search.placeholder')}>
        <form
          role="search"
        noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <SearchInput
            size="lg"
            autoFocus
            enterKeyHint="search"
            value={value}
            onValueChange={setValue}
            placeholder={t('shell.searchPlaceholder')}
            aria-label={t('shell.searchPlaceholder')}
          />
          <Button type="submit" fullWidth disabled={!value.trim()} leftIcon={<Search aria-hidden />}>
            {tu('search.placeholder')}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
