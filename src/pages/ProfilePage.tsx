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
  const [phone, setPhone] = useState(user.phone);
  const [inn, setInn] = useState(user.inn || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    const res = await api.updateMe({ first_name: firstName, last_name: lastName, phone, inn });
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
        toast.error('Ошибка загрузки аватара');
      }
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleDeleteAccount() {
    const res = await api.deleteMe();
    if (res.success) {
      clearSession();
      toast.success('Аккаунт удалён');
      onLogout();
    } else {
      toast.error('Ошибка удаления аккаунта');
    }
  }

  function handleLogout() {
    clearSession();
    onLogout();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Мой профиль</h2>
        <p className="text-sm text-muted-foreground">Личный кабинет гражданина</p>
      </div>

      {/* Аватар */}
      <div className="bg-white rounded-2xl border p-6 flex flex-col items-center gap-4">
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
              : <Icon name="Pencil" size={14} className="text-white" />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-bold">{user.first_name} {user.last_name}</h3>
          <p className="text-muted-foreground text-sm">{user.phone}</p>
          {user.inn && <p className="text-muted-foreground text-xs mt-1">ИНН: {user.inn}</p>}
        </div>

        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5">
          <Icon name="ShieldCheck" size={15} className="text-green-600" />
          <span className="text-xs text-green-700 font-medium">Гражданин Республики Югания</span>
        </div>
      </div>

      {/* Редактирование */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">Личные данные</h3>
          <button
            onClick={() => setEditing(!editing)}
            className="text-primary hover:text-primary/80 transition-colors"
          >
            <Icon name={editing ? 'X' : 'Pencil'} size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {editing ? (
            <>
              <div className="space-y-1.5">
                <Label>Имя</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Фамилия</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Телефон</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ИНН</Label>
                <Input value={inn} onChange={e => setInn(e.target.value)} placeholder="Введите ИНН" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
                Сохранить изменения
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Имя', value: user.first_name, icon: 'User' },
                { label: 'Фамилия', value: user.last_name, icon: 'User' },
                { label: 'Телефон', value: user.phone, icon: 'Phone' },
                { label: 'ИНН', value: user.inn || 'Не указан', icon: 'Hash' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon name={f.icon} size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-sm font-medium">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Дата регистрации */}
      {user.created_at && (
        <div className="bg-muted rounded-2xl p-4 flex items-center gap-3">
          <Icon name="Calendar" size={18} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Гражданин с {new Date(user.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      )}

      {/* Выйти */}
      <Button variant="outline" className="w-full" onClick={handleLogout}>
        <Icon name="LogOut" size={16} className="mr-2" />
        Выйти из аккаунта
      </Button>

      {/* Удалить аккаунт */}
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
              Это действие необратимо. Все ваши данные, документы и история будут удалены из системы портала Югару.
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
