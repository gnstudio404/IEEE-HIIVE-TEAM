import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserScore, Team } from '../types';
import { toast } from 'sonner';
import { Search, Filter, User, Mail, Building, CheckCircle2, Clock, MoreVertical, ExternalLink, Trash2, AlertTriangle, Phone, Globe, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';
import * as XLSX from 'xlsx';

export default function AdminApplicants() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [applicants, setApplicants] = useState<UserProfile[]>([]);
  const [scores, setScores] = useState<Record<string, UserScore>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'blocked'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const downloadExcel = () => {
    const data = filteredApplicants.map(u => {
      const score = scores[u.uid];
      return {
        [language === 'ar' ? 'الاسم' : 'Name']: u.name,
        [language === 'ar' ? 'البريد الإلكتروني' : 'Email']: u.email,
        [language === 'ar' ? 'الهاتف' : 'Phone']: u.phone || 'N/A',
        [language === 'ar' ? 'القسم' : 'Department']: u.department || 'N/A',
        [language === 'ar' ? 'الدولة' : 'Country']: u.country || 'N/A',
        [language === 'ar' ? 'الدور' : 'Role']: u.role,
        [language === 'ar' ? 'حالة الحظر' : 'Block Status']: u.isBlocked ? (language === 'ar' ? 'محظور' : 'Blocked') : (language === 'ar' ? 'نشط' : 'Active'),
        [language === 'ar' ? 'حالة الاختبار' : 'Test Status']: u.completedTest ? (language === 'ar' ? 'مكتمل' : 'Completed') : (language === 'ar' ? 'معلق' : 'Pending'),
        [language === 'ar' ? 'الدور المقترح' : 'Suggested Role']: score ? (language === 'ar' ? score.personalityTypeAr : score.personalityType) : 'N/A',
        [language === 'ar' ? 'المهمة الأنسب' : 'Best Role']: score ? (language === 'ar' ? score.bestRoleAr : score.bestRole) : 'N/A',
        [language === 'ar' ? 'درجة القيادة' : 'Leader Score']: score?.leaderScore?.toFixed(2) || 'N/A',
        [language === 'ar' ? 'إمكانية القيادة' : 'Leadership Potential']: score?.leadershipPotential || 'N/A',
        [language === 'ar' ? 'الفريق' : 'Team']: teams.find(t => t.id === u.assignedTeamId)?.name || (language === 'ar' ? 'بدون فريق' : 'No Team'),
        [language === 'ar' ? 'تاريخ التسجيل' : 'Created At']: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Set column widths
    const colWidths = [
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Department
      { wch: 15 }, // Country
      { wch: 12 }, // Role
      { wch: 15 }, // Block Status
      { wch: 15 }, // Test Status
      { wch: 15 }, // Suggested Role
      { wch: 15 }, // Leader Score
      { wch: 20 }, // Team
      { wch: 15 }, // Created At
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applicants");
    XLSX.writeFile(workbook, `HIIVE_Applicants_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const SUPER_ADMIN_EMAIL = 'omarwork1011@gmail.com';

  const fetchData = async () => {
    try {
      let usersSnap;
      try {
        usersSnap = await getDocs(collection(db, 'users'));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
        return;
      }
      const applicantsData = usersSnap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      
      let scoresSnap;
      try {
        scoresSnap = await getDocs(collection(db, 'scores'));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'scores');
        return;
      }
      const scoresData: Record<string, UserScore> = {};
      scoresSnap.docs.forEach(doc => {
        scoresData[doc.id] = doc.data() as UserScore;
      });

      let teamsSnap;
      try {
        teamsSnap = await getDocs(collection(db, 'teams'));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'teams');
        return;
      }
      const teamsData = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));

      setApplicants(applicantsData);
      setScores(scoresData);
      setTeams(teamsData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (userId: string, newTeamId: string | null) => {
    const user = applicants.find(u => u.uid === userId);
    const oldTeamId = user?.assignedTeamId;

    if (oldTeamId === newTeamId) return;

    try {
      const batch = writeBatch(db);

      // Update user
      batch.update(doc(db, 'users', userId), {
        assignedTeamId: newTeamId
      });

      // Update old team count
      if (oldTeamId) {
        const oldTeam = teams.find(t => t.id === oldTeamId);
        if (oldTeam) {
          batch.update(doc(db, 'teams', oldTeamId), {
            memberCount: Math.max(0, oldTeam.memberCount - 1)
          });
        }
      }

      // Update new team count
      if (newTeamId) {
        const newTeam = teams.find(t => t.id === newTeamId);
        if (newTeam) {
          batch.update(doc(db, 'teams', newTeamId), {
            memberCount: newTeam.memberCount + 1
          });
        }
      }

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-reassign');
        return;
      }
      toast.success("User reassigned successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to reassign user");
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const targetUser = applicants.find(u => u.uid === userId);
    if (targetUser?.email === SUPER_ADMIN_EMAIL) {
      toast.error("This is the main admin account and cannot be modified");
      return;
    }

    if (userId === user?.uid) {
      toast.error("You cannot change your own role");
      return;
    }

    try {
      setRoleLoadingId(userId);
      const newRole = currentRole === 'admin' ? 'applicant' : 'admin';
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      toast.success(newRole === 'admin' ? "User promoted to admin" : "User demoted to applicant");
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
      toast.error("Failed to update user role");
    } finally {
      setRoleLoadingId(null);
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    const targetUser = applicants.find(u => u.uid === userId);
    if (targetUser?.email === SUPER_ADMIN_EMAIL) {
      toast.error("This is the main admin account and cannot be blocked");
      return;
    }

    try {
      setBlockingId(userId);
      await updateDoc(doc(db, 'users', userId), {
        isBlocked: !currentStatus
      });
      toast.success(currentStatus ? "User unblocked successfully" : "User blocked successfully");
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
      toast.error("Failed to update block status");
    } finally {
      setBlockingId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = applicants.find(u => u.uid === userId);
    if (targetUser?.email === SUPER_ADMIN_EMAIL) {
      toast.error("This is the main admin account and cannot be deleted");
      return;
    }

    try {
      const user = applicants.find(u => u.uid === userId);
      const batch = writeBatch(db);

      // Delete user document
      batch.delete(doc(db, 'users', userId));

      // Delete score document
      batch.delete(doc(db, 'scores', userId));

      // Update team count if assigned
      if (user?.assignedTeamId) {
        const team = teams.find(t => t.id === user.assignedTeamId);
        if (team) {
          batch.update(doc(db, 'teams', user.assignedTeamId), {
            memberCount: Math.max(0, team.memberCount - 1)
          });
        }
      }

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
        return;
      }
      toast.success("User data deleted successfully");
      setDeletingId(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      const errorMessage = error?.message || "Failed to delete user";
      toast.error(`Delete failed: ${errorMessage}`);
    }
  };

  const filteredApplicants = applicants.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'completed' && u.completedTest) || 
                         (filter === 'pending' && !u.completedTest) ||
                         (filter === 'blocked' && u.isBlocked);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-12">
      <section id="users">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-primary font-bold tracking-tight text-sm mb-1 uppercase">{t('admin.identityManagement')}</p>
            <h2 className="text-4xl font-extrabold text-primary tracking-tighter">{t('admin.applicants')}</h2>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={downloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              <Download size={18} />
              {language === 'ar' ? 'تحميل البيانات' : 'Download Data'}
            </button>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-sm">search</span>
              <input 
                className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:ring-1 focus:ring-primary w-64 transition-all" 
                placeholder={t('admin.search')} 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-surface-container-low p-1 rounded-xl">
              {(['all', 'completed', 'pending', 'blocked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                    filter === f ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-primary"
                  )}
                >
                  {f === 'blocked' ? (language === 'ar' ? 'المحظورين' : 'Blocked') : t(`admin.${f}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(0,76,82,0.04)] border border-outline-variant/10">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">{t('admin.name')}</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">{language === 'ar' ? 'الدور المقترح' : 'Suggested Role'}</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">{t('admin.status')}</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant/70">{t('admin.team')}</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant/70 text-right">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredApplicants.map((u) => {
                const team = teams.find(t => t.id === u.assignedTeamId);
                const score = scores[u.uid];
                return (
                  <tr key={u.uid} className="hover:bg-surface-container/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setSelectedUser(u)}>
                        <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden border border-outline-variant/20 flex items-center justify-center group-hover:border-primary transition-colors">
                          {u.photoURL ? (
                            <img 
                              className="w-full h-full object-cover" 
                              src={u.photoURL} 
                              alt={u.name}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-on-surface-variant/40">person</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-primary group-hover:underline">{u.name}</p>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {score ? (
                        <div className="flex flex-col">
                          <span className="font-black text-primary text-sm tracking-tighter">
                            {score.personalityType === 'The Leader'
                              ? (language === 'ar' ? score.personalityTypeAr : score.personalityType)
                              : (language === 'ar' ? 'عضو فريق' : 'Team Member')
                            }
                          </span>
                          <span className="text-[10px] text-secondary font-bold uppercase tracking-widest">
                            {language === 'ar' ? score.personalityTypeAr : score.personalityType}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-on-surface-variant/50 italic">
                          {language === 'ar' ? 'لم يكتمل' : 'Not Completed'}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-medium",
                        u.completedTest ? "text-emerald-600" : "text-amber-600"
                      )}>
                        <span className={cn("w-2 h-2 rounded-full", u.completedTest ? "bg-emerald-600" : "bg-amber-600")}></span>
                        {u.completedTest ? t('admin.completed') : t('admin.pending')}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <select
                        value={u.assignedTeamId || ''}
                        onChange={(e) => handleReassign(u.uid, e.target.value || null)}
                        className="text-xs font-bold text-primary bg-transparent border-none focus:ring-0 cursor-pointer hover:underline p-0"
                      >
                        <option value="">{t('admin.noTeam')}</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleToggleRole(u.uid, u.role)}
                          disabled={u.uid === user?.uid || roleLoadingId === u.uid || u.email === SUPER_ADMIN_EMAIL}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            u.role === 'admin' 
                              ? "bg-primary/10 text-primary hover:bg-primary/20" 
                              : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
                            u.email === SUPER_ADMIN_EMAIL && "hidden"
                          )}
                          title={u.email === SUPER_ADMIN_EMAIL ? (language === 'ar' ? 'حساب المسؤول الرئيسي' : 'Main Admin Account') : (u.role === 'admin' ? (language === 'ar' ? 'تنزيل لمرتبة مستخدم' : 'Demote to Applicant') : (language === 'ar' ? 'تعيين كمسؤول' : 'Promote to Admin'))}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {u.role === 'admin' ? 'person_remove' : 'admin_panel_settings'}
                          </span>
                        </button>

                        <button 
                          onClick={() => handleToggleBlock(u.uid, !!u.isBlocked)}
                          disabled={u.uid === user?.uid || blockingId === u.uid || u.email === SUPER_ADMIN_EMAIL}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            u.isBlocked 
                              ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200" 
                              : "bg-amber-100 text-amber-600 hover:bg-amber-200",
                            u.email === SUPER_ADMIN_EMAIL && "hidden"
                          )}
                          title={u.email === SUPER_ADMIN_EMAIL ? (language === 'ar' ? 'حساب المسؤول الرئيسي' : 'Main Admin Account') : (u.isBlocked ? (language === 'ar' ? 'إلغاء الحظر' : 'Unblock') : (language === 'ar' ? 'حظر' : 'Block'))}
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            {u.isBlocked ? 'person_check' : 'block'}
                          </span>
                        </button>

                        {deletingId === u.uid ? (
                          <button onClick={() => handleDeleteUser(u.uid)} className="text-error hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                          </button>
                        ) : (
                          <button onClick={() => setDeletingId(u.uid)} disabled={u.uid === user?.uid || u.email === SUPER_ADMIN_EMAIL} className={cn("text-on-surface-variant hover:text-error transition-colors disabled:opacity-0", u.email === SUPER_ADMIN_EMAIL && "hidden")}>
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredApplicants.length === 0 && (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant/30 mb-4">person_search</span>
              <p className="text-on-surface-variant font-medium">{t('admin.noUsersFound')}</p>
            </div>
          )}
        </div>
      </section>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="relative h-32 bg-primary">
              <button 
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="px-8 pb-8">
              <div className="relative -mt-16 mb-6">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-surface-container-lowest shadow-xl bg-surface-container">
                  <img 
                    src={selectedUser.photoURL || "https://picsum.photos/seed/user/200/200"} 
                    alt={selectedUser.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black text-primary tracking-tighter">{selectedUser.name}</h3>
                  <p className="text-on-surface-variant font-medium">{selectedUser.email}</p>
                </div>
                <div className="px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest">
                  {selectedUser.role}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                    {t('register.phone')}
                  </p>
                  <p className="font-bold text-primary flex items-center gap-2">
                    <Phone size={14} />
                    {selectedUser.phone || 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                    {t('register.department')}
                  </p>
                  <p className="font-bold text-primary flex items-center gap-2">
                    <Building size={14} />
                    {selectedUser.department || 'N/A'}
                  </p>
                </div>
                
                {scores[selectedUser.uid] && (
                  <div className="col-span-2 p-6 bg-surface-container-low rounded-2xl">
                    <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest mb-4">
                      {language === 'ar' ? 'نتائج اختبار الشخصية' : 'Personality Test Results'}
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(scores[selectedUser.uid].traits).map(([trait, value]) => (
                        <div key={trait} className="text-center">
                          <div className="text-lg font-black text-primary">{(value as number).toFixed(1)}</div>
                          <div className="text-[8px] font-bold uppercase text-on-surface-variant/70">{trait}</div>
                          <div className="mt-1 h-1 bg-surface-container-high rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-1000" 
                              style={{ width: `${((value as number) / 5) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
                          {language === 'ar' ? 'الدور المقترح' : 'Suggested Role'}
                        </span>
                        <span className="text-xl font-black text-primary tracking-tighter">
                          {scores[selectedUser.uid].personalityType === 'The Leader'
                            ? (language === 'ar' ? scores[selectedUser.uid].personalityTypeAr : scores[selectedUser.uid].personalityType)
                            : (language === 'ar' ? 'عضو فريق' : 'Team Member')
                          }
                        </span>
                        <span className="text-xs font-bold text-secondary block mt-1">
                          {language === 'ar' ? scores[selectedUser.uid].personalityTypeAr : scores[selectedUser.uid].personalityType}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
                          {language === 'ar' ? 'درجة القيادة' : 'Leader Score'}
                        </span>
                        <span className="text-xl font-black text-primary tracking-tighter">
                          {scores[selectedUser.uid].leaderScore.toFixed(2)}
                        </span>
                        <div className={cn(
                          "text-[10px] font-black px-2 py-0.5 rounded-full inline-block mt-1",
                          scores[selectedUser.uid].leadershipPotential === 'High' ? "bg-emerald-100 text-emerald-700" :
                          scores[selectedUser.uid].leadershipPotential === 'Medium' ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {scores[selectedUser.uid].leadershipPotential}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="col-span-2 space-y-1">
                  <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                    {language === 'ar' ? 'نبذة شخصية' : 'Bio'}
                  </p>
                  <p className="text-on-surface-variant leading-relaxed bg-surface-container-low p-4 rounded-2xl italic">
                    {selectedUser.bio || (language === 'ar' ? 'لا توجد نبذة شخصية متاحة.' : 'No bio available.')}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-outline-variant/10 flex justify-end">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  {language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
