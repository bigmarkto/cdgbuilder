import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-ink-700 bg-ink-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-serif text-xl text-ink-50 tracking-wide hover:text-ember-400 transition-colors">
          Cicatrizes do Gatilho
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/">Início</NavLink>
          <NavLink href="/wiki">Wiki</NavLink>
          <NavLink href="/builder">Ficha</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-1.5 rounded text-ink-200 hover:bg-ink-800 hover:text-ink-50 transition-colors">
      {children}
    </Link>
  );
}
