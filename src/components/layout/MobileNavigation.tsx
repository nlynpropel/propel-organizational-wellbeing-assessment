import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Settings,
  Sparkles,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/assessments', label: 'Assessments', icon: ClipboardList },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

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

export default function MobileNavigation() {
  const { profile, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const isAdmin = role === 'admin';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 rounded-sm text-navy hover:bg-navy/5 transition"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-navy text-white h-full flex flex-col">
            <div className="px-5 h-16 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-green flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-navy-deep" />
                </div>
                <span className="font-display text-lg font-semibold">Propel</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-sm text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" onClick={() => setOpen(false)}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <item.icon className="w-4.5 h-4.5" />
                  {item.label}
                </NavLink>
              ))}

              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition mt-4 border-t border-white/10 pt-4 ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Shield className="w-4.5 h-4.5" />
                  Propel Admin
                </NavLink>
              )}
            </nav>

            <div className="px-3 py-4 border-t border-white/10">
              <div className="flex items-center gap-2.5 px-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-green font-semibold text-sm">
                  {getInitials(profile)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{getDisplayName(profile)}</p>
                  <p className="text-xs text-white/50 truncate">{profile?.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/5 transition"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
