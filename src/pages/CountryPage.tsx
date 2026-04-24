import { useState } from 'react';
import { User } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface CountryPageProps {
  user: User;
}

type Section = 'main' | 'doctor' | 'fines' | 'taxes' | 'documents' | 'gosuslugi';

interface Fine { id: number; amount: number; description: string; status: string; issued_at: string; car_number?: string; }
interface Tax { id: number; tax_type: string; amount: number; period: string; status: string; due_date?: string; }
interface Doc { id: number; doc_type: string; doc_number: string; created_at: string; }
interface Appointment { id: number; service_type: string; doctor_name: string; appointment_date: string; appointment_time: string; status: string; }

const DOC_TYPES = [
  { value: 'passport', label: 'Паспорт', icon: 'BookOpen' },
  { value: 'medical', label: 'Медицинская карта', icon: 'Stethoscope' },
  { value: 'snils', label: 'СНИЛС', icon: 'CreditCard' },
  { value: 'inn', label: 'ИНН', icon: 'FileText' },
  { value: 'other', label: 'Другой документ', icon: 'File' },
];

const DOCTORS = ['Терапевт', 'Кардиолог', 'Невролог', 'Хирург', 'Офтальмолог', 'Педиатр', 'Стоматолог'];
const TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    unpaid: { label: 'Не оплачен', color: 'bg-red-100 text-red-700' },
    paid: { label: 'Оплачен', color: 'bg-green-100 text-green-700' },
    pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: 'Подтверждено', color: 'bg-green-100 text-green-700' },
  };
  const s = map[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
}

export default function CountryPage({ user }: CountryPageProps) {
  const [section, setSection] = useState<Section>('main');
  const [loading, setLoading] = useState(false);

  // Fines
  const [fineInn, setFineInn] = useState(user.inn || '');
  const [carNumber, setCarNumber] = useState('');
  const [fines, setFines] = useState<Fine[]>([]);
  const [finesLoaded, setFinesLoaded] = useState(false);

  // Taxes
  const [taxInn, setTaxInn] = useState(user.inn || '');
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [taxesLoaded, setTaxesLoaded] = useState(false);

  // Documents
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [addDocMode, setAddDocMode] = useState(false);
  const [docType, setDocType] = useState('passport');
  const [docNumber, setDocNumber] = useState('');

  // Appointment
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appsLoaded, setAppsLoaded] = useState(false);
  const [doctor, setDoctor] = useState(DOCTORS[0]);
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState(TIMES[0]);
  const [apptNotes, setApptNotes] = useState('');

  async function loadFines() {
    setLoading(true);
    const res = await api.getFines(fineInn, carNumber);
    if (res.fines) { setFines(res.fines); setFinesLoaded(true); }
    else toast.error('Ошибка загрузки штрафов');
    setLoading(false);
  }

  async function payFine(fine: Fine) {
    const res = await api.pay('fine', fine.id, fine.amount);
    if (res.payment_id) {
      toast.success('Штраф оплачен!');
      setFines(prev => prev.map(f => f.id === fine.id ? { ...f, status: 'paid' } : f));
    } else toast.error('Ошибка оплаты');
  }

  async function loadTaxes() {
    setLoading(true);
    const res = await api.getTaxes(taxInn);
    if (res.taxes) { setTaxes(res.taxes); setTaxesLoaded(true); }
    else toast.error('Ошибка загрузки налогов');
    setLoading(false);
  }

  async function payTax(tax: Tax) {
    const res = await api.pay('tax', tax.id, tax.amount);
    if (res.payment_id) {
      toast.success('Налог оплачен!');
      setTaxes(prev => prev.map(t => t.id === tax.id ? { ...t, status: 'paid' } : t));
    } else toast.error('Ошибка оплаты');
  }

  async function loadDocs() {
    setLoading(true);
    const res = await api.getDocuments();
    if (res.documents) { setDocs(res.documents); setDocsLoaded(true); }
    setLoading(false);
  }

  async function saveDoc() {
    const res = await api.addDocument({ doc_type: docType, doc_number: docNumber });
    if (res.id) {
      toast.success('Документ добавлен!');
      setAddDocMode(false);
      setDocNumber('');
      loadDocs();
    } else toast.error('Ошибка сохранения');
  }

  async function loadAppointments() {
    setLoading(true);
    const res = await api.getAppointments();
    if (res.appointments) { setAppointments(res.appointments); setAppsLoaded(true); }
    setLoading(false);
  }

  async function bookAppointment(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.createAppointment({
      service_type: 'Медицинская запись',
      doctor_name: doctor,
      appointment_date: apptDate,
      appointment_time: apptTime,
      notes: apptNotes,
    });
    if (res.id) {
      toast.success('Запись к врачу создана!');
      setApptDate('');
      setApptNotes('');
      loadAppointments();
    } else toast.error('Ошибка записи');
  }

  const services = [
    { id: 'doctor', label: 'Запись к врачу', icon: 'Stethoscope', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'fines', label: 'Проверить штрафы', icon: 'AlertTriangle', color: 'bg-red-50 text-red-700 border-red-200' },
    { id: 'taxes', label: 'Налоги', icon: 'Landmark', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'documents', label: 'Мои документы', icon: 'FolderOpen', color: 'bg-green-50 text-green-700 border-green-200' },
    { id: 'gosuslugi', label: 'Госуслуги', icon: 'Globe', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  ];

  if (section === 'main') {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Страна Югания</h2>
          <p className="text-sm text-muted-foreground">Государственные услуги для граждан</p>
        </div>

        {/* Госуслуги карточки */}
        <div className="grid grid-cols-2 gap-3">
          {services.map(s => (
            <button
              key={s.id}
              onClick={() => {
                setSection(s.id as Section);
                if (s.id === 'documents' && !docsLoaded) loadDocs();
                if (s.id === 'doctor' && !appsLoaded) loadAppointments();
              }}
              className={`service-card flex flex-col items-center gap-3 p-5 rounded-2xl border-2 ${s.color} hover:shadow-md`}
            >
              <Icon name={s.icon} size={32} />
              <span className="text-sm font-semibold text-center leading-tight">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Статус Госуслуг */}
        {user.gosuslugi_linked ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏛️</span>
              <div className="flex-1">
                <p className="font-semibold text-blue-900 text-sm">Госуслуги подключены</p>
                <p className="text-xs text-blue-600">Документы синхронизированы · Все сервисы доступны</p>
              </div>
              <Icon name="CheckCircle" size={20} className="text-green-500" />
            </div>
          </div>
        ) : (
          <button onClick={() => setSection('gosuslugi')}
            className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border-2 border-dashed border-blue-300 text-left hover:border-blue-500 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏛️</span>
              <div className="flex-1">
                <p className="font-semibold text-blue-900 text-sm">Подключить Госуслуги</p>
                <p className="text-xs text-blue-600">Автоимпорт документов, льготы, субсидии</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-blue-400" />
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSection('main')} className="p-2">
          <Icon name="ArrowLeft" size={20} />
        </Button>
        <div>
          <h2 className="text-xl font-bold">
            {section === 'doctor' && 'Запись к врачу'}
            {section === 'fines' && 'Проверка штрафов'}
            {section === 'taxes' && 'Налоги'}
            {section === 'documents' && 'Мои документы'}
            {section === 'gosuslugi' && 'Госуслуги'}
          </h2>
        </div>
      </div>

      {/* Штрафы */}
      {section === 'fines' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="space-y-1.5">
              <Label>ИНН</Label>
              <Input placeholder="Введите ИНН" value={fineInn} onChange={e => setFineInn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Гос. номер автомобиля</Label>
              <Input placeholder="А000АА 000" value={carNumber} onChange={e => setCarNumber(e.target.value)} />
            </div>
            <Button onClick={loadFines} disabled={loading} className="w-full">
              {loading ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
              Проверить штрафы
            </Button>
          </div>

          {finesLoaded && (
            fines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="CheckCircle" size={40} className="mx-auto mb-2 text-green-500" />
                <p className="font-medium">Штрафов не найдено!</p>
              </div>
            ) : (
              fines.map(f => (
                <div key={f.id} className="bg-white rounded-2xl border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-foreground">{f.description || 'Административный штраф'}</p>
                      {f.car_number && <p className="text-xs text-muted-foreground">Авто: {f.car_number}</p>}
                    </div>
                    <StatusBadge status={f.status} />
                  </div>
                  <p className="text-xl font-bold text-red-600">{f.amount.toLocaleString()} ₽</p>
                  {f.status === 'unpaid' && (
                    <Button size="sm" className="mt-3 w-full" onClick={() => payFine(f)}>
                      <Icon name="CreditCard" size={15} className="mr-1.5" />
                      Оплатить онлайн
                    </Button>
                  )}
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Налоги */}
      {section === 'taxes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="space-y-1.5">
              <Label>ИНН</Label>
              <Input placeholder="Введите ИНН" value={taxInn} onChange={e => setTaxInn(e.target.value)} />
            </div>
            <Button onClick={loadTaxes} disabled={loading} className="w-full">
              {loading ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
              Проверить налоги
            </Button>
          </div>

          {taxesLoaded && (
            taxes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Icon name="CheckCircle" size={40} className="mx-auto mb-2 text-green-500" />
                <p className="font-medium">Задолженностей не найдено!</p>
              </div>
            ) : (
              taxes.map(t => (
                <div key={t.id} className="bg-white rounded-2xl border p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{t.tax_type}</p>
                      {t.period && <p className="text-xs text-muted-foreground">Период: {t.period}</p>}
                      {t.due_date && <p className="text-xs text-muted-foreground">До: {t.due_date}</p>}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-xl font-bold text-amber-600">{t.amount.toLocaleString()} ₽</p>
                  {t.status === 'unpaid' && (
                    <Button size="sm" className="mt-3 w-full" onClick={() => payTax(t)}>
                      <Icon name="CreditCard" size={15} className="mr-1.5" />
                      Оплатить онлайн
                    </Button>
                  )}
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Документы */}
      {section === 'documents' && (
        <div className="space-y-4">
          <Button onClick={() => setAddDocMode(!addDocMode)} variant={addDocMode ? 'outline' : 'default'} className="w-full">
            <Icon name={addDocMode ? 'X' : 'Plus'} size={16} className="mr-2" />
            {addDocMode ? 'Отмена' : 'Добавить документ'}
          </Button>

          {addDocMode && (
            <div className="bg-white rounded-2xl border p-4 space-y-3">
              <div className="space-y-1.5">
                <Label>Тип документа</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DOC_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      onClick={() => setDocType(dt.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${docType === dt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                    >
                      <Icon name={dt.icon} size={16} />
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Номер документа</Label>
                <Input placeholder="Серия и номер" value={docNumber} onChange={e => setDocNumber(e.target.value)} />
              </div>
              <Button onClick={saveDoc} className="w-full">Сохранить документ</Button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Icon name="Loader2" size={28} className="animate-spin text-primary" /></div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Icon name="FolderOpen" size={44} className="mx-auto mb-2 opacity-30" />
              <p>Документов нет</p>
            </div>
          ) : (
            docs.map(d => {
              const dt = DOC_TYPES.find(x => x.value === d.doc_type);
              return (
                <div key={d.id} className="bg-white rounded-2xl border p-4 flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon name={dt?.icon || 'File'} size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{dt?.label || d.doc_type}</p>
                    {d.doc_number && <p className="text-sm text-muted-foreground">№ {d.doc_number}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Запись к врачу */}
      {section === 'doctor' && (
        <div className="space-y-4">
          <form onSubmit={bookAppointment} className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Специалист</Label>
              <div className="grid grid-cols-2 gap-2">
                {DOCTORS.map(d => (
                  <button type="button" key={d}
                    onClick={() => setDoctor(d)}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${doctor === d ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                  >{d}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Дата приёма</Label>
              <Input type="date" value={apptDate} onChange={e => setApptDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="space-y-1.5">
              <Label>Время</Label>
              <div className="grid grid-cols-4 gap-2">
                {TIMES.map(t => (
                  <button type="button" key={t}
                    onClick={() => setApptTime(t)}
                    className={`py-2 rounded-xl border-2 text-sm font-medium transition-colors ${apptTime === t ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Примечание (необязательно)</Label>
              <Input placeholder="Причина обращения..." value={apptNotes} onChange={e => setApptNotes(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">
              <Icon name="CalendarCheck" size={16} className="mr-2" />
              Записаться
            </Button>
          </form>

          {appsLoaded && appointments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Мои записи</h3>
              {appointments.map(a => (
                <div key={a.id} className="bg-white rounded-2xl border p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{a.doctor_name}</p>
                      <p className="text-sm text-muted-foreground">{new Date(a.appointment_date).toLocaleDateString('ru-RU')} в {a.appointment_time}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Госуслуги */}
      {section === 'gosuslugi' && (
        <div className="space-y-4">
          {/* Статус подключения */}
          {user.gosuslugi_linked ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Icon name="CheckCircle" size={22} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-900 text-sm">Аккаунт синхронизирован</p>
                <p className="text-green-700 text-xs">Данные из Госуслуг загружены и актуальны</p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏛️</span>
                <div>
                  <p className="font-semibold text-blue-900 text-sm">Госуслуги не подключены</p>
                  <p className="text-blue-700 text-xs mb-2">Подключите для автозаполнения документов и доступа ко всем сервисам</p>
                  <p className="text-blue-600 text-xs">→ Перейдите в раздел «Профиль» для подключения</p>
                </div>
              </div>
            </div>
          )}

          {/* Список сервисов */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/40">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Доступные сервисы</p>
            </div>
            <div className="divide-y">
              {[
                { label: 'Регистрация актов гражданского состояния', icon: 'FileCheck', available: true },
                { label: 'Загранпаспорт', icon: 'Plane', available: true },
                { label: 'Льготы и субсидии', icon: 'HandHeart', available: user.gosuslugi_linked },
                { label: 'Пенсионное страхование', icon: 'PiggyBank', available: user.gosuslugi_linked },
                { label: 'Постановка на учёт ТС', icon: 'Car', available: true },
                { label: 'Сведения о недвижимости', icon: 'Home', available: user.gosuslugi_linked },
                { label: 'Налоговые вычеты', icon: 'Receipt', available: user.gosuslugi_linked },
                { label: 'Социальные выплаты', icon: 'Banknote', available: user.gosuslugi_linked },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-3 px-4 py-3 transition-colors ${s.available ? 'hover:bg-muted/40 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                  <Icon name={s.icon} size={18} className={s.available ? 'text-blue-600' : 'text-muted-foreground'} />
                  <span className="text-sm font-medium flex-1">{s.label}</span>
                  {s.available
                    ? <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                    : <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Нужны Госуслуги</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Документы из Госуслуг */}
          {user.gosuslugi_linked && user.gosuslugi_data && (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Импортированные документы</p>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { label: 'Паспорт гражданина Югании', icon: 'BookOpen', color: 'text-primary' },
                  { label: 'СНИЛС', icon: 'CreditCard', color: 'text-green-600' },
                  { label: 'ИНН', icon: 'Hash', color: 'text-amber-600' },
                  { label: 'Полис ОМС', icon: 'Stethoscope', color: 'text-red-500' },
                ].map(d => (
                  <div key={d.label} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                    <Icon name={d.icon} size={18} className={d.color} />
                    <span className="text-sm font-medium">{d.label}</span>
                    <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Загружен</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-muted rounded-xl p-3 flex items-center gap-2.5">
            <Icon name="ShieldCheck" size={18} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Данные защищены по стандартам ГОСТ Р 57580. Передача по зашифрованному каналу.</p>
          </div>
        </div>
      )}
    </div>
  );
}