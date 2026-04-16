import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Trash2, Edit2, Save, X, Video, Calendar, Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function AdminSessions() {
  const { t, language } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    titleAr: '',
    description: '',
    descriptionAr: '',
    date: '',
    link: '',
    type: 'live' as const,
    active: true
  });

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const q = query(collection(db, 'sessions'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSession = {
        ...formData,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'sessions'), newSession);
      toast.success(language === 'ar' ? 'تمت إضافة السيشن بنجاح' : 'Session added successfully');
      setFormData({ title: '', titleAr: '', description: '', descriptionAr: '', date: '', link: '', type: 'live', active: true });
      setIsAdding(false);
      fetchSessions();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessions');
    }
  };

  const handleUpdateSession = async (id: string, updates: Partial<Session>) => {
    try {
      await updateDoc(doc(db, 'sessions', id), updates);
      toast.success(language === 'ar' ? 'تم التحديث بنجاح' : 'Updated successfully');
      setEditingId(null);
      fetchSessions();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${id}`);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    try {
      await deleteDoc(doc(db, 'sessions', id));
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
      fetchSessions();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${id}`);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-primary">{language === 'ar' ? 'إدارة السيشنات' : 'Sessions Management'}</h2>
          <p className="text-on-surface-variant">{language === 'ar' ? 'أضف وتحكم في السيشنات المباشرة والمسجلة' : 'Add and manage live and recorded sessions'}</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:brightness-110 transition-all"
        >
          <Plus size={20} />
          {language === 'ar' ? 'إضافة سيشن' : 'Add Session'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface-container-lowest p-8 rounded-2xl hive-shadow animate-in slide-in-from-top duration-300">
          <form onSubmit={handleAddSession} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary">Title (EN)</label>
                <input 
                  required
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="space-y-2 text-right">
                <label className="text-sm font-bold text-secondary">العنوان (عربي)</label>
                <input 
                  required
                  dir="rtl"
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary"
                  value={formData.titleAr}
                  onChange={e => setFormData({...formData, titleAr: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary">Description (EN)</label>
                <textarea 
                  required
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary h-32"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="space-y-2 text-right">
                <label className="text-sm font-bold text-secondary">الوصف (عربي)</label>
                <textarea 
                  required
                  dir="rtl"
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary h-32"
                  value={formData.descriptionAr}
                  onChange={e => setFormData({...formData, descriptionAr: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary">Date & Time</label>
                <input 
                  type="datetime-local"
                  required
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary">Meeting/Recording Link</label>
                <input 
                  type="url"
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary"
                  value={formData.link}
                  onChange={e => setFormData({...formData, link: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-secondary">Session Type</label>
                <select 
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="live">Live Stream</option>
                  <option value="recorded">Recorded</option>
                  <option value="workshop">Workshop</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                {t('admin.cancel')}
              </button>
              <button 
                type="submit"
                className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:brightness-110 transition-all"
              >
                {t('admin.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-surface-container-lowest p-6 rounded-2xl hive-shadow flex items-center justify-between gap-6 border-l-4 border-primary">
            <div className="flex items-center gap-6 flex-1">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                session.type === 'live' ? "bg-error/10 text-error" : 
                session.type === 'recorded' ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
              )}>
                <Video size={24} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-lg text-primary truncate">
                  {language === 'ar' ? session.titleAr : session.title}
                </h4>
                <div className="flex items-center gap-4 mt-1 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    {new Date(session.date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </div>
                  <div className="px-2 py-0.5 rounded bg-surface-container-high text-[10px] font-bold uppercase tracking-wider">
                    {session.type}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleUpdateSession(session.id, { active: !session.active })}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  session.active ? "text-primary hover:bg-primary/10" : "text-outline hover:bg-surface-container-high"
                )}
                title={session.active ? 'Active' : 'Hidden'}
              >
                <CheckCircle2 size={20} className={cn(session.active && "fill-current opacity-20")} />
              </button>
              <button 
                onClick={() => handleDeleteSession(session.id)}
                className="p-2 text-on-surface-variant/40 hover:text-error transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}

        {sessions.length === 0 && !loading && (
          <div className="p-20 text-center bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30">
            <Video size={48} className="mx-auto text-outline-variant/30 mb-4" />
            <p className="text-on-surface-variant font-medium">No sessions found. Create your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={cn("animate-spin", className)} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
