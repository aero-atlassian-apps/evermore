import Link from 'next/link';

export function Header() {
  return (
    <header className="flex items-center justify-between p-6 bg-white border-b">
      <div className="text-2xl font-bold">Evermore</div>
      <nav className="flex gap-4">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/onboarding" className="hover:underline">Get Started</Link>
        <Link href="/portal" className="hover:underline">Family Portal</Link>
      </nav>
    </header>
  );
}
