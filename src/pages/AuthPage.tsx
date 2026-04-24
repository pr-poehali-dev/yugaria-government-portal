import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { saveSession } from '@/lib/auth';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface AuthPageProps {
  onAuth: () => void;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      let res;
      if (mode === 'register') {
        res = await api.register(phone, firstName, lastName);
      } else {
        res = await api.login(phone, firstName, lastName);
      }
      if (res.error) {
        toast.error(res.error);
      } else {
        saveSession(res.token, res.user);
        toast.success(mode === 'register' ? 'Добро пожаловать в Югару!' : 'Вход выполнен');
        onAuth();
      }
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, hsl(214,70%,18%) 0%, hsl(214,60%,30%) 60%, hsl(210,40%,85%) 100%)' }}>
      {/* Герб / Шапка */}
      <div className="flex flex-col items-center pt-14 pb-8 px-4">
        <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center mb-4 shadow-2xl">
          <Icon name="Shield" size={40} className="text-blue-900" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-wide mb-1">ЮГАРУ</h1>
        <p className="text-blue-200 text-sm font-medium tracking-widest uppercase">Государственный портал Югании</p>
      </div>

      {/* Форма */}
      <div className="flex-1 flex items-start justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="flex rounded-xl overflow-hidden border border-border mb-6">
            <button
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              onClick={() => setMode('login')}
            >
              Войти
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === 'register' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              onClick={() => setMode('register')}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Номер телефона</Label>
              <Input
                type="tel"
                placeholder="+7 900 000 00 00"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Имя</Label>
              <Input
                placeholder="Иван"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Фамилия</Label>
              <Input
                placeholder="Иванов"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loading}>
              {loading ? (
                <Icon name="Loader2" size={18} className="animate-spin mr-2" />
              ) : (
                <Icon name="LogIn" size={18} className="mr-2" />
              )}
              {mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
            </Button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              Впервые на портале?{' '}
              <button className="text-primary font-medium underline" onClick={() => setMode('register')}>
                Создать аккаунт
              </button>
            </p>
          )}

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-center text-xs text-muted-foreground">
              Единый портал государственных услуг Республики Югания
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-blue-300 text-xs py-6">
        © 2024 Югару — Все права защищены
      </div>
    </div>
  );
}
