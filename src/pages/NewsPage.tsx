import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { User } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  is_official: boolean;
  likes: number;
  created_at: string;
  author_name: string;
  author_avatar?: string;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  author_name: string;
}

interface NewsPageProps {
  user: User;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} д. назад`;
}

export default function NewsPage({ user }: NewsPageProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentText, setCommentText] = useState('');
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadNews();
  }, []);

  async function loadNews() {
    setLoading(true);
    const res = await api.getNews();
    if (res.news) setNews(res.news);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setCreating(true);
    const res = await api.createNews(title, content);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Новость опубликована!');
      setTitle('');
      setContent('');
      setShowCreate(false);
      loadNews();
    }
    setCreating(false);
  }

  async function handleLike(id: number) {
    if (likedIds.has(id)) return;
    const res = await api.likeNews(id);
    if (res.likes !== undefined) {
      setNews(prev => prev.map(n => n.id === id ? { ...n, likes: res.likes } : n));
      setLikedIds(prev => new Set([...prev, id]));
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!comments[id]) {
      const res = await api.getComments(id);
      if (res.comments) setComments(prev => ({ ...prev, [id]: res.comments }));
    }
  }

  async function handleComment(newsId: number) {
    if (!commentText.trim()) return;
    const res = await api.addComment(newsId, commentText);
    if (res.id) {
      setComments(prev => ({
        ...prev,
        [newsId]: [...(prev[newsId] || []), { id: res.id, content: commentText, created_at: new Date().toISOString(), author_name: `${user.first_name} ${user.last_name}` }]
      }));
      setCommentText('');
    }
  }

  return (
    <div className="space-y-4">
      {/* Заголовок + кнопка */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Новости Югании</h2>
          <p className="text-sm text-muted-foreground">Актуальные события страны</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-full w-10 h-10 p-0"
        >
          <Icon name={showCreate ? 'X' : 'Plus'} size={20} />
        </Button>
      </div>

      {/* Форма создания новости */}
      {showCreate && (
        <div className="bg-white rounded-2xl shadow-md border border-border p-5">
          <h3 className="font-semibold mb-3 text-foreground">Опубликовать новость</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              placeholder="Заголовок новости"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <Textarea
              placeholder="Текст новости..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={4}
              required
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={creating} className="flex-1">
                {creating ? <Icon name="Loader2" size={16} className="animate-spin mr-1" /> : null}
                Опубликовать
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Список новостей */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Icon name="Loader2" size={32} className="animate-spin text-primary" />
        </div>
      ) : news.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="Newspaper" size={48} className="mx-auto mb-3 opacity-30" />
          <p>Новостей пока нет</p>
          <p className="text-sm">Будьте первым, кто опубликует новость!</p>
        </div>
      ) : (
        news.map(item => (
          <div key={item.id} className="news-card bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Официальная метка */}
            {item.is_official && (
              <div className="yugaru-badge-official px-4 py-1.5 flex items-center gap-1.5">
                <Icon name="BadgeCheck" size={14} className="text-white" />
                <span className="text-white text-xs font-semibold tracking-wide">ОФИЦИАЛЬНОЕ СООБЩЕНИЕ</span>
              </div>
            )}

            <div className="p-4">
              {/* Автор */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.author_avatar ? (
                    <img src={item.author_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-bold">{item.author_name[0]}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.author_name}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</p>
                </div>
              </div>

              {/* Контент */}
              <h3 className="font-bold text-foreground mb-1.5">{item.title}</h3>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.content}</p>

              {/* Действия */}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => handleLike(item.id)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${likedIds.has(item.id) ? 'text-red-500' : 'text-muted-foreground hover:text-red-400'}`}
                >
                  <Icon name="Heart" size={17} />
                  <span>{item.likes}</span>
                </button>
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Icon name="MessageCircle" size={17} />
                  <span>Комментировать</span>
                </button>
              </div>

              {/* Комментарии */}
              {expandedId === item.id && (
                <div className="mt-3 space-y-3">
                  {(comments[item.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Комментариев пока нет</p>
                  )}
                  {(comments[item.id] || []).map(c => (
                    <div key={c.id} className="bg-muted rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-primary">{c.author_name}: </span>
                      <span className="text-sm text-foreground">{c.content}</span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ваш комментарий..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      className="text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleComment(item.id)}
                    />
                    <Button size="sm" onClick={() => handleComment(item.id)}>
                      <Icon name="Send" size={15} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
