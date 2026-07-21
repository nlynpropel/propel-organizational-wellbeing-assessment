import { User, Bell, Shield, LogOut } from 'lucide-react';
import BrokerLayout from '../components/layout/BrokerLayout';
import PageHeader from '../components/layout/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

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

export default function SettingsPage() {
  const { profile, signOut } = useAuth();

  return (
    <BrokerLayout title="Settings">
      <PageHeader title="Settings" subtitle="Manage your profile and preferences" />

      <div className="max-w-2xl space-y-5">
        {/* Profile */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-navy" />
            <h2 className="font-display text-base font-semibold text-navy">Profile</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center text-navy font-semibold">
              {getInitials(profile)}
            </div>
            <div>
              <p className="font-medium text-navy">{getDisplayName(profile)}</p>
              <p className="text-sm text-neutral-muted">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="neutral">{profile?.role === 'admin' ? 'Admin' : 'Broker'}</Badge>
                <Badge variant={profile?.status === 'active' ? 'success' : 'warning'}>
                  {profile?.status ?? 'unknown'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Brokerage */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-navy" />
            <h2 className="font-display text-base font-semibold text-navy">Brokerage</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-muted">Brokerage</dt>
              <dd className="text-navy font-medium">{profile?.brokerage_name ?? 'Not set'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-muted">Role</dt>
              <dd className="text-navy font-medium">Employee-benefits broker</dd>
            </div>
          </dl>
        </Card>

        {/* Notifications */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-navy" />
            <h2 className="font-display text-base font-semibold text-navy">Notifications</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Assessment opened by client', on: true },
              { label: 'Assessment submitted', on: true },
              { label: 'Report ready', on: true },
              { label: 'Link expired', on: false },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between">
                <span className="text-sm text-navy">{n.label}</span>
                <span className={`relative inline-flex h-5 w-9 rounded-full transition ${n.on ? 'bg-green' : 'bg-neutral-border'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition ${n.on ? 'translate-x-4' : ''}`} />
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-navy" />
            <h2 className="font-display text-base font-semibold text-navy">Security</h2>
          </div>
          <p className="text-sm text-neutral-secondary">
            You sign in with a secure magic link sent to your email. No password required.
          </p>
        </Card>

        {/* Sign out */}
        <div className="pt-2">
          <Button variant="danger" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>
    </BrokerLayout>
  );
}
