import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session, SessionQuestion, SessionQuizResult } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, ChevronRight, CheckCircle2, Trophy, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function SessionQuiz() {
  const { sessionId } = useParams();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    if (sessionId) {
      fetchSessionAndQuestions();
      checkPreviousAttempt();
    }
  }, [sessionId, user]);

  const checkPreviousAttempt = async () => {
    if (!user || !sessionId) return;
    try {
      const q = query(
        collection(db, 'sessionQuizResults'), 
        where('userId', '==', user.uid),
        where('sessionId', '==', sessionId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error(language === 'ar' ? 'لقد قمت بإجراء هذا الاختبار بالفعل' : 'You have already taken this quiz');
        navigate('/sessions');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSessionAndQuestions = async () => {
    try {
      const sessionSnap = await getDoc(doc(db, 'sessions', sessionId!));
      if (!sessionSnap.exists()) {
        toast.error('Session not found');
        navigate('/sessions');
        return;
      }
      setSession({ id: sessionSnap.id, ...sessionSnap.data() } as Session);

      const q = query(
        collection(db, 'sessionQuestions'), 
        where('sessionId', '==', sessionId),
        orderBy('order', 'asc')
      );
      const questionsSnap = await getDocs(q);
      const data = questionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionQuestion));
      setQuestions(data);
      setAnswers(new Array(data.length).fill(-1));
    } catch (error) {
       handleFirestoreError(error, OperationType.LIST, 'sessionQuestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (answers.includes(-1)) {
      toast.error(language === 'ar' ? 'يرجى الإجابة على جميع الأسئلة' : 'Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      let score = 0;
      questions.forEach((q, i) => {
        if (q.correctOptionIndex === answers[i]) {
          score++;
        }
      });

      const result: Omit<SessionQuizResult, 'id'> = {
        sessionId: sessionId!,
        userId: user!.uid,
        score,
        totalQuestions: questions.length,
        completedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'sessionQuizResults'), result);
      setFinalScore(score);
      setCompleted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sessionQuizResults');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" size={64} /></div>;

  if (questions.length === 0) return (
    <div className="text-center p-20 bg-surface-container-low rounded-3xl">
       <AlertCircle className="mx-auto text-outline mb-4" size={48} />
       <p className="font-bold text-on-surface-variant">No assessment available for this session yet.</p>
    </div>
  );

  if (completed) {
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl mx-auto bg-surface-container-lowest rounded-[48px] p-12 hive-shadow text-center space-y-8 border-t-8 border-primary"
      >
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Trophy size={48} className="text-primary" />
        </div>
        <div>
           <h2 className="text-4xl font-black text-primary tracking-tighter mb-2">
             {language === 'ar' ? 'أحسنت!' : 'Great Job!'}
           </h2>
           <p className="text-on-surface-variant font-medium">
             {language === 'ar' ? 'لقد أكملت التقييم بنجاح.' : 'You have successfully completed the assessment.'}
           </p>
        </div>
        
        <div className="bg-surface-container-high/50 p-8 rounded-3xl">
           <div className="text-xs font-black text-secondary uppercase tracking-widest mb-1">{language === 'ar' ? 'درجتك النهائية' : 'Final Score'}</div>
           <div className="text-6xl font-black text-primary tracking-tighter">
             {finalScore} <span className="text-2xl opacity-30 text-outline">/ {questions.length}</span>
           </div>
        </div>

        <button 
          onClick={() => navigate(`/sessions/${sessionId}/feedback`)}
          className="w-full bg-primary text-white p-5 rounded-2xl font-black tracking-widest uppercase hover:brightness-110 shadow-xl shadow-primary/20 transition-all"
        >
          {language === 'ar' ? 'البدء في التقييم' : 'Start Feedback'}
        </button>
      </motion.div>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <header className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <button onClick={() => navigate('/sessions')} className="p-2 hover:bg-surface-container-high rounded-full">
               <ChevronLeft size={24} className={cn(language === 'ar' && "rotate-180")} />
            </button>
            <h1 className="text-2xl font-black text-primary tracking-tighter truncate max-w-xs md:max-w-md">
               {language === 'ar' ? session?.titleAr : session?.title}
            </h1>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-xs font-black text-secondary uppercase tracking-widest">Question</span>
            <span className="text-2xl font-black text-primary leading-none">
               {currentIdx + 1} <span className="text-sm text-outline">/ {questions.length}</span>
            </span>
         </div>
      </header>

      <div className="bg-surface-container-low h-2 rounded-full overflow-hidden">
         <motion.div 
           initial={{ width: 0 }}
           animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
           className="h-full bg-primary"
         />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={currentIdx}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           className="bg-surface-container-lowest p-10 rounded-[40px] hive-shadow space-y-10 border border-outline-variant/10"
        >
          <div>
            <h3 className="text-2xl font-black text-primary mb-2 line-clamp-3 leading-tight">{currentQ.text}</h3>
            <p className="text-right text-xl font-medium text-on-surface-variant leading-relaxed" dir="rtl">{currentQ.textAr}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
             {currentQ.options.map((opt, idx) => (
               <button 
                 key={idx}
                 onClick={() => {
                   const newAns = [...answers];
                   newAns[currentIdx] = idx;
                   setAnswers(newAns);
                 }}
                 className={cn(
                   "p-6 rounded-2xl text-left flex items-center justify-between group transition-all duration-300",
                   answers[currentIdx] === idx 
                    ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                    : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface"
                 )}
               >
                 <div className="flex-1">
                    <div className="flex items-center gap-4">
                       <span className={cn(
                         "w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm",
                         answers[currentIdx] === idx ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                       )}>
                         {String.fromCharCode(65 + idx)}
                       </span>
                       <div className="flex-1">
                          <div className="font-bold text-lg">{opt}</div>
                          <div className={cn(
                            "text-base opacity-70 text-right font-medium",
                            answers[currentIdx] === idx ? "text-white" : "text-on-surface-variant"
                          )} dir="rtl">{currentQ.optionsAr[idx]}</div>
                       </div>
                    </div>
                 </div>
                 <div className={cn(
                   "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                   answers[currentIdx] === idx ? "border-white bg-white" : "border-outline group-hover:border-primary"
                 )}>
                    {answers[currentIdx] === idx && <CheckCircle2 className="text-primary" size={16} />}
                 </div>
               </button>
             ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between items-center pt-6">
         <button 
           disabled={currentIdx === 0}
           onClick={() => setCurrentIdx(prev => prev - 1)}
           className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all disabled:opacity-30"
         >
           {language === 'ar' ? 'السابق' : 'Previous'}
         </button>

         {currentIdx === questions.length - 1 ? (
           <button 
             onClick={handleSubmit}
             disabled={submitting || answers[currentIdx] === -1}
             className="bg-primary text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 shadow-xl shadow-primary/20 transition-all disabled:opacity-50"
           >
             {submitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Submitting...') : (language === 'ar' ? 'إنهاء الاختبار' : 'Finish Quiz')}
           </button>
         ) : (
           <button 
             disabled={answers[currentIdx] === -1}
             onClick={() => setCurrentIdx(prev => prev + 1)}
             className="bg-surface-container-highest text-primary px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/10 transition-all flex items-center gap-2 disabled:opacity-30"
           >
             {language === 'ar' ? 'التالي' : 'Next'}
             <ChevronRight size={18} className={cn(language === 'ar' && "rotate-180")} />
           </button>
         )}
      </div>
    </div>
  );
}
