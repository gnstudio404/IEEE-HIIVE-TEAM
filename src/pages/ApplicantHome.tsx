import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Users, ArrowRight, ClipboardList, Trophy, Star, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Team, UserScore } from '../types';

export default function ApplicantHome() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [team, setTeam] = useState<Team | null>(null);
  const [score, setScore] = useState<UserScore | null>(null);

  useEffect(() => {
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
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('home.welcome')}, {profile?.name}!</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{t('home.trackProgress')}</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-900/30">
            <div className={profile?.completedTest ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
              {profile?.completedTest ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              {profile?.completedTest ? t('home.testCompleted') : t('home.testPending')}
            </span>
          </div>
        </div>
      </div>

      {score && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('home.profileTitle')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">{t('home.primaryTrait')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white capitalize">{score.primaryTrait}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('home.primaryTraitDesc')}</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('home.secondaryTrait')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white capitalize">{score.secondaryTrait}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{t('home.secondaryTraitDesc')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1: Registration */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5">
            <ClipboardList className="w-16 h-16 dark:text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">1</div>
            <h3 className="font-bold text-slate-900 dark:text-white">{t('home.step1')}</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('home.step1Desc')}</p>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            {t('home.completed')}
          </div>
        </div>

        {/* Step 2: MCQ Test */}
        <div className={profile?.completedTest ? "bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors" : "bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none relative overflow-hidden text-white"}>
          <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5">
            <HelpCircle className="w-16 h-16 dark:text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full ${profile?.completedTest ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-white/20 text-white'} flex items-center justify-center font-bold`}>2</div>
            <h3 className="font-bold">{t('home.step2')}</h3>
          </div>
          <p className={`text-sm mb-4 ${profile?.completedTest ? 'text-slate-600 dark:text-slate-400' : 'text-indigo-100'}`}>
            {t('home.step2Desc')}
          </p>
          {profile?.completedTest ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              {t('home.completed')}
            </div>
          ) : (
            <Link 
              to="/test" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors"
            >
              {t('home.startTest')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Step 3: Team Assignment */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-5">
            <Users className="w-16 h-16 dark:text-white" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full ${profile?.assignedTeamId ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'} flex items-center justify-center font-bold`}>3</div>
            <h3 className="font-bold text-slate-900 dark:text-white">{t('home.step3')}</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('home.step3Desc')}</p>
          {profile?.assignedTeamId ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              {t('home.completed')}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm font-semibold italic">
              <Clock className="w-4 h-4" />
              {t('home.waitingAdmin')}
            </div>
          )}
        </div>
      </div>

      {team && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-8 transition-colors">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Trophy className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('home.yourTeam')}: {team.name}</h2>
              <p className="text-indigo-600 dark:text-indigo-400 font-medium">{t('home.assignedSuccess')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">{t('home.teamSize')}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{team.memberCount} {t('home.members')}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">{t('home.capacity')}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{team.minSize} - {team.maxSize} {t('home.members')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
