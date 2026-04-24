import { ReactNode } from 'react';
import { User } from '@/lib/auth';
import Icon from '@/components/ui/icon';

interface LayoutProps {
  children: ReactNode;
  user: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'news', label: 'Новости', icon: 'Newspaper' },
  { id: 'country', label: 'Страна', icon: 'Building2' },
  { id: 'profile', label: 'Профиль', icon: 'User' },
];

export default function Layout({ children, user, activeTab, onTabChange }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Шапка */}
      <header className="yugaru-header sticky top-0 z-50 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center">
              <Icon name="Shield" size={20} className="text-blue-900" />
            </div>
            <div>
              <span className="text-white font-bold text-xl tracking-wide">ЮГАРУ</span>
              <p className="text-blue-200 text-[10px] tracking-widest leading-none">ПОРТАЛ ЮГАНИИ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">{user.first_name[0]}</span>
              )}
            </div>
            <span className="text-white text-sm font-medium hidden sm:block">{user.first_name}</span>
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-24">
        {children}
      </main>

      {/* Нижняя навигация */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 shadow-xl">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={22} />
              <span className="text-[11px] font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 w-12 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}