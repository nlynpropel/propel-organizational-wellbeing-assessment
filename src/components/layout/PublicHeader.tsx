import { Link } from 'react-router-dom';

export default function PublicHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img
            src="/Propel_Logo_2020_v4-3.png"
            alt="Propel"
            className="h-8 w-auto"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
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
