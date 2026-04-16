import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Question, Traits } from '../types';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { INITIAL_QUESTIONS } from '../constants';

export default function AdminQuestions() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'primary';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'primary'
  });

  const [formData, setFormData] = useState<Partial<Question>>({
    text: '',
    textAr: '',
    trait: 'O',
    active: true,
    order: 0,
  });

  useEffect(() => {
    if (user) {
      fetchQuestions();
    }
  }, [user]);

  const fetchQuestions = async () => {
    try {
      const q = query(collection(db, 'questions'), orderBy('order', 'asc'));
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'questions');
        return;
      }
      setQuestions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (questions.length > 0) {
      setConfirmModal({
        show: true,
        title: 'Seed Questions',
        message: 'Questions already exist. Do you want to add default questions anyway?',
        type: 'primary',
        onConfirm: executeSeed
      });
    } else {
      executeSeed();
    }
  };

  const executeSeed = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      INITIAL_QUESTIONS.forEach(sq => {
        const newDocRef = doc(collection(db, 'questions'));
        batch.set(newDocRef, {
          text: sq.en,
          textAr: sq.ar,
          trait: sq.trait,
          active: true,
          order: sq.id
        });
      });
      await batch.commit();
      toast.success("Default questions seeded successfully!");
      fetchQuestions();
    } catch (error) {
      console.error("Error seeding questions:", error);
      toast.error("Failed to seed questions");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSave = async () => {
    if (!formData.text) {
      toast.error("Please fill in the question text");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'questions', editingId), formData);
        toast.success("Question updated");
      } else {
        await addDoc(collection(db, 'questions'), { ...formData, order: questions.length + 1 });
        toast.success("Question added");
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        text: '',
        textAr: '',
        trait: 'O',
        active: true,
        order: 0,
      });
      fetchQuestions();
    } catch (error) {
      toast.error("Failed to save question");
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      show: true,
      title: t('admin.deleteQuestion'),
      message: 'Are you sure you want to delete this question?',
      type: 'danger',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'questions', id));
      toast.success("Question deleted");
      fetchQuestions();
    } catch (error) {
      toast.error("Failed to delete question");
    }
  };

  const handleDeleteAll = async () => {
    setConfirmModal({
      show: true,
      title: t('admin.deleteAllQuestions'),
      message: t('admin.confirmDeleteAll'),
      type: 'danger',
      onConfirm: executeDeleteAll
    });
  };

  const executeDeleteAll = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'questions'));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.info("No questions to delete");
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);
      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      toast.success("All questions deleted successfully");
      fetchQuestions();
    } catch (error) {
      console.error("Error deleting all questions:", error);
      toast.error("Failed to delete all questions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      <section id="questions">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-primary font-bold tracking-tight text-sm mb-1 uppercase">{t('admin.knowledgeBase')}</p>
            <h2 className="text-4xl font-extrabold text-primary tracking-tighter">{t('admin.questions')}</h2>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleDeleteAll}
              disabled={loading || questions.length === 0}
              className="bg-error/10 text-error px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-error/20 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
              {t('admin.deleteAllQuestions')}
            </button>
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="bg-surface-container-low text-primary px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-surface-container-high transition-all"
            >
              <span className="material-symbols-outlined text-sm">database</span>
              {isSeeding ? 'Seeding...' : 'Seed Defaults'}
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {t('admin.addQuestion')}
            </button>
          </div>
        </div>

        {(isAdding || editingId) && (
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-primary/20 shadow-xl mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-primary tracking-tighter">{editingId ? t('admin.editQuestion') : t('admin.addQuestion')}</h3>
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">{t('admin.questionText')}</label>
                  <input
                    type="text"
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-lg font-medium transition-all"
                    placeholder="Question text (EN)..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">{t('admin.questionTextAr')}</label>
                  <input
                    type="text"
                    value={formData.textAr}
                    onChange={(e) => setFormData({ ...formData, textAr: e.target.value })}
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-lg font-medium transition-all"
                    placeholder="Question text (AR)..."
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">Trait (O, C, E, A, N)</label>
                  <select
                    value={formData.trait}
                    onChange={(e) => setFormData({ ...formData, trait: e.target.value as keyof Traits })}
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-lg font-medium transition-all"
                  >
                    <option value="O">Openness (O)</option>
                    <option value="C">Conscientiousness (C)</option>
                    <option value="E">Extraversion (E)</option>
                    <option value="A">Agreeableness (A)</option>
                    <option value="N">Neuroticism (N)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">Order</label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-lg font-medium transition-all"
                  />
                </div>
                <div className="flex items-center gap-4 pt-8">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="w-5 h-5 rounded border-none bg-surface-container-low text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-bold text-on-surface-variant">Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-10">
              <button
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="px-8 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-all"
              >
                {t('admin.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="bg-primary text-white px-10 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                {t('admin.save')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {questions.map((q) => (
            <div key={q.id} className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-widest">{t('admin.index')}: {q.order}</span>
                    <span className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-0.5 rounded uppercase tracking-widest">Trait: {q.trait}</span>
                    {!q.active && <span className="text-[10px] font-black text-error bg-error/10 px-2 py-0.5 rounded uppercase tracking-widest">{t('admin.inactive')}</span>}
                  </div>
                  <h4 className="text-xl font-bold text-primary tracking-tight leading-tight">
                    {language === 'ar' ? (q.textAr || q.text) : q.text}
                  </h4>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => { setEditingId(q.id); setFormData(q); }}
                    className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest p-8 rounded-3xl max-w-md w-full shadow-2xl border border-outline-variant/10 transform animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-primary tracking-tighter mb-2">{confirmModal.title}</h3>
            <p className="text-on-surface-variant leading-relaxed mb-8">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                className="px-6 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-all"
              >
                {t('admin.cancel')}
              </button>
              <button 
                onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, show: false }); }}
                className={cn(
                  "px-8 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg",
                  confirmModal.type === 'danger' ? "bg-error shadow-error/20 hover:opacity-90" : "bg-primary shadow-primary/20 hover:opacity-90"
                )}
              >
                {confirmModal.type === 'danger' ? t('admin.delete') : t('admin.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
