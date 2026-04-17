import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Session, SessionQuizResult } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Video, Calendar, Clock, ExternalLink, Play, MapPin, ChevronLeft, Plus, Settings, ClipboardCheck, CheckCircle2, Star } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function SessionsList() {
  const { language } = useLanguage();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizResults, setQuizResults] = useState<Record<string, SessionQuizResult>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSessions();
    if (user) {
      fetchUserQuizResults();
      fetchUserFeedbacks();
    }
  }, [user]);

  const fetchSessions = async () => {
    try {
      const q = query(
        collection(db, 'sessions'), 
        where('active', '==', true),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserQuizResults = async () => {
    try {
      const q = query(collection(db, 'sessionQuizResults'), where('userId', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      const results: Record<string, SessionQuizResult> = {};
      querySnapshot.docs.forEach(doc => {
        const res = doc.data() as SessionQuizResult;
        results[res.sessionId] = res;
      });
      setQuizResults(results);
    } catch (error) {
       console.error("Error fetching quiz results:", error);
    }
  };

  const fetchUserFeedbacks = async () => {
    try {
      const q = query(collection(db, 'sessionFeedbacks'), where('userId', '==', user?.uid));
      const querySnapshot = await getDocs(q);
      const fs: Record<string, boolean> = {};
      querySnapshot.docs.forEach(doc => {
        fs[doc.data().sessionId] = true;
      });
      setFeedbacks(fs);
    } catch (error) {
       console.error("Error fetching feedbacks:", error);
    }
  };

  const isSessionFinished = (session: Session) => {
    if (session.endTime) {
      return Date.now() > new Date(session.endTime).getTime();
    }
    // Fallback for old sessions
    const sessionDate = new Date(session.date).getTime();
    const durationMs = (session.durationMinutes || 60) * 60 * 1000;
    return Date.now() > (sessionDate + durationMs);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-all text-primary"
        >
          <ChevronLeft size={24} className={cn(language === 'ar' && "rotate-180")} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">
            {language === 'ar' ? 'السيشنات والدورات' : 'Sessions & Workshops'}
          </h1>
          <p className="text-on-surface-variant font-medium">
            {language === 'ar' ? 'استكشف الجدول الزمني للتعلم والابتكار.' : 'Explore the schedule for learning and innovation.'}
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => navigate('/admin/sessions')}
            className="ml-auto flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">{language === 'ar' ? 'إدارة السيشنات' : 'Manage Sessions'}</span>
          </button>
        )}
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-surface-container-low rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-surface-container-lowest p-8 rounded-3xl hive-shadow relative overflow-hidden group hover:ring-2 ring-primary/20 transition-all border border-outline-variant/10"
            >
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-500",
                  session.type === 'live' ? "bg-error/10 text-error shadow-[0_0_20px_rgba(255,82,82,0.1)]" : 
                  session.type === 'recorded' ? "bg-primary/10 text-primary" : "bg-tertiary/10 text-tertiary"
                )}>
                  {session.type === 'live' ? <div className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full animate-ping" /> : null}
                  {session.type === 'recorded' ? <Play size={32} /> : <Video size={32} />}
                </div>

                <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        session.type === 'live' ? "bg-error text-white" : 
                        session.type === 'recorded' ? "bg-primary-container text-primary" : "bg-tertiary-container text-tertiary"
                      )}>
                        {session.type === 'live' ? (language === 'ar' ? 'بث مباشر' : 'Live') : 
                         session.type === 'recorded' ? (language === 'ar' ? 'مسجل' : 'Recorded') : 
                         (language === 'ar' ? 'ورشة عمل' : 'Workshop')}
                      </span>
                      <span className="text-on-surface-variant/40 text-[10px] font-bold">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black text-primary group-hover:text-secondary transition-colors leading-tight">
                      {language === 'ar' ? session.titleAr : session.title}
                    </h2>
                  </div>

                  <p className="text-on-surface-variant leading-relaxed text-sm line-clamp-2">
                    {language === 'ar' ? session.descriptionAr : session.description}
                  </p>

                  <div className="flex flex-wrap gap-6 pt-4 border-t border-outline-variant/10">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Calendar size={16} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {new Date(session.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Clock size={16} className="text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {new Date(session.date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="md:self-center">
                  {isSessionFinished(session) ? (
                    session.hasQuiz ? (
                      quizResults[session.id] ? (
                        <div className="flex flex-col items-center gap-2">
                           <div className="bg-primary/20 text-primary p-4 rounded-2xl flex items-center justify-center gap-2 font-black">
                              <CheckCircle2 size={24} />
                              <span>{quizResults[session.id].score}/{quizResults[session.id].totalQuestions}</span>
                           </div>
                           {feedbacks[session.id] ? (
                             <div className="flex items-center gap-1.5 bg-secondary/10 text-secondary px-3 py-1.5 rounded-xl">
                               <CheckCircle2 size={14} />
                               <span className="text-[10px] font-black uppercase">
                                 {language === 'ar' ? 'تم التقييم' : 'Feedback Sent'}
                               </span>
                             </div>
                           ) : (
                              <button 
                                onClick={() => navigate(`/sessions/${session.id}/feedback`)}
                                className="flex items-center gap-1.5 bg-error/10 text-error px-4 py-2 rounded-xl border border-error/20 hover:bg-error/20 transition-all shadow-lg shadow-error/5"
                              >
                                <Star size={14} className="fill-error" />
                                <span className="text-[10px] font-black uppercase">
                                  {language === 'ar' ? 'قيم الآن' : 'Rate Now'}
                                </span>
                              </button>
                           )}
                        </div>
                      ) : (
                        <button 
                          onClick={() => navigate(`/sessions/${session.id}/quiz`)}
                          className="bg-secondary text-white p-4 rounded-2xl hive-shadow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                        >
                          <span className="font-bold hidden lg:inline">
                            {language === 'ar' ? 'اختبر الان' : 'Test Now'}
                          </span>
                          <ClipboardCheck size={20} />
                        </button>
                      )
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="text-on-surface-variant/30 font-black uppercase tracking-widest text-xs border border-outline-variant/10 px-6 py-4 rounded-2xl bg-surface-container-high/20">
                             {language === 'ar' ? 'انتهى السيشن' : 'Ended'}
                          </div>
                          {!feedbacks[session.id] ? (
                            <button 
                              onClick={() => navigate(`/sessions/${session.id}/feedback`)}
                              className="flex items-center gap-1.5 bg-error/10 text-error px-4 py-2 rounded-xl border border-error/20 hover:bg-error/20 transition-all shadow-lg shadow-error/5"
                            >
                              <Star size={14} className="fill-error" />
                              <span className="text-[10px] font-black uppercase">
                                {language === 'ar' ? 'قيم الآن' : 'Rate Now'}
                              </span>
                            </button>
                          ) : (
                             <div className="flex items-center gap-1.5 bg-secondary/10 text-secondary px-3 py-1.5 rounded-xl">
                               <CheckCircle2 size={14} />
                               <span className="text-[10px] font-black uppercase">
                                 {language === 'ar' ? 'تم التقييم' : 'Feedback Sent'}
                               </span>
                             </div>
                          )}
                        </div>
                    )
                  ) : session.link ? (
                    <a 
                      href={session.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-primary text-white p-4 rounded-2xl hive-shadow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span className="font-bold hidden md:inline">
                        {session.type === 'live' ? (language === 'ar' ? 'انضم الآن' : 'Join Now') : (language === 'ar' ? 'مشاهدة' : 'Watch')}
                      </span>
                      <ExternalLink size={20} />
                    </a>
                  ) : (
                    <div className="bg-surface-container-high text-on-surface-variant/50 p-4 rounded-2xl cursor-not-allowed">
                       <Video size={20} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {sessions.length === 0 && (
            <div className="py-32 text-center bg-surface-container-low rounded-[40px] border-2 border-dashed border-outline-variant/30">
              <Video size={64} className="mx-auto text-outline-variant/30 mb-6" />
              <h3 className="text-xl font-bold text-on-surface-variant">
                {language === 'ar' ? 'لا توجد سيشنات مجدولة حالياً' : 'No sessions scheduled yet'}
              </h3>
              <p className="text-on-surface-variant/60 mt-2">
                {language === 'ar' ? 'تحقق مرة أخرى لاحقاً من أجل التحديثات.' : 'Check back later for updates.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
