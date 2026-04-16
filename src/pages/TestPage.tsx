import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, doc, updateDoc, setDoc, query, orderBy, writeBatch, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Question, Traits, UserScore, UserRoleType, PersonalityProfile } from '../types';
import { toast } from 'sonner';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, Send, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { LIKERT_SCALE, INITIAL_QUESTIONS } from '../constants';

export default function TestPage() {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to profile if any required field is missing
    const isProfileComplete = profile && 
      profile.name && 
      profile.phone && 
      profile.department && 
      profile.bio && 
      profile.country && 
      profile.photoURL;

    if (profile && !isProfileComplete) {
      toast.error(language === 'ar' ? 'يرجى إكمال ملفك الشخصي أولاً' : 'Please complete your profile first');
      navigate('/profile');
      return;
    }

    if (profile?.completedTest) {
      navigate('/');
      return;
    }

    const validateSessions = async () => {
       if (!user) return;
       try {
         // Get all sessions that have ended and have quizzes
         const now = new Date().toISOString();
         const sessionsSnap = await getDocs(query(
           collection(db, 'sessions'),
           where('active', '==', true),
           where('hasQuiz', '==', true)
         ));
         
         const endedSessions = sessionsSnap.docs.filter(doc => doc.data().endTime < now);
         
         if (endedSessions.length > 0) {
           // Get user results
           const resultsSnap = await getDocs(query(
             collection(db, 'sessionQuizResults'),
             where('userId', '==', user.uid)
           ));
           const completedSessionIds = resultsSnap.docs.map(doc => doc.data().sessionId);
           
           // Check if any ended session is not completed
           const incompleteSession = endedSessions.find(s => !completedSessionIds.includes(s.id));
           if (incompleteSession) {
             setPendingFeedback("incomplete");
             return;
           }

           // Get user feedbacks
           const feedbackSnap = await getDocs(query(
             collection(db, 'sessionFeedbacks'),
             where('userId', '==', user.uid)
           ));
           const feedbackSessionIds = feedbackSnap.docs.map(doc => doc.data().sessionId);
           
           // Check if any completed session lacks feedback
           const sessionWithoutFeedback = endedSessions.find(s => !feedbackSessionIds.includes(s.id));
           if (sessionWithoutFeedback) {
             setPendingFeedback(sessionWithoutFeedback.id);
             return;
           }
         }
       } catch (error) {
         console.error("Error validating sessions:", error);
       }
    };

    const fetchQuestions = async () => {
      await validateSessions();
      try {
        const q = query(collection(db, 'questions'), orderBy('order', 'asc'));
        let querySnapshot;
        try {
          querySnapshot = await getDocs(q);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'questions');
          return;
        }
        let fetchedQuestions = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Question))
          .filter(q => q.active);
        
        // Only admins should handle seeding/updating
        const isAdminUser = profile?.role === 'admin';
        const needsReseed = fetchedQuestions.length === 0;
        
        if (needsReseed && isAdminUser) {
          console.log("Admin detected: Seeding questions...");
          const batch = [];
          for (const seedQ of INITIAL_QUESTIONS) {
            batch.push(addDoc(collection(db, 'questions'), {
              text: seedQ.en,
              textAr: seedQ.ar,
              trait: seedQ.trait,
              active: true,
              order: parseInt(seedQ.id)
            }));
          }
          await Promise.all(batch);
          
          // Re-fetch after seeding
          let updatedSnapshot;
          try {
            updatedSnapshot = await getDocs(q);
          } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'questions');
            return;
          }
          fetchedQuestions = updatedSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Question))
            .filter(q => q.active);
        }
        
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Error fetching questions:", error);
        toast.error("Failed to load questions. Please contact an admin.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [profile, navigate, language]);

  const handleSelect = (value: number) => {
    if (!questions[currentIndex]) return;
    setAnswers({ ...answers, [questions[currentIndex].id]: value });
  };

  const getPersonalityProfile = (s: Traits): PersonalityProfile => {
    // 1. Leader: High E, High C, Low N
    if (s.E >= 4.0 && s.C >= 4.0 && s.N <= 2.8) {
      return {
        type: "Leader",
        type_ar: "القائد",
        bestRole: "Team Leader",
        bestRole_ar: "قائد الفريق",
        description: "A confident and structured personality that can lead people and make decisions under pressure.",
        description_ar: "شخصية واثقة ومنظمة، قادرة على قيادة الفريق واتخاذ القرار تحت الضغط."
      };
    }

    // 2. Strategist: High O, High C
    if (s.O >= 4.0 && s.C >= 3.8) {
      return {
        type: "Strategist",
        type_ar: "المخطط",
        bestRole: "Strategy & Planning",
        bestRole_ar: "التخطيط والاستراتيجية",
        description: "A thoughtful and organized personality that sees patterns and plans effectively.",
        description_ar: "شخصية تفكر بعمق وتخطط بشكل منظم وترى الصورة الكبيرة."
      };
    }

    // 3. Executor: High C
    if (s.C >= 4.2) {
      return {
        type: "Executor",
        type_ar: "المنفذ",
        bestRole: "Operations & Execution",
        bestRole_ar: "التنفيذ والعمليات",
        description: "A disciplined and dependable personality focused on getting things done.",
        description_ar: "شخصية منضبطة ويمكن الاعتماد عليها، تركّز على إنجاز المهام."
      };
    }

    // 4. Thinker: High O, Low E
    if (s.O >= 4.0 && s.E <= 3.0) {
      return {
        type: "Thinker",
        type_ar: "المفكر",
        bestRole: "Research & Analysis",
        bestRole_ar: "البحث والتحليل",
        description: "An analytical and creative personality that generates ideas and solves complex problems.",
        description_ar: "شخصية تحليلية وإبداعية، بارعة في توليد الأفكار وحل المشكلات."
      };
    }

    // 5. Supporter: High A
    if (s.A >= 4.0) {
      return {
        type: "Supporter",
        type_ar: "الداعم",
        bestRole: "Team Support",
        bestRole_ar: "دعم الفريق",
        description: "A cooperative and empathetic personality that improves team harmony.",
        description_ar: "شخصية متعاونة ومتفاهمة، تساعد على انسجام الفريق."
      };
    }

    // 6. Challenger: High O, Low A, High E
    if (s.O >= 4.0 && s.A <= 3.0 && s.E >= 3.5) {
      return {
        type: "Challenger",
        type_ar: "المحفّز",
        bestRole: "Critical Review",
        bestRole_ar: "المراجعة النقدية",
        description: "A bold personality that questions assumptions and pushes the team to think differently.",
        description_ar: "شخصية جريئة تتحدى الأفكار الجاهزة وتدفع الفريق للتفكير بشكل مختلف."
      };
    }

    // 7. Stabilizer: Balanced traits, Low N
    if (s.N <= 3.0 && s.C >= 3.0 && s.A >= 3.0) {
      return {
        type: "Stabilizer",
        type_ar: "المتزن",
        bestRole: "Core Team Member",
        bestRole_ar: "عضو فريق أساسي",
        description: "A balanced personality that adapts well and supports team stability.",
        description_ar: "شخصية متوازنة ومرنة، تتأقلم بسهولة وتدعم استقرار الفريق."
      };
    }

    // 8. General Contributor: Default
    return {
      type: "General Contributor",
      type_ar: "مساهم عام",
      bestRole: "Team Member",
      bestRole_ar: "عضو فريق",
      description: "A flexible personality with mixed traits that can contribute in different team settings.",
      description_ar: "شخصية مرنة بسمات متنوعة، ويمكنها المساهمة في أكثر من نوع فريق."
    };
  };

  const getLeaderScore = (s: Traits): number => {
    return (s.E * 0.30) +
           (s.C * 0.30) +
           (s.O * 0.20) +
           (s.A * 0.10) -
           (s.N * 0.30);
  };

  const getLeadershipPotential = (score: number): 'High' | 'Medium' | 'Low' => {
    if (score >= 2.8) return 'High';
    if (score >= 2.2) return 'Medium';
    return 'Low';
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error(language === 'ar' ? "يرجى الإجابة على جميع الأسئلة" : "Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const traitSums: Traits = { O: 0, C: 0, E: 0, A: 0, N: 0 };
      const traitCounts: Traits = { O: 0, C: 0, E: 0, A: 0, N: 0 };

      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();

      // Calculate averages and add responses to batch
      for (const qId in answers) {
        const question = questions.find(q => q.id === qId);
        if (question) {
          const trait = question.trait;
          const val = answers[qId];
          traitSums[trait] += val;
          traitCounts[trait]++;
        }

        const responseRef = doc(collection(db, 'responses'));
        batch.set(responseRef, {
          userId: user?.uid,
          questionId: qId,
          value: answers[qId],
          timestamp
        });
      }

      const finalTraits: Traits = {
        O: traitSums.O / (traitCounts.O || 1),
        C: traitSums.C / (traitCounts.C || 1),
        E: traitSums.E / (traitCounts.E || 1),
        A: traitSums.A / (traitCounts.A || 1),
        N: traitSums.N / (traitCounts.N || 1),
      };

      const profile = getPersonalityProfile(finalTraits);
      const leaderScore = getLeaderScore(finalTraits);
      const leadershipPotential = getLeadershipPotential(leaderScore);

      // Find primary trait for dashboard
      const primaryTrait = (Object.keys(finalTraits) as Array<keyof Traits>).reduce((a, b) => finalTraits[a] > finalTraits[b] ? a : b);

      // Add score to batch
      const scoreRef = doc(db, 'scores', user!.uid);
      batch.set(scoreRef, {
        userId: user?.uid,
        traits: finalTraits,
        role: profile.type,
        personalityType: profile.type,
        personalityTypeAr: profile.type_ar,
        bestRole: profile.bestRole,
        bestRoleAr: profile.bestRole_ar,
        description: profile.description,
        descriptionAr: profile.description_ar,
        leaderScore,
        leadershipPotential,
        primaryTrait,
        updatedAt: timestamp
      });

      // Update user status in batch
      const userRef = doc(db, 'users', user!.uid);
      batch.update(userRef, {
        completedTest: true
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-test-submission');
        return;
      }

      toast.success(language === 'ar' ? "تم تقديم الاختبار بنجاح!" : "Test submitted successfully!");
      navigate('/');
    } catch (error) {
      console.error("Error submitting test:", error);
      toast.error("Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Loading your test...</p>
      </div>
    );
  }

  if (pendingFeedback) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border-t-8 border-error shadow-2xl max-w-xl mx-auto space-y-6">
        <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto text-error">
          <AlertCircle size={40} />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
             {language === 'ar' ? 'تنبيه: متطلبات ناقصة' : 'Attention: Missing Requirements'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {pendingFeedback === 'incomplete' 
              ? (language === 'ar' ? 'يجب البدء وإكمال جميع الجلسات التدريبية المتاحة أولاً قبل إجراء الاختبار النهائي.' : 'You must complete all available training sessions and their assessments before taking the final test.')
              : (language === 'ar' ? 'يجب تقديم التقييم للجلسات التي أتممتها أولاً. تقييمك يساعدنا على التحسين.' : 'You must provide feedback for the sessions you completed first. Your feedback helps us improve.')
            }
          </p>
        </div>
        <button 
          onClick={() => navigate('/sessions')}
          className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
           {language === 'ar' ? 'الانتقال إلى الجلسات' : 'Go to Sessions'}
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
        <div className="w-16 h-16 text-slate-200 mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Questions Available</h3>
        <p className="text-slate-500 mb-6">The test is currently being prepared. Please check back later.</p>
        <button onClick={() => navigate('/')} className="text-indigo-600 font-bold hover:underline">Return Home</button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-end mb-2">
          <div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t('test.question')} {currentIndex + 1} of {questions.length}</span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{t('test.title')}</h2>
          </div>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex-1">
              {language === 'ar' && currentQuestion.textAr ? currentQuestion.textAr : currentQuestion.text}
            </h3>
          </div>
          
          <div className="space-y-4">
            {LIKERT_SCALE.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all flex items-center justify-between group ${
                  answers[currentQuestion.id] === option.value 
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                    : "border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className={`font-medium ${answers[currentQuestion.id] === option.value ? "text-indigo-900 dark:text-indigo-200" : "text-slate-700 dark:text-slate-300"}`}>
                  {language === 'ar' ? option.labelAr : option.labelEn}
                </span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  answers[currentQuestion.id] === option.value 
                    ? "border-indigo-600 bg-indigo-600 text-white" 
                    : "border-slate-200 dark:border-slate-700 group-hover:border-indigo-300"
                }`}>
                  {answers[currentQuestion.id] === option.value && <CheckCircle2 className="w-4 h-4" />}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={handleBack}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('test.back')}
        </button>

        {currentIndex === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || answers[currentQuestion.id] === undefined}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 transition-all"
          >
            {submitting ? t('test.submitting') : t('test.finish')}
            {!submitting && <Send className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={answers[currentQuestion.id] === undefined}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 transition-all"
          >
            {t('test.next')}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
