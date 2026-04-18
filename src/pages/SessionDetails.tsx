import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session, SessionQuizResult } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, ExternalLink, Play, Video, ChevronLeft, ClipboardCheck, Info, Loader2, Star, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function SessionDetails() {
  const { sessionId } = useParams();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizResult, setQuizResult] = useState<SessionQuizResult | null>(null);
  const [hasFeedback, setHasFeedback] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    }
  }, [sessionId, user]);

  const fetchSessionData = async () => {
    if (!sessionId) return;
    try {
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
      if (sessionDoc.exists()) {
        setSession({ id: sessionDoc.id, ...sessionDoc.data() } as Session);
      }

      if (user) {
        // Fetch quiz results
        const resultQ = query(
          collection(db, 'sessionQuizResults'),
          where('sessionId', '==', sessionId),
          where('userId', '==', user.uid)
        );
        const resultSnap = await getDocs(resultQ);
        if (!resultSnap.empty) {
          setQuizResult({ id: resultSnap.docs[0].id, ...resultSnap.docs[0].data() } as SessionQuizResult);
        }

        // Fetch feedback
        const feedbackQ = query(
          collection(db, 'sessionFeedbacks'),
          where('sessionId', '==', sessionId),
          where('userId', '==', user.uid)
        );
        const feedbackSnap = await getDocs(feedbackQ);
        setHasFeedback(!feedbackSnap.empty);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
    } finally {
      setLoading(false);
    }
  };

  const isSessionFinished = (s: Session) => {
    if (s.endTime) {
      return Date.now() > new Date(s.endTime).getTime();
    }
    const sessionDate = new Date(s.date).getTime();
    const durationMs = (s.durationMinutes || 60) * 60 * 1000;
    return Date.now() > (sessionDate + durationMs);
  };

  const isSessionUpcoming = (s: Session) => {
    return Date.now() < new Date(s.date).getTime();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-on-surface-variant font-black uppercase tracking-widest text-sm">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading Session...'}
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black text-primary">Session not found</h2>
        <button onClick={() => navigate('/sessions')} className="mt-4 text-secondary font-bold hover:underline">
          Return to sessions list
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/sessions')}
          className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-all text-primary"
        >
          <ChevronLeft size={24} className={cn(language === 'ar' && "rotate-180")} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">
            {language === 'ar' ? 'تفاصيل الجلسة' : 'Session Details'}
          </h1>
        </div>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container-lowest rounded-[40px] hive-shadow overflow-hidden border-t-8 border-primary"
      >
        <div className="p-6 md:p-12 space-y-10">
          {session.imageUrl && (
            <div className="w-full aspect-[4/5] max-h-[700px] rounded-[32px] overflow-hidden shadow-2xl bg-surface-container-low border border-outline-variant/10">
              <img 
                src={session.imageUrl} 
                alt={language === 'ar' ? session.titleAr : session.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="space-y-6">
            <header className="space-y-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                session.type === 'live' ? "bg-error/10 text-error" : 
                session.type === 'recorded' ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"
              )}>
                {session.type === 'recorded' ? <Play size={32} /> : <Video size={32} />}
              </div>
              
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                   <span className={cn(
                     "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                     session.type === 'live' ? "bg-error text-white" : 
                     session.type === 'recorded' ? "bg-primary-container text-primary" : "bg-tertiary-container text-tertiary"
                   )}>
                     {session.type === 'live' ? (language === 'ar' ? 'بث مباشر' : 'Live') : 
                      session.type === 'recorded' ? (language === 'ar' ? 'مسجل' : 'Recorded') : 
                      (language === 'ar' ? 'ورشة عمل' : 'Workshop')}
                   </span>
                   {isSessionUpcoming(session) && (
                     <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
                       {language === 'ar' ? 'قريباً' : 'Upcoming'}
                     </span>
                   )}
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-primary tracking-tighter leading-tight">
                  {language === 'ar' ? session.titleAr : session.title}
                </h2>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-surface-container-low p-8 rounded-3xl">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant/50 tracking-widest">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                  <p className="font-bold text-lg">
                    {new Date(session.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant/50 tracking-widest">{language === 'ar' ? 'الوقت' : 'Time'}</p>
                  <p className="font-bold text-lg">
                    {new Date(session.date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                <Info size={16} />
                {language === 'ar' ? 'عن هذه الجلسة' : 'About this session'}
              </h3>
              <div className="bg-surface-container-low/50 p-8 rounded-[32px] border border-outline-variant/10">
                <p className={cn(
                  "text-on-surface-variant text-xl leading-relaxed whitespace-pre-wrap",
                  language === 'ar' && "text-right"
                )}>
                  {language === 'ar' ? session.descriptionAr : session.description}
                </p>
              </div>
            </div>

            <div className="pt-10 border-t border-outline-variant/10">
              {isSessionFinished(session) ? (
                session.hasQuiz ? (
                  quizResult ? (
                    <div className="flex flex-col items-center gap-6 bg-primary/5 p-10 rounded-[40px] border-2 border-dashed border-primary/20">
                       <p className="font-black text-primary uppercase text-sm tracking-[0.2em]">{language === 'ar' ? 'نتيجتك النهائية' : 'Your Final Result'}</p>
                       <div className="text-7xl font-black text-primary flex items-baseline gap-2">
                          {quizResult.score} <span className="text-2xl opacity-30">/ {quizResult.totalQuestions}</span>
                       </div>
                       {!hasFeedback && (
                         <button 
                           onClick={() => navigate(`/sessions/${session.id}/feedback`)}
                           className="w-full bg-error text-white py-5 rounded-2xl font-black text-xl uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-error/20 flex items-center justify-center gap-3"
                         >
                           <Star size={24} className="fill-white" />
                           {language === 'ar' ? 'قيم الجلسة الآن' : 'Rate Session Now'}
                         </button>
                       )}
                       {hasFeedback && (
                         <div className="flex items-center gap-2 text-secondary font-black bg-secondary/10 px-6 py-3 rounded-full">
                           <CheckCircle2 size={20} />
                           {language === 'ar' ? 'تم تقديم التقييم' : 'Feedback Submitted'}
                         </div>
                       )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => navigate(`/sessions/${session.id}/quiz`)}
                      className="w-full bg-primary text-white py-8 rounded-[32px] font-black text-2xl uppercase tracking-widest hive-shadow hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-4 shadow-2xl shadow-primary/30"
                    >
                      <ClipboardCheck size={32} />
                      {language === 'ar' ? 'ابدأ الاختبار الآن' : 'Start Assessment Now'}
                    </button>
                  )
                ) : (
                   <div className="bg-surface-container-high p-10 rounded-[32px] text-center border-2 border-dotted border-outline-variant/30">
                     <p className="font-black text-on-surface-variant uppercase tracking-widest">{language === 'ar' ? 'الجلسة لا تحتوي على اختبار' : 'Session has no assessment'}</p>
                   </div>
                )
              ) : isSessionUpcoming(session) ? (
                <div className="bg-surface-container-high p-10 rounded-[40px] text-center space-y-4 border-t-8 border-outline-variant/20">
                  <div className="w-16 h-16 bg-surface-container-highest rounded-2xl flex items-center justify-center mx-auto text-primary">
                    <Clock size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-primary text-xl uppercase tracking-tighter">{language === 'ar' ? 'هذه الجلسة قريباً' : 'This session starts soon'}</p>
                    <p className="text-on-surface-variant font-medium text-lg">{language === 'ar' ? 'يرجى العودة في الموعد المحدد للتمكن من الانضمام.' : 'Please return at the scheduled time to join.'}</p>
                  </div>
                </div>
              ) : session.link ? (
                <a 
                  href={session.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-primary text-white py-8 rounded-[32px] font-black text-2xl uppercase tracking-widest hive-shadow text-center block hover:brightness-110 active:scale-[0.98] transition-all shadow-2xl shadow-primary/30"
                >
                  {session.type === 'live' ? (language === 'ar' ? 'انضم للبث الآن' : 'Join Live Stream') : (language === 'ar' ? 'مشاهدة الجلسة' : 'Watch Session')}
                </a>
              ) : (
                 <div className="bg-surface-container-high p-10 rounded-[32px] text-center">
                   <p className="font-black text-on-surface-variant/40 uppercase tracking-widest">{language === 'ar' ? 'رابط الجلسة غير متوفر حالياً' : 'Session link not available'}</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
