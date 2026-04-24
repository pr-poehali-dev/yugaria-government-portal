import { useState, useRef } from 'react';
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

type Mode = 'choose' | 'login' | 'register';
type Step = 'phone' | 'sms' | 'info' | 'photo';

// Симуляция OAuth Госуслуги
const GOSUSLUGI_MOCK_USERS = [
  { first_name: 'Иван', last_name: 'Петров', middle_name: 'Сергеевич', inn: '772012345678', snils: '123-456-789 00' },
  { first_name: 'Мария', last_name: 'Иванова', middle_name: 'Александровна', inn: '771234567890', snils: '987-654-321 00' },
  { first_name: 'Алексей', last_name: 'Сидоров', middle_name: 'Владимирович', inn: '770987654321', snils: '456-789-123 00' },
];

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsTimer, setSmsTimer] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [inn, setInn] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarB64, setAvatarB64] = useState('');
  const [avatarType, setAvatarType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [gosuslugiLoading, setGosuslugiLoading] = useState(false);
  const [gosuslugiStep, setGosuslugiStep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Таймер для повторной отправки SMS
  function startTimer() {
    setSmsTimer(60);
    const iv = setInterval(() => {
      setSmsTimer(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendSms() {
    if (!phone.trim()) { toast.error('Введите номер телефона'); return; }
    setLoading(true);
    const res = await api.sendSms(phone);
    setLoading(false);
    if (res.sent) {
      setSmsSent(true);
      startTimer();
      toast.success('SMS-код отправлен');
      setStep('sms');
    } else {
      toast.error(res.error || 'Ошибка отправки SMS');
    }
  }

  async function handleVerifySms(bypass = false) {
    setLoading(true);
    const res = await api.verifySms(phone, smsCode, bypass);
    setLoading(false);
    if (res.verified) {
      if (mode === 'login') {
        // Вход — сразу логиним
        const loginRes = await api.login(phone);
        if (loginRes.token) {
          saveSession(loginRes.token, loginRes.user);
          toast.success('Добро пожаловать!');
          onAuth();
        } else {
          toast.error(loginRes.error || 'Пользователь не найден. Пройдите регистрацию.');
        }
      } else {
        // Регистрация — переходим к вводу данных
        setStep('info');
      }
    } else {
      toast.error(res.error || 'Неверный код');
    }
  }

  async function handleRegisterInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { toast.error('Введите имя и фамилию'); return; }
    setStep('photo');
  }

  async function handleFinishRegister() {
    setLoading(true);
    const res = await api.register({
      phone,
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      inn,
      avatar_b64: avatarB64,
      avatar_content_type: avatarType,
    });
    setLoading(false);
    if (res.token) {
      saveSession(res.token, res.user);
      toast.success('Добро пожаловать в Югару!');
      onAuth();
    } else {
      toast.error(res.error || 'Ошибка регистрации');
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      setAvatarB64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  }

  // Госуслуги — имитация OAuth
  async function handleGosuslugi() {
    setGosuslugiLoading(true);
    setGosuslugiStep(true);
    // Имитируем редирект на ЕСИА и получение данных
    await new Promise(r => setTimeout(r, 2000));
    const mock = GOSUSLUGI_MOCK_USERS[Math.floor(Math.random() * GOSUSLUGI_MOCK_USERS.length)];
    const phoneForGos = phone || '+70000000000';
    const res = await api.loginGosuslugi({
      phone: phoneForGos,
      gosuslugi_token: 'mock_token_' + Date.now(),
      first_name: mock.first_name,
      last_name: mock.last_name,
      middle_name: mock.middle_name,
      inn: mock.inn,
    });
    setGosuslugiLoading(false);
    setGosuslugiStep(false);
    if (res.token) {
      saveSession(res.token, res.user);
      toast.success(`Вход через Госуслуги выполнен! Добро пожаловать, ${mock.first_name}!`);
      onAuth();
    } else {
      toast.error('Ошибка входа через Госуслуги');
    }
  }

  const emblem = (
    <div className="flex flex-col items-center pt-10 pb-6 px-4">
      <div className="w-20 h-20 rounded-full bg-amber-400 flex items-center justify-center mb-3 shadow-2xl">
        <Icon name="Shield" size={40} className="text-blue-900" />
      </div>
      <h1 className="text-3xl font-bold text-white tracking-wide">ЮГАРУ</h1>
      <p className="text-blue-200 text-xs font-medium tracking-widest uppercase mt-0.5">Государственный портал Югании</p>
    </div>
  );

  // Кнопка Госуслуги
  const gosuslugiBtn = (
    <button
      type="button"
      onClick={handleGosuslugi}
      disabled={gosuslugiLoading}
      className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border-2 border-blue-600 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors disabled:opacity-60"
    >
      {gosuslugiLoading ? (
        <Icon name="Loader2" size={18} className="animate-spin" />
      ) : (
        <span className="text-lg">🏛️</span>
      )}
      {gosuslugiStep ? 'Подключение к ЕСИА...' : 'Войти через Госуслуги'}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, hsl(214,70%,18%) 0%, hsl(214,60%,30%) 60%, hsl(210,40%,85%) 100%)' }}>
      {emblem}

      <div className="flex-1 flex items-start justify-center px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

          {/* === ВЫБОР режима === */}
          {mode === 'choose' && (
            <div className="p-7 space-y-4">
              <h2 className="text-xl font-bold text-center text-foreground mb-1">Добро пожаловать</h2>
              <p className="text-center text-muted-foreground text-sm mb-4">Выберите способ входа на портал</p>

              {gosuslugiBtn}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">или</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button className="w-full h-11" onClick={() => { setMode('login'); setStep('phone'); }}>
                <Icon name="Phone" size={18} className="mr-2" />
                Войти по номеру телефона
              </Button>
              <Button variant="outline" className="w-full h-11" onClick={() => { setMode('register'); setStep('phone'); }}>
                <Icon name="UserPlus" size={18} className="mr-2" />
                Зарегистрироваться
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-2">
                Единый портал государственных услуг Республики Югания
              </p>
            </div>
          )}

          {/* === ВВОД ТЕЛЕФОНА === */}
          {(mode === 'login' || mode === 'register') && step === 'phone' && (
            <div className="p-7">
              <button onClick={() => setMode('choose')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
                <Icon name="ArrowLeft" size={16} /> Назад
              </button>

              <h2 className="text-xl font-bold mb-1">
                {mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {mode === 'login' ? 'Введите номер для получения кода' : 'Укажите ваш номер телефона'}
              </p>

              {gosuslugiBtn}

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">или</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Номер телефона</Label>
                  <Input
                    type="tel"
                    placeholder="+7 900 000 00 00"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendSms()}
                  />
                </div>
                <Button className="w-full h-11" onClick={handleSendSms} disabled={loading}>
                  {loading ? <Icon name="Loader2" size={18} className="animate-spin mr-2" /> : null}
                  Получить SMS-код
                </Button>
              </div>

              {mode === 'login' && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  Нет аккаунта?{' '}
                  <button className="text-primary font-medium underline" onClick={() => setMode('register')}>
                    Зарегистрироваться
                  </button>
                </p>
              )}
            </div>
          )}

          {/* === SMS КОД === */}
          {(mode === 'login' || mode === 'register') && step === 'sms' && (
            <div className="p-7">
              <button onClick={() => setStep('phone')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
                <Icon name="ArrowLeft" size={16} /> Назад
              </button>

              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Icon name="MessageSquare" size={28} className="text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-1">Введите код из SMS</h2>
                <p className="text-sm text-muted-foreground">Отправили на номер <span className="font-medium text-foreground">{phone}</span></p>
              </div>

              <div className="space-y-4">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-2xl font-bold tracking-[0.5em] h-14"
                  value={smsCode}
                  onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && smsCode.length === 6 && handleVerifySms(false)}
                />

                <Button className="w-full h-11" onClick={() => handleVerifySms(false)} disabled={loading || smsCode.length < 4}>
                  {loading ? <Icon name="Loader2" size={18} className="animate-spin mr-2" /> : null}
                  Подтвердить
                </Button>

                <div className="space-y-2">
                  {smsTimer > 0 ? (
                    <p className="text-center text-sm text-muted-foreground">
                      Повторная отправка через {smsTimer} с
                    </p>
                  ) : (
                    <Button variant="ghost" className="w-full text-sm" onClick={handleSendSms} disabled={loading}>
                      <Icon name="RefreshCw" size={15} className="mr-1.5" />
                      Отправить код повторно
                    </Button>
                  )}

                  {/* Кнопка "Код не пришёл" — bypass */}
                  <button
                    type="button"
                    onClick={() => handleVerifySms(true)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    Код не пришёл? Войти без кода →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === ДАННЫЕ (только регистрация) === */}
          {mode === 'register' && step === 'info' && (
            <div className="p-7">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex gap-1">
                  {['phone','sms','info','photo'].map((s, i) => (
                    <div key={s} className={`h-1.5 w-8 rounded-full ${['sms','info','photo'].indexOf(step) >= i - 1 || step === 'info' && i <= 2 ? 'bg-primary' : 'bg-border'}`} />
                  ))}
                </div>
              </div>

              <h2 className="text-xl font-bold mb-1">Личные данные</h2>
              <p className="text-sm text-muted-foreground mb-5">Заполните для создания профиля гражданина</p>

              <form onSubmit={handleRegisterInfo} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Фамилия <span className="text-destructive">*</span></Label>
                  <Input placeholder="Иванов" value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Имя <span className="text-destructive">*</span></Label>
                  <Input placeholder="Иван" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Отчество</Label>
                  <Input placeholder="Сергеевич" value={middleName} onChange={e => setMiddleName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>ИНН <span className="text-muted-foreground text-xs">(необязательно)</span></Label>
                  <Input placeholder="12 цифр" maxLength={12} value={inn} onChange={e => setInn(e.target.value.replace(/\D/g, ''))} />
                </div>
                <Button type="submit" className="w-full h-11 mt-2">
                  Далее
                  <Icon name="ArrowRight" size={18} className="ml-2" />
                </Button>
              </form>
            </div>
          )}

          {/* === ФОТО (только регистрация) === */}
          {mode === 'register' && step === 'photo' && (
            <div className="p-7">
              <h2 className="text-xl font-bold mb-1">Фото профиля</h2>
              <p className="text-sm text-muted-foreground mb-6">Добавьте фото из галереи или пропустите</p>

              <div className="flex flex-col items-center gap-4 mb-6">
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-28 h-28 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors overflow-hidden"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Icon name="Camera" size={28} className="text-muted-foreground mx-auto mb-1" />
                      <span className="text-xs text-muted-foreground">Нажмите</span>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="Image" size={16} className="mr-2" />
                  Выбрать из галереи
                </Button>
              </div>

              <div className="bg-muted rounded-xl p-3 mb-4 text-sm">
                <p className="font-medium text-foreground">{lastName} {firstName} {middleName}</p>
                <p className="text-muted-foreground text-xs">{phone}</p>
              </div>

              <div className="space-y-2">
                <Button className="w-full h-11" onClick={handleFinishRegister} disabled={loading}>
                  {loading ? <Icon name="Loader2" size={18} className="animate-spin mr-2" /> : null}
                  {avatarPreview ? 'Завершить регистрацию' : 'Зарегистрироваться без фото'}
                </Button>
                {avatarPreview && (
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setAvatarPreview(null); setAvatarB64(''); }}>
                    Удалить фото
                  </Button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="text-center text-blue-300 text-xs py-4">
        © 2024 Югару — Все права защищены
      </div>
    </div>
  );
}
