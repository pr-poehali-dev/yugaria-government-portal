import { useState, useRef } from 'react';
import { User, clearSession, updateStoredUser } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProfilePageProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onLogout: () => void;
}

export default function ProfilePage({ user, onUserUpdate, onLogout }: ProfilePageProps) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [middleName, setMiddleName] = useState(user.middle_name || '');
  const [phone, setPhone] = useState(user.phone);
  const [inn, setInn] = useState(user.inn || '');
  const [snils, setSnils] = useState(user.snils || '');
  const [address, setAddress] = useState(user.address || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [gosuslugiLoading, setGosuslugiLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    const res = await api.updateMe({ first_name: firstName, last_name: lastName, middle_name: middleName, phone, inn, snils, address });
    if (res.user) {
      updateStoredUser(res.user);
      onUserUpdate(res.user);
      toast.success('Профиль обновлён');
      setEditing(false);
    } else {
      toast.error(res.error || 'Ошибка сохранения');
    }
    setSaving(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const res = await api.uploadAvatar(base64, file.type);
      if (res.avatar_url) {
        const updated = { ...user, avatar_url: res.avatar_url };
        updateStoredUser(updated);
        onUserUpdate(updated);
        toast.success('Аватар обновлён!');
      } else {
        toast.error('Ошибка загрузки');
      }
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleLinkGosuslugi() {
    setGosuslugiLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    const res = await api.loginGosuslugi({
      phone: user.phone,
      gosuslugi_token: 'link_token_' + Date.now(),
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name || '',
      inn: user.inn || '',
    });
    setGosuslugiLoading(false);
    if (res.token) {
      updateStoredUser(res.user);
      onUserUpdate(res.user);
      toast.success('Аккаунт привязан к Госуслугам!');
    } else {
      toast.error('Ошибка привязки');
    }
  }

  async function handleDeleteAccount() {
    const res = await api.deleteMe();
    if (res.success) {
      clearSession();
      onLogout();
    } else {
      toast.error('Ошибка удаления аккаунта');
    }
  }

  const gosData = user.gosuslugi_data as Record<string, unknown> | undefined;
  const gosDocuments = gosData?.documents as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Мой профиль</h2>
        <p className="text-sm text-muted-foreground">Личный кабинет гражданина</p>
      </div>

      {/* Аватар + имя */}
      <div className="bg-white rounded-2xl border p-5 flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center overflow-hidden ring-4 ring-primary/20">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-3xl font-bold">{user.first_name[0]}{user.last_name[0]}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
          >
            {uploadingAvatar
              ? <Icon name="Loader2" size={14} className="text-white animate-spin" />
              : <Icon name="Pencil" size={14} className="text-white" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-bold">{user.last_name} {user.first_name} {user.middle_name}</h3>
          <p className="text-muted-foreground text-sm">{user.phone}</p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {user.phone_verified && (
            <span className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-medium">
              <Icon name="ShieldCheck" size={12} /> Телефон подтверждён
            </span>
          )}
          {user.gosuslugi_linked && (
            <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium">
              🏛️ Госуслуги подключены
            </span>
          )}
        </div>
      </div>

      {/* Госуслуги блок */}
      {!user.gosuslugi_linked ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🏛️</span>
            <div className="flex-1">
              <p className="font-semibold text-blue-900 text-sm">Привяжите аккаунт к Госуслугам</p>
              <p className="text-blue-700 text-xs mt-0.5 mb-3">Автоматический импорт паспорта, СНИЛС, ИНН и других документов</p>
              <Button size="sm" onClick={handleLinkGosuslugi} disabled={gosuslugiLoading}
                className="bg-blue-700 hover:bg-blue-800 text-white">
                {gosuslugiLoading ? <Icon name="Loader2" size={14} className="animate-spin mr-1.5" /> : null}
                {gosuslugiLoading ? 'Подключение...' : 'Подключить Госуслуги'}
              </Button>
            </div>
          </div>
        </div>
      ) : gosDocuments ? (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🏛️</span>
            <p className="font-semibold text-blue-900 text-sm">Данные из Госуслуг</p>
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Синхронизировано</span>
          </div>

          {gosDocuments.passport && (
            <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border">
              <Icon name="BookOpen" size={18} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Паспорт</p>
                <p className="text-sm font-medium">
                  {(gosDocuments.passport as Record<string,string>).series} {(gosDocuments.passport as Record<string,string>).number}
                </p>
              </div>
            </div>
          )}
          {gosDocuments.snils && (
            <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border">
              <Icon name="CreditCard" size={18} className="text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">СНИЛС</p>
                <p className="text-sm font-medium">{gosDocuments.snils as string}</p>
              </div>
            </div>
          )}
          {gosDocuments.inn && (gosDocuments.inn as string).length > 0 && (
            <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border">
              <Icon name="Hash" size={18} className="text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">ИНН</p>
                <p className="text-sm font-medium">{gosDocuments.inn as string}</p>
              </div>
            </div>
          )}
          {gosDocuments.medical_policy && (
            <div className="flex items-center gap-2.5 bg-white rounded-xl p-3 border">
              <Icon name="Stethoscope" size={18} className="text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Полис ОМС</p>
                <p className="text-sm font-medium">{(gosDocuments.medical_policy as Record<string,string>).number}</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Личные данные */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h3 className="font-semibold text-sm">Личные данные</h3>
          <button onClick={() => setEditing(!editing)} className="text-primary hover:text-primary/80">
            <Icon name={editing ? 'X' : 'Pencil'} size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Фамилия</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Имя</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Отчество</Label>
                <Input value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="Сергеевич" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Телефон</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ИНН</Label>
                <Input value={inn} onChange={e => setInn(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">СНИЛС</Label>
                <Input value={snils} onChange={e => setSnils(e.target.value)} placeholder="000-000-000 00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Адрес</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="г. Южный, ул. Главная, 1" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
                Сохранить
              </Button>
            </>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: 'Фамилия', value: user.last_name, icon: 'User' },
                { label: 'Имя', value: user.first_name, icon: 'User' },
                { label: 'Отчество', value: user.middle_name || '—', icon: 'User' },
                { label: 'Телефон', value: user.phone, icon: 'Phone' },
                { label: 'ИНН', value: user.inn || '—', icon: 'Hash' },
                { label: 'СНИЛС', value: user.snils || '—', icon: 'CreditCard' },
                { label: 'Адрес', value: user.address || '—', icon: 'MapPin' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name={f.icon} size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground leading-none">{f.label}</p>
                    <p className="text-sm font-medium">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {user.created_at && (
        <div className="bg-muted rounded-xl p-3 flex items-center gap-2.5">
          <Icon name="Calendar" size={16} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Гражданин с {new Date(user.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => { clearSession(); onLogout(); }}>
        <Icon name="LogOut" size={16} className="mr-2" />
        Выйти из аккаунта
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
            <Icon name="Trash2" size={16} className="mr-2" />
            Удалить аккаунт
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Все ваши данные, документы и история будут удалены из портала Югару.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-white hover:bg-destructive/90">
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
