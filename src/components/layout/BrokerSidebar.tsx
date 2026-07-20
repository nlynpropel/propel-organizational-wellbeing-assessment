import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Settings,
  Sparkles,
  Shield,
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

export default function BrokerSidebar() {
  const { profile, role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-navy text-white h-screen sticky top-0 shrink-0">
      <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-8 h-8 rounded-md bg-green flex items-center justify-center">
          <Sparkles className="w-4.5 h-4.5 text-navy-deep" />
        </div>
        <span className="font-display text-lg font-semibold">Propel</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/65 hover:text-white hover:bg-white/5'
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
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition mt-4 border-t border-white/10 pt-4 ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/65 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Shield className="w-4.5 h-4.5" />
            Propel Admin
          </NavLink>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-green font-semibold text-sm">
            {getInitials(profile)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{getDisplayName(profile)}</p>
            <p className="text-xs text-white/50 truncate">{profile?.brokerage_name ?? 'Broker'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
