import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Trash2, Edit2, Save, X, Video, Calendar, Link as LinkIcon, CheckCircle2, AlertCircle, Clock, ClipboardCheck, Loader2, Download, FileSpreadsheet, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

export default function AdminSessions() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    titleAr: '',
    description: '',
    descriptionAr: '',
    date: '',
    durationMinutes: 60,
    endTime: '',
    link: '',
    type: 'live' as const,
    active: true,
    hasQuiz: false
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
      if (editingSession) {
        await updateDoc(doc(db, 'sessions', editingSession.id), formData);
        toast.success(language === 'ar' ? 'تم تحديث السيشن بنجاح' : 'Session updated successfully');
      } else {
        const newSession = {
          ...formData,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'sessions'), newSession);
        toast.success(language === 'ar' ? 'تمت إضافة السيشن بنجاح' : 'Session added successfully');
      }
      resetForm();
      fetchSessions();
    } catch (error) {
      handleFirestoreError(error, editingSession ? OperationType.UPDATE : OperationType.CREATE, 'sessions');
    }
  };

  const resetForm = () => {
    setFormData({ 
      title: '', titleAr: '', description: '', descriptionAr: '', 
      date: '', durationMinutes: 60, endTime: '', link: '', type: 'live', active: true, hasQuiz: false 
    });
    setIsAdding(false);
    setEditingSession(null);
  };

  const handleEdit = (session: Session) => {
    setFormData({
      title: session.title,
      titleAr: session.titleAr,
      description: session.description,
      descriptionAr: session.descriptionAr,
      date: session.date,
      durationMinutes: session.durationMinutes || 60,
      endTime: session.endTime || '',
      link: session.link || '',
      type: session.type,
      active: session.active,
      hasQuiz: session.hasQuiz || false
    });
    setEditingSession(session);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateSession = async (id: string, updates: Partial<Session>) => {
    try {
      await updateDoc(doc(db, 'sessions', id), updates);
      toast.success(language === 'ar' ? 'تم التحديث بنجاح' : 'Updated successfully');
      fetchSessions();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${id}`);
    }
  };

  const handleExportResults = async (session: Session) => {
    try {
      const toastId = toast.loading(language === 'ar' ? 'جاري تجهيز البيانات...' : 'Preparing data...');
      
      const resultsRef = collection(db, 'sessionQuizResults');
      const qResults = query(resultsRef, where('sessionId', '==', session.id));
      const resultsSnap = await getDocs(qResults);
      
      if (resultsSnap.empty) {
        toast.dismiss(toastId);
        toast.error(language === 'ar' ? 'لا توجد نتائج لهذا السيشن' : 'No results found for this session');
        return;
      }

      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap = new Map();
      usersSnap.docs.forEach(doc => {
        usersMap.set(doc.id, doc.data());
      });

      const data = resultsSnap.docs.map(doc => {
        const result = doc.data();
        const user = usersMap.get(result.userId);
        return {
          [language === 'ar' ? 'أسم الجلسة' : 'Session Name']: language === 'ar' ? session.titleAr : session.title,
          [language === 'ar' ? 'الأسم' : 'Name']: user?.name || 'Unknown',
          [language === 'ar' ? 'الأيميل' : 'Email']: user?.email || 'N/A',
          [language === 'ar' ? 'الدرجة' : 'Score']: result.score,
          [language === 'ar' ? 'إجمالي الأسئلة' : 'Total Questions']: result.totalQuestions,
          [language === 'ar' ? 'تاريخ الإكمال' : 'Completed At']: new Date(result.completedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");

      XLSX.writeFile(wb, `${session.title}_Results.xlsx`);
      
      toast.dismiss(toastId);
      toast.success(language === 'ar' ? 'تم تحميل الملف بنجاح' : 'File downloaded successfully');
    } catch (error) {
      console.error('Error exporting results:', error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء تحميل الملف' : 'Error downloading file');
    }
  };

  const handleExportFeedback = async (session: Session) => {
    try {
      const toastId = toast.loading(language === 'ar' ? 'جاري تجهيز تقييمات الطلاب...' : 'Preparing student feedback...');
      
      const feedbackRef = collection(db, 'sessionFeedbacks');
      const qFeedback = query(feedbackRef, where('sessionId', '==', session.id));
      const feedbackSnap = await getDocs(qFeedback);
      
      if (feedbackSnap.empty) {
        toast.dismiss(toastId);
        toast.error(language === 'ar' ? 'لا توجد تقييمات لهذا السيشن' : 'No feedback found for this session');
        return;
      }

      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap = new Map();
      usersSnap.docs.forEach(doc => {
        usersMap.set(doc.id, doc.data());
      });

      const data = feedbackSnap.docs.map(doc => {
        const feedback = doc.data();
        const user = usersMap.get(feedback.userId);
        return {
          [language === 'ar' ? 'أسم الجلسة' : 'Session Name']: language === 'ar' ? session.titleAr : session.title,
          [language === 'ar' ? 'الأسم' : 'Name']: user?.name || 'Unknown',
          [language === 'ar' ? 'الأيميل' : 'Email']: user?.email || 'N/A',
          [language === 'ar' ? 'التقييم العام' : 'Overall']: feedback.overallRating,
          [language === 'ar' ? 'الموضوع' : 'Topic']: feedback.topicRating,
          [language === 'ar' ? 'المحاضر' : 'Instructor']: feedback.instructorRating,
          [language === 'ar' ? 'الاستفادة' : 'Benefit']: feedback.benefitRating,
          [language === 'ar' ? 'التعليق' : 'Comment']: feedback.comment || '',
          [language === 'ar' ? 'التاريخ' : 'Date']: new Date(feedback.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Feedback");

      XLSX.writeFile(wb, `${session.title}_Feedback.xlsx`);
      
      toast.dismiss(toastId);
      toast.success(language === 'ar' ? 'تم تحميل ملف التقييمات بنجاح' : 'Feedback file downloaded successfully');
    } catch (error) {
      console.error('Error exporting feedback:', error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء تحميل التقييمات' : 'Error downloading feedback');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', id));
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
      setDeletingId(null);
      fetchSessions();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${id}`);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-primary">{language === 'ar' ? 'إدارة السيشنات' : 'Sessions Management'}</h2>
          <p className="text-on-surface-variant">{language === 'ar' ? 'أضف وتحكم في السيشنات المباشرة والمسجلة' : 'Add and manage live and recorded sessions'}</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            {language === 'ar' ? 'إضافة سيشن' : 'Add Session'}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-surface-container-lowest p-8 rounded-2xl hive-shadow animate-in slide-in-from-top duration-300 border border-primary/10">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-outline-variant/10">
            <h3 className="text-xl font-black text-primary uppercase tracking-tighter">
              {editingSession 
                ? (language === 'ar' ? 'تعديل السيشن' : 'Edit Session')
                : (language === 'ar' ? 'إضافة سيشن جديد' : 'New Session')
              }
            </h3>
            <button onClick={resetForm} className="p-2 hover:bg-surface-container-high rounded-full transition-all">
              <X size={24} className="text-on-surface-variant" />
            </button>
          </div>

          <form onSubmit={handleAddSession} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Title (EN)</label>
                <input 
                  required
                  placeholder="e.g. Introduction to Figma"
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="space-y-3 text-right">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">العنوان (عربي)</label>
                <input 
                  required
                  dir="rtl"
                  placeholder="مثال: مقدمة في فيجما"
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium"
                  value={formData.titleAr}
                  onChange={e => setFormData({...formData, titleAr: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Description (EN)</label>
                <textarea 
                  required
                  placeholder="Detailed description..."
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary h-40 font-medium resize-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="space-y-3 text-right">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">الوصف (عربي)</label>
                <textarea 
                  required
                  dir="rtl"
                  placeholder="وصف تفصيلي..."
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary h-40 font-medium resize-none"
                  value={formData.descriptionAr}
                  onChange={e => setFormData({...formData, descriptionAr: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1 space-y-3">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Date & Time</label>
                <input 
                  type="datetime-local"
                  required
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="md:col-span-1 space-y-3">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">{language === 'ar' ? 'وقت الانتهاء' : 'Finish Time'}</label>
                <input 
                  type="datetime-local"
                  required
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium"
                  value={formData.endTime}
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                />
              </div>
              <div className="md:col-span-1 space-y-3">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Type</label>
                <select 
                  className="w-full bg-surface-container-high p-4 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="live">Live Stream</option>
                  <option value="recorded">Recorded</option>
                  <option value="workshop">Workshop</option>
                </select>
              </div>
              <div className="md:col-span-1 space-y-3">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Has Quiz?</label>
                <div className="flex items-center h-[56px] px-4 bg-surface-container-high rounded-xl">
                    <input 
                        type="checkbox"
                        id="hasQuiz"
                        className="w-5 h-5 text-primary border-none rounded focus:ring-primary"
                        checked={formData.hasQuiz}
                        onChange={e => setFormData({...formData, hasQuiz: e.target.checked})}
                    />
                    <label htmlFor="hasQuiz" className="ml-3 font-bold text-on-surface-variant cursor-pointer select-none">
                        {language === 'ar' ? 'تفعيل اختبار' : 'Enable Quiz'}
                    </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-secondary uppercase tracking-[0.2em]">Meeting / Playback Link</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant" size={20} />
                <input 
                  type="url"
                  placeholder="https://zoom.it/meeting-id"
                  className="w-full bg-surface-container-high p-4 pl-12 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium"
                  value={formData.link}
                  onChange={e => setFormData({...formData, link: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button 
                type="button"
                onClick={resetForm}
                className="px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                {t('admin.cancel')}
              </button>
              <button 
                type="submit"
                className="bg-primary text-white px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                {editingSession ? (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes') : (language === 'ar' ? 'إضافة الآن' : 'Add Now')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {sessions.map(session => (
          <div key={session.id} className="bg-surface-container-lowest p-8 rounded-3xl hive-shadow flex flex-col md:flex-row items-center justify-between gap-8 border border-outline-variant/10 group hover:ring-2 ring-primary/5 transition-all">
            <div className="flex items-center gap-6 flex-1 w-full">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner",
                session.type === 'live' ? "bg-error/10 text-error" : 
                session.type === 'recorded' ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"
              )}>
                <Video size={32} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-black text-xl text-primary truncate tracking-tight">
                        {language === 'ar' ? session.titleAr : session.title}
                    </h4>
                    {session.hasQuiz && (
                        <div className="flex items-center gap-1 bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
                            <ClipboardCheck size={12} />
                            {language === 'ar' ? 'اختبار' : 'Quiz'}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-on-surface-variant/70">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    {new Date(session.date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    {session.durationMinutes} {language === 'ar' ? 'دقيقة' : 'Min'}
                  </div>
                  <div className="px-3 py-1 rounded bg-surface-container-high text-[10px] font-black uppercase tracking-[0.1em] text-primary">
                    {session.type}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-outline-variant/10">
              {session.hasQuiz && (
                <>
                  <button 
                    onClick={() => handleExportResults(session)}
                    className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold hover:bg-primary/20 transition-all text-sm"
                    title={language === 'ar' ? 'تحميل درجات الطلاب' : 'Download Student Scores'}
                  >
                    <Download size={18} />
                    <span className="md:hidden lg:inline">{language === 'ar' ? 'الدرجات' : 'Scores'}</span>
                  </button>
                  <button 
                    onClick={() => handleExportFeedback(session)}
                    className="flex items-center gap-2 bg-yellow-500/10 text-yellow-600 px-4 py-2 rounded-xl font-bold hover:bg-yellow-500/20 transition-all text-sm"
                    title={language === 'ar' ? 'تحميل تقييمات الطلاب' : 'Download Student Feedbacks'}
                  >
                    <Star size={18} />
                    <span className="md:hidden lg:inline">{language === 'ar' ? 'التقييمات' : 'Feedbacks'}</span>
                  </button>
                  <button 
                    onClick={() => navigate(`/admin/sessions/${session.id}/quiz`)}
                    className="flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-xl font-bold hover:bg-secondary/20 transition-all text-sm"
                    title="التحكم في الأسئلة"
                  >
                    <ClipboardCheck size={18} />
                    <span className="md:hidden lg:inline">{language === 'ar' ? 'إدارة الاختبار' : 'Manage Quiz'}</span>
                  </button>
                </>
              )}
              
              <button 
                onClick={() => handleUpdateSession(session.id, { active: !session.active })}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  session.active ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-outline/10 text-outline hover:bg-surface-container-high"
                )}
                title={session.active ? 'مرئي' : 'مخفي'}
              >
                <CheckCircle2 size={22} className={cn(session.active && "fill-primary/20")} />
              </button>
              <button 
                onClick={() => handleEdit(session)}
                className="p-3 bg-surface-container-high text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                title="تعديل"
              >
                <Edit2 size={22} />
              </button>
              
              {deletingId === session.id ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                  <button 
                    onClick={() => handleDeleteSession(session.id)}
                    className="bg-error text-white px-4 py-2 rounded-xl font-bold hover:brightness-110 flex items-center gap-2 text-sm"
                  >
                    <Trash2 size={16} />
                    {language === 'ar' ? 'تأكيد' : 'Confirm'}
                  </button>
                  <button 
                    onClick={() => setDeletingId(null)}
                    className="p-2 bg-surface-container-high text-on-surface-variant hover:bg-outline/10 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setDeletingId(session.id)}
                  className="p-3 bg-error/5 text-error/40 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                  title="حذف"
                >
                  <Trash2 size={22} />
                </button>
              )}
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
