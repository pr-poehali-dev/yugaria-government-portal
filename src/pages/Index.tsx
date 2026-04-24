import { useState, useEffect } from 'react';
import { getSession, User } from '@/lib/auth';
import AuthPage from './AuthPage';
import Layout from '@/components/Layout';
import NewsPage from './NewsPage';
import CountryPage from './CountryPage';
import ProfilePage from './ProfilePage';
import { api } from '@/lib/api';

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('news');

  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session.user);
      api.getMe().then(res => {
        if (res.user) setUser(res.user);
      });
    }
    setLoading(false);
  }, []);

  function handleAuth() {
    const session = getSession();
    if (session) setUser(session.user);
  }

  function handleLogout() {
    setUser(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, hsl(214,70%,18%) 0%, hsl(214,60%,30%) 60%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-blue-900 text-2xl font-bold">Ю</span>
          </div>
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <Layout user={user} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'news' && <NewsPage user={user} />}
      {activeTab === 'country' && <CountryPage user={user} />}
      {activeTab === 'profile' && (
        <ProfilePage
          user={user}
          onUserUpdate={setUser}
          onLogout={handleLogout}
        />
      )}
    </Layout>
  );
}
