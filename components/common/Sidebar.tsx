import Link from 'next/link';

export function Sidebar() {
  return (
    <div className="w-64 bg-white border-r h-screen hidden md:flex flex-col">
      <div className="p-6 border-b">
        <Link href="/" className="text-2xl font-bold text-primary-600">Evermore</Link>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/portal" className="block px-4 py-2 rounded-md bg-primary-50 text-primary-900 font-medium">
          📚 Library
        </Link>
        <Link href="/settings" className="block px-4 py-2 rounded-md text-neutral-600 hover:bg-neutral-50">
          ⚙️ Settings
        </Link>
      </nav>
      <div className="p-4 border-t">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
            👤
          </div>
          <div>
            <div className="font-medium">Sarah T.</div>
            <div className="text-xs text-neutral-500">Family Member</div>
          </div>
        </div>
      </div>
    </div>
  );
}
