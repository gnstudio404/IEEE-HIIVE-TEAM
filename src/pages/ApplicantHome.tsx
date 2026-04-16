import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Users, ArrowRight, ClipboardList, Trophy, Star, HelpCircle, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Team, UserScore } from '../types';
import { cn } from '../lib/utils';

export default function ApplicantHome() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [score, setScore] = useState<UserScore | null>(null);

  useEffect(() => {
    // Redirect to profile if any required field is missing (first time setup)
    const isProfileComplete = profile && 
      profile.name && 
      profile.phone && 
      profile.department && 
      profile.bio && 
      profile.country && 
      profile.photoURL;

    if (profile && !isProfileComplete && profile.role !== 'admin') {
      navigate('/profile');
      return;
    }

    if (profile?.assignedTeamId) {
      const fetchTeam = async () => {
        try {
          const teamDoc = await getDoc(doc(db, 'teams', profile.assignedTeamId!));
          if (teamDoc.exists()) {
            setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `teams/${profile.assignedTeamId}`);
        }
      };
      fetchTeam();
    }

    if (profile?.completedTest) {
      const fetchScore = async () => {
        try {
          const scoreDoc = await getDoc(doc(db, 'scores', profile.uid));
          if (scoreDoc.exists()) {
            setScore(scoreDoc.data() as UserScore);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `scores/${profile.uid}`);
        }
      };
      fetchScore();
    }
  }, [profile?.assignedTeamId, profile?.completedTest, profile?.uid]);

  return (
    <div className="space-y-12">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-secondary font-bold tracking-widest text-xs uppercase mb-2 block">
            {language === 'ar' ? 'لوحة تحكم المهندس' : 'Engineer Dashboard'}
          </span>
          <h2 className="text-4xl font-bold text-primary tracking-tight mb-2">
            {language === 'ar' ? `مرحباً، ${profile?.name}` : `Welcome, ${profile?.name}`}
          </h2>
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-block w-2 h-2 rounded-full animate-pulse",
              profile?.completedTest ? "bg-primary" : "bg-secondary-container"
            )}></span>
            <p className="text-on-surface-variant font-medium">
              {language === 'ar' ? 'الحالة:' : 'Status:'} <span className="text-primary">
                {profile?.completedTest 
                  ? (language === 'ar' ? 'تم الاختبار' : 'Test Completed') 
                  : (language === 'ar' ? 'بانتظار الاختبار' : 'Test Pending')}
              </span>
            </p>
          </div>
        </div>
        <div className="hidden md:flex gap-4">
          <div className="px-4 py-2 rounded-full bg-surface-container-low flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
            <span className="text-xs font-bold text-on-surface-variant uppercase">
              {new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </section>

      {/* Main Progress Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1: Registration (Completed) */}
        <div className="bg-surface-container-lowest rounded-xl p-8 hive-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
            <span className="material-symbols-outlined text-primary text-3xl opacity-20">assignment_turned_in</span>
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-primary fill-1">check_circle</span>
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">
              {language === 'ar' ? 'التسجيل' : 'Registration'}
            </h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              {language === 'ar' ? 'التحقق من الملف الشخصي ورفع المستندات.' : 'Profile verification and documents upload.'}
            </p>
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <span>{language === 'ar' ? 'مكتمل' : 'Completed'}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>
        </div>

        {/* Step 2: MCQ Test (Active/Completed) */}
        <div className={cn(
          "bg-surface-container-lowest rounded-xl p-8 hive-shadow relative overflow-hidden",
          !profile?.completedTest && "ring-1 ring-primary/5"
        )}>
          <div className="absolute top-0 right-0 p-4">
            <span className="material-symbols-outlined text-secondary text-3xl opacity-20">quiz</span>
          </div>
          <div className="relative z-10">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center mb-6",
              profile?.completedTest ? "bg-primary/10" : "bg-secondary/10"
            )}>
              <span className={cn(
                "material-symbols-outlined",
                profile?.completedTest ? "text-primary fill-1" : "text-secondary"
              )}>
                {profile?.completedTest ? "check_circle" : "timer"}
              </span>
            </div>
            <h3 className="text-xl font-bold text-primary mb-2">
              {language === 'ar' ? 'اختبار الشخصية' : 'Personality Test'}
            </h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              {language === 'ar' ? 'تقييم السمات الشخصية الخمس الكبرى.' : 'Big Five personality traits assessment.'}
            </p>
            {profile?.completedTest ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <CheckCircle2 size={16} />
                  <span>{language === 'ar' ? 'مكتمل' : 'Completed'}</span>
                </div>
                {score && (
                  <div className="pt-4 border-t border-surface-container-high">
                    <div className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">
                      {language === 'ar' ? 'دورك المقترح:' : 'Your Suggested Role:'}
                    </div>
                    <div className="text-2xl font-black text-primary tracking-tighter mb-2">
                      {score.personalityType === 'The Leader' 
                        ? (language === 'ar' ? score.personalityTypeAr : score.personalityType)
                        : (language === 'ar' ? 'عضو فريق' : 'Team Member')
                      }
                    </div>
                    <div className="text-sm font-bold text-secondary mb-2">
                      {language === 'ar' ? score.bestRoleAr : score.bestRole}
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed italic">
                      {language === 'ar' ? score.descriptionAr : score.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/test" 
                className="w-full bg-secondary text-white font-bold py-3 px-6 rounded-lg active:scale-[0.98] transition-all hover:brightness-110 flex items-center justify-center gap-2"
              >
                {language === 'ar' ? 'ابدأ الاختبار' : 'Start Test'}
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            )}
          </div>
          <div className={cn(
            "absolute bottom-0 left-0 w-full h-1",
            profile?.completedTest ? "bg-primary" : "bg-secondary-container"
          )}></div>
        </div>

        {/* Step 3: Team Assignment (Waiting/Completed) */}
        <div className={cn(
          "rounded-xl p-8 relative overflow-hidden transition-all",
          profile?.assignedTeamId 
            ? "bg-surface-container-lowest hive-shadow" 
            : "bg-surface-container-low opacity-80"
        )}>
          <div className="absolute top-0 right-0 p-4">
            <span className="material-symbols-outlined text-outline text-3xl opacity-20">groups</span>
          </div>
          <div className="relative z-10">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center mb-6",
              profile?.assignedTeamId ? "bg-primary/10" : "bg-surface-container-high"
            )}>
              <span className={cn(
                "material-symbols-outlined",
                profile?.assignedTeamId ? "text-primary fill-1" : "text-outline"
              )}>
                {profile?.assignedTeamId ? "check_circle" : "hourglass_empty"}
              </span>
            </div>
            <h3 className={cn(
              "text-xl font-bold mb-2",
              profile?.assignedTeamId ? "text-primary" : "text-on-surface-variant"
            )}>
              {language === 'ar' ? 'تعيين الفريق' : 'Team Assignment'}
            </h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              {language === 'ar' ? 'التنسيب داخل خلية هندسية مناسبة.' : 'Placement within appropriate engineering hive.'}
            </p>
            {profile?.assignedTeamId ? (
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <span>{language === 'ar' ? 'مكتمل' : 'Completed'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-outline font-bold text-sm italic">
                <span>{language === 'ar' ? 'بانتظار إكمال الاختبار' : 'Waiting for Test Completion'}</span>
              </div>
            )}
          </div>
          {profile?.assignedTeamId && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary"></div>}
        </div>
      </div>

      {/* Sessions Section */}
      <section>
        <Link 
          to="/sessions"
          className="block bg-surface-container-lowest rounded-[40px] p-12 hive-shadow relative overflow-hidden group hover:ring-2 ring-primary/20 transition-all border border-outline-variant/10"
        >
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all duration-700">
            <Video size={160} className="text-primary" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-xl text-center md:text-left">
              <span className="text-secondary font-black tracking-[0.2em] text-xs uppercase mb-6 block">
                {language === 'ar' ? 'التعلم المستمر' : 'Continuous Learning'}
              </span>
              <h3 className="text-5xl font-black text-primary tracking-tighter mb-6 leading-none">
                {language === 'ar' ? 'السيشنات والدورات' : 'Sessions & Workshops'}
              </h3>
              <p className="text-on-surface-variant text-lg leading-relaxed font-medium mb-10">
                {language === 'ar' 
                  ? 'استكشف الجدول الزمني للسيشنات المباشرة، الورش الفنية، والمحاضرات المسجلة المصممة لتعزيز مهاراتك الهندسية.'
                  : 'Explore our schedule of live sessions, technical workshops, and recorded lectures designed to enhance your engineering expertise.'}
              </p>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Video className="text-primary" size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-secondary uppercase italic">{language === 'ar' ? 'مباشر' : 'Live'}</div>
                    <div className="text-sm font-bold text-on-surface-variant">{language === 'ar' ? 'سيشنات تفاعلية' : 'Interactive Sessions'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center">
                    <Trophy className="text-secondary" size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-secondary uppercase italic">{language === 'ar' ? 'شهادات' : 'Certificates'}</div>
                    <div className="text-sm font-bold text-on-surface-variant">{language === 'ar' ? 'اعتماد مهارات' : 'Skill Validation'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                <ArrowRight size={40} className={cn(language === 'ar' && "rotate-180")} />
              </div>
              <span className="text-primary font-black text-xs uppercase tracking-widest">{language === 'ar' ? 'استعرض الكل' : 'View All'}</span>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}
