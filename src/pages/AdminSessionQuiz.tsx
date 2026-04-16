import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session, SessionQuestion } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Trash2, Save, X, ChevronLeft, HelpCircle, CheckCircle2, List } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function AdminSessionQuiz() {
  const { sessionId } = useParams();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    text: '',
    textAr: '',
    options: ['', '', '', ''],
    optionsAr: ['', '', '', ''],
    correctOptionIndex: 0
  });

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      fetchQuestions();
    }
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const docRef = doc(db, 'sessions', sessionId!);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSession({ id: docSnap.id, ...docSnap.data() } as Session);
      }
    } catch (error) {
       handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
    }
  };

  const fetchQuestions = async () => {
    try {
      const q = query(
        collection(db, 'sessionQuestions'), 
        where('sessionId', '==', sessionId),
        orderBy('order', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionQuestion));
      setQuestions(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sessionQuestions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newQuestion = {
        ...formData,
        sessionId,
        order: questions.length + 1
      };
      await addDoc(collection(db, 'sessionQuestions'), newQuestion);
      toast.success(language === 'ar' ? 'تمت إضافة السؤال' : 'Question added');
      setFormData({
        text: '', textAr: '', 
        options: ['', '', '', ''], optionsAr: ['', '', '', ''], 
        correctOptionIndex: 0
      });
      setIsAdding(false);
      fetchQuestions();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessionQuestions');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sessionQuestions', id));
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted');
      setDeletingId(null);
      fetchQuestions();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessionQuestions/${id}`);
    }
  };

  if (loading) return <div className="flex justify-center p-20 animate-pulse text-primary"><HelpCircle size={48} className="animate-spin" /></div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex items-center gap-6">
        <button 
          onClick={() => navigate('/admin/sessions')}
          className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-all text-primary"
        >
          <ChevronLeft size={24} className={cn(language === 'ar' && "rotate-180")} />
        </button>
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tighter">
            {language === 'ar' ? `اختبار: ${session?.titleAr}` : `Quiz: ${session?.title}`}
          </h2>
          <p className="text-on-surface-variant font-medium">
            {language === 'ar' ? 'إدارة أسئلة الاختيار من متعدد لهذا السيشن.' : 'Manage multiple choice questions for this session.'}
          </p>
        </div>
        {!isAdding && (
            <button 
                onClick={() => setIsAdding(true)}
                className="ml-auto flex items-center gap-2 bg-primary text-white p-4 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-105 transition-all"
            >
                <Plus size={24} />
                <span className="hidden sm:inline">{language === 'ar' ? 'سؤال جديد' : 'New Question'}</span>
            </button>
        )}
      </header>

      {isAdding && (
        <div className="bg-surface-container-lowest p-8 rounded-3xl hive-shadow animate-in zoom-in-95 duration-300 border-t-8 border-primary">
          <form onSubmit={handleAddQuestion} className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-xs font-black text-secondary uppercase tracking-widest">Question Text (EN)</label>
                <textarea 
                  required
                  className="w-full bg-surface-container-high p-5 rounded-2xl border-none focus:ring-4 focus:ring-primary/20 font-bold h-32 resize-none"
                  value={formData.text}
                  onChange={e => setFormData({...formData, text: e.target.value})}
                />
              </div>
              <div className="space-y-4 text-right">
                <label className="text-xs font-black text-secondary uppercase tracking-widest">السؤال (عربي)</label>
                <textarea 
                  required
                  dir="rtl"
                  className="w-full bg-surface-container-high p-5 rounded-2xl border-none focus:ring-4 focus:ring-primary/20 font-bold h-32 resize-none"
                  value={formData.textAr}
                  onChange={e => setFormData({...formData, textAr: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-black text-primary uppercase border-b border-outline-variant/10 pb-2">
                {language === 'ar' ? 'الخيارات (حدد الجواب الصحيح)' : 'Options (Mark correct answer)'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formData.options.map((option, idx) => (
                  <div key={idx} className={cn(
                    "p-6 rounded-3xl transition-all border-2",
                    formData.correctOptionIndex === idx ? "bg-primary/5 border-primary shadow-lg" : "bg-surface-container-high border-transparent"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <input 
                                type="radio" 
                                name="correct"
                                checked={formData.correctOptionIndex === idx}
                                onChange={() => setFormData({...formData, correctOptionIndex: idx})}
                                className="w-5 h-5 text-primary focus:ring-primary"
                            />
                            <span className="font-black text-xs text-secondary uppercase tracking-widest">Option {idx + 1}</span>
                        </div>
                        {formData.correctOptionIndex === idx && (
                            <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase">Correct</span>
                        )}
                    </div>
                    <div className="space-y-4">
                        <input 
                          required
                          placeholder="English option..."
                          className="w-full bg-white/50 p-3 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-bold"
                          value={formData.options[idx]}
                          onChange={e => {
                            const newOps = [...formData.options];
                            newOps[idx] = e.target.value;
                            setFormData({...formData, options: newOps});
                          }}
                        />
                        <input 
                          required
                          dir="rtl"
                          placeholder="الخيار بالعربي..."
                          className="w-full bg-white/50 p-3 rounded-xl border-none focus:ring-2 focus:ring-primary text-sm font-bold"
                          value={formData.optionsAr[idx]}
                          onChange={e => {
                            const newOpsAr = [...formData.optionsAr];
                            newOpsAr[idx] = e.target.value;
                            setFormData({...formData, optionsAr: newOpsAr});
                          }}
                        />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                {t('admin.cancel')}
              </button>
              <button 
                type="submit"
                className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-primary/20"
              >
                {language === 'ar' ? 'حفظ السؤال' : 'Save Question'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-surface-container-lowest p-8 rounded-[32px] hive-shadow group border border-outline-variant/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 flex items-center justify-center font-black text-primary text-2xl rounded-bl-[32px]">
                {idx + 1}
            </div>
            <div className="flex items-start justify-between gap-10">
              <div className="flex-1 space-y-8">
                <div className="flex flex-col lg:flex-row gap-10">
                   <div className="flex-1">
                      <h4 className="text-lg font-black text-primary mb-2 line-clamp-2">{q.text}</h4>
                      <p className="text-on-surface-variant font-medium text-right text-lg mb-4" dir="rtl">{q.textAr}</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                   {q.options.map((opt, i) => (
                     <div key={i} className={cn(
                       "p-4 rounded-2xl flex flex-col gap-1",
                       q.correctOptionIndex === i ? "bg-primary/10 ring-2 ring-primary" : "bg-surface-container-low"
                     )}>
                        <span className="text-[10px] uppercase font-black opacity-40">{language === 'ar' ? 'الخيار' : 'Option'} {i + 1}</span>
                        <div className="font-bold text-sm truncate">{opt}</div>
                        <div className="font-bold text-sm truncate opacity-60 text-right" dir="rtl">{q.optionsAr[i]}</div>
                     </div>
                   ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                 {deletingId === q.id ? (
                   <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                     <button 
                       onClick={() => handleDeleteQuestion(q.id)}
                       className="bg-error text-white px-3 py-2 rounded-xl font-bold hover:brightness-110 flex items-center gap-2 text-xs"
                     >
                       <Trash2 size={14} />
                       {language === 'ar' ? 'تأكيد' : 'Confirm'}
                     </button>
                     <button 
                       onClick={() => setDeletingId(null)}
                       className="p-1.5 bg-surface-container-high text-on-surface-variant hover:bg-outline/10 rounded-xl transition-all"
                     >
                       <X size={16} />
                     </button>
                   </div>
                 ) : (
                   <button 
                     onClick={() => setDeletingId(q.id)}
                     className="p-3 bg-error/5 text-error/30 hover:text-error hover:bg-error/10 rounded-2xl transition-all"
                   >
                     <Trash2 size={24} />
                   </button>
                 )}
              </div>
            </div>
          </div>
        ))}

        {questions.length === 0 && !loading && (
          <div className="py-40 text-center bg-surface-container-low rounded-[40px] border-4 border-dashed border-outline-variant/20">
            <List size={64} className="mx-auto text-outline-variant/30 mb-6" />
            <h3 className="text-2xl font-black text-on-surface-variant uppercase tracking-tighter">No Questions</h3>
            <p className="text-on-surface-variant/50 font-bold mt-2">Start adding multiple choice questions for this session.</p>
          </div>
        )}
      </div>
    </div>
  );
}
