import type { AnchorHTMLAttributes, ReactNode } from 'react';

type StaticLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

export function StaticLink({ href, children, ...props }: StaticLinkProps) {
  return <a href={href} {...props}>{children}</a>;
}
