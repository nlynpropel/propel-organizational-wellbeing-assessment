import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export default function PublicHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-green flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-navy-deep" />
          </div>
          <span className="font-display text-xl font-semibold text-white">Propel</span>
        </Link>
        <Link
          to="/login"
          className="text-sm font-medium text-white/90 hover:text-white border border-white/20 hover:border-white/40 rounded-sm px-4 py-2 transition"
        >
          Broker Sign In
        </Link>
      </div>
    </header>
  );
}
