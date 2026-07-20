import { LogOut, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function getInitials(profile: { first_name: string | null; last_name: string | null; email: string } | null) {
  if (!profile) return '?';
  if (profile.first_name && profile.last_name) {
    return (profile.first_name[0] + profile.last_name[0]).toUpperCase();
  }
  return profile.email.slice(0, 2).toUpperCase();
}

function getDisplayName(profile: { first_name: string | null; last_name: string | null; email: string } | null) {
  if (!profile) return 'Unknown';
  if (profile.first_name && profile.last_name) {
    return `${profile.first_name} ${profile.last_name}`;
  }
  return profile.email;
}

export default function BrokerTopbar() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden md:block relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-muted" />
        <input
          placeholder="Search clients…"
          className="w-56 pl-9 pr-3 py-1.5 text-sm rounded-sm border border-neutral-border bg-neutral-bg focus:outline-none focus:border-green focus:bg-white transition"
        />
      </div>
      <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-neutral-border-soft">
        <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-navy font-semibold text-sm">
          {getInitials(profile)}
        </div>
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-navy">{getDisplayName(profile)}</p>
          <p className="text-xs text-neutral-muted">{profile?.email}</p>
        </div>
      </div>
      <button
        onClick={signOut}
        className="p-2 rounded-sm text-neutral-secondary hover:text-navy hover:bg-navy/5 transition"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}
