import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, writeBatch, doc, getDocsFromServer } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserScore, Team } from '../types';
import { Users, CheckCircle2, Clock, Trophy, TrendingUp, BarChart3, RotateCcw, Trash2, Download, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState({
    totalApplicants: 0,
    completedTests: 0,
    pendingUsers: 0,
    totalTeams: 0
  });
  const [traitDistribution, setTraitDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topLeaders, setTopLeaders] = useState<any[]>([]);
  const [highRiskUsers, setHighRiskUsers] = useState<any[]>([]);
  const [balancedUsers, setBalancedUsers] = useState<any[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Use getDocsFromServer to ensure we avoid stale data
      let usersSnap;
      try {
        usersSnap = await getDocsFromServer(collection(db, 'users'));
      } catch (error) {
        // Fallback to cache if offline
        usersSnap = await getDocs(collection(db, 'users'));
      }
      
      const users = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      const applicants = users.filter(u => u.role === 'applicant');
      
      let teamsSnap;
      try {
        teamsSnap = await getDocsFromServer(collection(db, 'teams'));
      } catch (error) {
        teamsSnap = await getDocs(collection(db, 'teams'));
      }

      let scoresSnap;
      try {
        scoresSnap = await getDocsFromServer(collection(db, 'scores'));
      } catch (error) {
        scoresSnap = await getDocs(collection(db, 'scores'));
      }

      const scores = scoresSnap.docs.map(doc => doc.data() as UserScore);
      
      // Filter scores to only include current active applicants
      const applicantScores = scores.filter(s => {
        const u = users.find(user => user.uid === s.userId);
        return u && u.role === 'applicant';
      });

      // Calculate Top Leaders
      const sortedLeaders = [...applicantScores]
        .sort((a, b) => b.leaderScore - a.leaderScore)
        .slice(0, 5)
        .map(s => ({
          ...s,
          name: users.find(u => u.uid === s.userId)?.name || 'Unknown'
        }));
      setTopLeaders(sortedLeaders);

      // Calculate High Risk (Neuroticism > 4.0)
      const highRisk = applicantScores.filter(s => s.traits.N > 4.0).map(s => ({
        ...s,
        name: users.find(u => u.uid === s.userId)?.name || 'Unknown'
      }));
      setHighRiskUsers(highRisk);

      // Calculate Balanced Users (All traits between 2.5 and 3.5)
      const balanced = applicantScores.filter(s => 
        Object.values(s.traits).every(v => (v as number) >= 2.5 && (v as number) <= 3.5)
      ).map(s => ({
        ...s,
        name: users.find(u => u.uid === s.userId)?.name || 'Unknown'
      }));
      setBalancedUsers(balanced);

      const distribution: Record<string, number> = {
        O: 0,
        C: 0,
        E: 0,
        A: 0,
        N: 0
      };

      const traitLabels: Record<string, string> = {
        O: language === 'ar' ? 'الانفتاح' : 'Openness',
        C: language === 'ar' ? 'الضمير' : 'Conscientiousness',
        E: language === 'ar' ? 'الانبساط' : 'Extraversion',
        A: language === 'ar' ? 'الوفاق' : 'Agreeableness',
        N: language === 'ar' ? 'العصابية' : 'Neuroticism'
      };

      applicantScores.forEach(score => {
        if (score.primaryTrait && distribution[score.primaryTrait] !== undefined) {
          distribution[score.primaryTrait]++;
        }
      });

      const chartData = Object.entries(distribution).map(([key, value]) => ({
        name: traitLabels[key],
        value
      }));

      setTraitDistribution(chartData);
      
      setStats({
        totalApplicants: applicants.length,
        completedTests: applicants.filter(u => u.completedTest).length,
        pendingUsers: applicants.filter(u => !u.completedTest).length,
        totalTeams: teamsSnap.size
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error(language === 'ar' ? "فشل تحديث الإحصائيات" : "Failed to refresh statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  const handleResetSystem = async () => {
    setIsResetting(true);
    setShowResetConfirm(false);
    try {
      // 1. Reset student progress in users collection
      const usersSnap = await getDocs(collection(db, 'users'));
      const applicants = usersSnap.docs.filter(d => d.data().role === 'applicant');
      
      // Update users in smaller chunks to avoid batch limits
      function chunk<T>(arr: T[], size: number): T[][] {
        return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      }

      for (const studentChunk of chunk(applicants, 100)) {
        const batch = writeBatch(db);
        studentChunk.forEach(student => {
          batch.update(doc(db, 'users', student.id), {
            completedTest: false,
            assignedTeamId: null,
            attendedSessionsCount: 0,
            absentSessionsCount: 0,
            isBlocked: false
          });
        });
        await batch.commit();
      }

      // 2. Clear bulk collections (Performance data)
      const bulkCols = ['scores', 'responses', 'sessionQuizResults', 'sessionFeedbacks', 'assignments'];
      for (const col of bulkCols) {
        const snap = await getDocs(collection(db, col));
        for (const docChunk of chunk(snap.docs, 100)) {
          const batch = writeBatch(db);
          docChunk.forEach(d => batch.delete(doc(db, col, d.id)));
          await batch.commit();
        }
      }

      // 3. Reset team counts
      const teamsSnap = await getDocs(collection(db, 'teams'));
      const teamsBatch = writeBatch(db);
      teamsSnap.docs.forEach(d => teamsBatch.update(doc(db, 'teams', d.id), { memberCount: 0 }));
      await teamsBatch.commit();

      await fetchStats();
      toast.success(language === 'ar' ? "تم تصفير تقدم الطلاب بنجاح مع الاحتفاظ بحساباتهم" : "Scores reset successfully, student accounts preserved");
    } catch (error) {
      console.error("Error resetting system:", error);
      toast.error(language === 'ar' ? "فشل تصفير النظام" : "Failed to reset system");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="text-error" size={32} />
            </div>
            <h3 className="text-2xl font-black text-primary text-center mb-4 tracking-tight">
              {language === 'ar' ? 'تصفير كافة البيانات؟' : 'Reset All Data?'}
            </h3>
            <p className="text-on-surface-variant text-center mb-8 leading-relaxed font-medium">
              {language === 'ar' 
                ? 'هل أنت متأكد من مسح جميع نتائج الاختبارات؟ سيتم الاحتفاظ بحسابات الطلاب ولكن سيتم تصفير تقدمهم ونتائجهم بالكامل.' 
                : 'Are you sure you want to reset all test results? Student accounts will be kept but their progress and scores will be permanently cleared.'}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-colors uppercase tracking-widest text-[10px]"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleResetSystem}
                className="flex-[2] py-4 bg-error text-white font-bold rounded-2xl shadow-lg shadow-error/30 hover:opacity-90 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                {language === 'ar' ? 'تصفير الآن' : 'Reset Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section: Dashboard Overview (Bento Grid) */}
      <section id="dashboard">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-primary font-bold tracking-tight text-sm mb-1 uppercase">{t('admin.analytics')}</p>
            <h2 className="text-4xl font-extrabold text-primary tracking-tighter">{t('admin.systemPerformance')}</h2>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setShowResetConfirm(true)}
              disabled={isResetting}
              className="bg-error text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-error/20"
            >
              {isResetting ? <RotateCcw size={18} className="animate-spin" /> : <Trash2 size={18} />}
              {language === 'ar' ? 'تصفير كافة البيانات' : 'Reset All Data'}
            </button>
            <button className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity shadow-lg shadow-primary/20">
              <Download size={18} />
              {t('admin.export')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Large Card: Active Users Flow */}
          <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0px_12px_32px_rgba(0,76,82,0.04)] relative overflow-hidden group border border-outline-variant/10">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <span className="material-symbols-outlined text-8xl text-primary">trending_up</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-6">{t('admin.engagement')}</h3>
              <div className="flex items-baseline gap-4 mb-10">
                <span className="text-5xl font-black text-primary tracking-tighter">
                  {stats.totalApplicants > 1000 ? `${(stats.totalApplicants / 1000).toFixed(1)}k` : stats.totalApplicants}
                </span>
                <span className="text-secondary font-bold text-sm bg-secondary-fixed px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">arrow_upward</span>
                  12.4%
                </span>
              </div>
              
              {/* Animated Chart Bars */}
              <div className="h-48 w-full flex items-end gap-3 mt-4">
                {[40, 65, 50, 85, 45, 70, 90, 60, 75, 55].map((height, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-full rounded-t-lg transition-all duration-500",
                      i === 5 ? "bg-secondary" : "bg-primary/10 group-hover:bg-primary/30 dark:bg-primary/20 dark:group-hover:bg-primary/40"
                    )}
                    style={{ height: `${height}%` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* Vertical Stats */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0px_12px_32px_rgba(0,76,82,0.04)] border border-outline-variant/10">
              <span className="material-symbols-outlined text-secondary mb-4">bolt</span>
              <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">{t('admin.evalSpeed')}</p>
              <p className="text-3xl font-black text-primary mt-1">1.2s</p>
              <p className="text-xs text-on-surface-variant/60 mt-2">{t('admin.latency')}</p>
            </div>
            
            <div className="bg-primary text-on-primary rounded-xl p-6 shadow-[0px_12px_32px_rgba(0,76,82,0.1)] dark:bg-surface-container-lowest dark:text-on-surface dark:border dark:border-outline-variant/10">
              <span className="material-symbols-outlined text-on-primary dark:text-primary mb-4">workspace_premium</span>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">{t('admin.precision')}</p>
              <p className="text-3xl font-black mt-1">99.4%</p>
              <div className="w-full bg-on-primary/20 dark:bg-surface-container-high h-1.5 rounded-full mt-4">
                <div className="bg-on-primary dark:bg-primary w-[99.4%] h-full rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trait Distribution Chart Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <BarChart3 className="text-primary w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-primary tracking-tight">{t('admin.traitDist')}</h3>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={traitDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-outline-variant/20" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-on-surface-variant"
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'currentColor', fontSize: 12 }}
                  className="text-on-surface-variant"
                />
                <Tooltip 
                  cursor={{ fill: 'currentColor', className: 'text-surface-container-high/20' }}
                  contentStyle={{ 
                    backgroundColor: 'var(--color-surface-container-lowest)', 
                    border: '1px solid var(--color-outline-variant)', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: 'var(--color-on-surface)', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {traitDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="var(--color-primary)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Trophy className="text-secondary w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-primary tracking-tight">
              {language === 'ar' ? 'أفضل القادة' : 'Top Leaders'}
            </h3>
          </div>
          <div className="space-y-4">
            {topLeaders.map((leader, idx) => (
              <div key={leader.userId} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{leader.name}</p>
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{leader.personalityType}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary">{leader.leaderScore.toFixed(2)}</p>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">{leader.leadershipPotential}</p>
                </div>
              </div>
            ))}
            {topLeaders.length === 0 && (
              <p className="text-center text-on-surface-variant py-8 italic">
                {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Risk & Balance Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
              <TrendingUp className="text-error w-6 h-6 rotate-180" />
            </div>
            <h3 className="text-2xl font-bold text-primary tracking-tight">
              {language === 'ar' ? 'مخاطر عالية (عصابية مرتفعة)' : 'High Risk (High Neuroticism)'}
            </h3>
          </div>
          <div className="space-y-3">
            {highRiskUsers.slice(0, 5).map((u) => (
              <div key={u.userId} className="flex items-center justify-between p-3 border border-error/10 rounded-xl bg-error/5">
                <span className="text-sm font-bold text-primary">{u.name}</span>
                <span className="text-xs font-black text-error">N: {u.traits.N.toFixed(1)}</span>
              </div>
            ))}
            {highRiskUsers.length === 0 && (
              <p className="text-center text-on-surface-variant py-8 italic">
                {language === 'ar' ? 'لا يوجد مستخدمون ذوو مخاطر عالية' : 'No high risk users found'}
              </p>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Users className="text-emerald-600 w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-primary tracking-tight">
              {language === 'ar' ? 'مستخدمون متوازنون' : 'Balanced Users'}
            </h3>
          </div>
          <div className="space-y-3">
            {balancedUsers.slice(0, 5).map((u) => (
              <div key={u.userId} className="flex items-center justify-between p-3 border border-emerald-100 rounded-xl bg-emerald-50">
                <span className="text-sm font-bold text-primary">{u.name}</span>
                <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Balanced Profile</span>
              </div>
            ))}
            {balancedUsers.length === 0 && (
              <p className="text-center text-on-surface-variant py-8 italic">
                {language === 'ar' ? 'لا يوجد مستخدمون متوازنون' : 'No balanced users found'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={t('admin.totalApplicants')} 
          value={stats.totalApplicants} 
          icon="group" 
          color="text-primary bg-primary/10 dark:bg-primary/20" 
        />
        <StatCard 
          title={t('admin.completedTests')} 
          value={stats.completedTests} 
          icon="check_circle" 
          color="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400" 
        />
        <StatCard 
          title={t('admin.pendingUsers')} 
          value={stats.pendingUsers} 
          icon="timer" 
          color="text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" 
        />
        <StatCard 
          title={t('admin.totalTeams')} 
          value={stats.totalTeams} 
          icon="diversity_3" 
          color="text-secondary bg-secondary/10 dark:bg-secondary/20" 
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", color)}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider">{title}</h3>
      <p className="text-3xl font-black text-primary mt-1">{value}</p>
    </div>
  );
}

function HealthItem({ label, status, color }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className={cn("text-sm font-bold", color)}>{status}</span>
    </div>
  );
}

function ActivityItem({ text, time }: any) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{text}</span>
      <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">{time}</span>
    </div>
  );
}
