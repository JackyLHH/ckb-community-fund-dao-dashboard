'use client';

import type { AnchorHTMLAttributes } from 'react';
import { useLocale } from '@/lib/use-locale';

export function LocaleLink({ hrefZh, href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; hrefZh?: string }) {
  const { locale } = useLocale();
  return <a href={locale === 'zh' ? hrefZh ?? href : href} {...props}>{children}</a>;
}
