import React, { useState, useEffect, ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, writeBatch, query, where, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserScore, Team } from '../types';
import { toast } from 'sonner';
import { Search, Filter, User, Mail, Building, CheckCircle2, Clock, MoreVertical, ExternalLink, Trash2, AlertTriangle, Phone, Globe, Download, Ban, UserCog, UserMinus, RotateCcw, X, Upload, Plus, Shield } from 'lucide-react';
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
  const [uploadingAllowlist, setUploadingAllowlist] = useState(false);
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAddManualEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = manualEmail.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      toast.error(language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email');
      return;
    }

    setIsAddingManual(true);
    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'allowed_emails', cleanEmail), {
        email: cleanEmail,
        addedAt: new Date().toISOString(),
        addedManually: true
      });

      toast.success(language === 'ar' ? 'تم إضافة الإيميل بنجاح!' : 'Email added successfully!');
      setManualEmail('');
      setIsManualAddModalOpen(false);
    } catch (error) {
      console.error("Error adding email manually:", error);
      toast.error(language === 'ar' ? 'فشل إضافة الإيميل' : 'Failed to add email');
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleAllowlistUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAllowlist(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const emails = data
          .map(row => {
            const emailKey = Object.keys(row).find(k => k.toLowerCase() === 'email');
            return emailKey ? row[emailKey]?.toString().trim().toLowerCase() : null;
          })
          .filter(email => email && isValidEmail(email));

        if (emails.length === 0) {
          toast.error(language === 'ar' ? 'لم يتم العثور على إيميلات صالحة في الملف' : 'No valid emails found in file');
          return;
        }

        const batch = writeBatch(db);
        emails.forEach(email => {
          batch.set(doc(db, 'allowed_emails', email), {
            email,
            addedAt: new Date().toISOString()
          });
        });

        await batch.commit();
        toast.success(language === 'ar' ? `تم إضافة ${emails.length} إيميل للقائمة المسموحة!` : `Added ${emails.length} emails to allowlist!`);
      } catch (error) {
        console.error("Error uploading allowlist:", error);
        toast.error(language === 'ar' ? 'فشل حتي رفع القائمة' : 'Failed to upload allowlist');
      } finally {
        setUploadingAllowlist(false);
      }
    };
    reader.readAsBinaryString(file);
  };

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
      setDeletingId(userId);
      const user = applicants.find(u => u.uid === userId);
      const batch = writeBatch(db);

      // 1. Delete associated data in other collections
      const collectionsToClean = ['responses', 'sessionQuizResults', 'sessionFeedbacks', 'assignments'];
      for (const colName of collectionsToClean) {
        const q = query(collection(db, colName), where('userId', '==', userId));
        const snap = await getDocs(q);
        snap.docs.forEach(d => batch.delete(doc(db, colName, d.id)));
      }

      // 2. Delete user document
      batch.delete(doc(db, 'users', userId));

      // 3. Delete score document
      batch.delete(doc(db, 'scores', userId));

      // 4. Update team count if assigned
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
      toast.success(language === 'ar' ? "تم مسح بيانات المستخدم بالكامل" : "User data deleted successfully");
      setDeletingId(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      const errorMessage = error?.message || "Failed to delete user";
      toast.error(`Delete failed: ${errorMessage}`);
      setDeletingId(null);
    }
  };

  const handleResetSystem = async () => {
    setLoading(true);
    setIsResetConfirmOpen(false);
    try {
      // Helper to chunk arrays
      function chunk<T>(arr: T[], size: number): T[][] {
        return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      }

      // 1. Reset student progress in users collection
      const usersSnap = await getDocs(collection(db, 'users'));
      const applicantsToReset = usersSnap.docs.filter(d => d.data().role === 'applicant');
      
      for (const studentChunk of chunk(applicantsToReset, 100)) {
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

      toast.success(language === 'ar' ? "تم تصفير تقدم الطلاب بنجاح مع الاحتفاظ بحساباتهم" : "Scores reset successfully, student accounts preserved");
      fetchData();
    } catch (error) {
      console.error("Error resetting system:", error);
      toast.error(language === 'ar' ? "فشل تصفير النظام" : "Failed to reset system");
    } finally {
      setLoading(false);
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
        <div className="mb-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-primary font-bold tracking-tight text-sm mb-1 uppercase">{t('admin.identityManagement')}</p>
              <h2 className="text-4xl font-extrabold text-primary tracking-tighter">{t('admin.applicants')}</h2>
            </div>
            <div className="flex flex-wrap gap-3 justify-end max-w-2xl">
              <label className={cn(
                "flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-secondary/20 cursor-pointer",
                uploadingAllowlist && "opacity-50 cursor-wait"
              )}>
                {uploadingAllowlist ? <RotateCcw size={18} className="animate-spin" /> : <Upload size={18} />}
                {language === 'ar' ? 'رفع ملف' : 'Upload File'}
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleAllowlistUpload} disabled={uploadingAllowlist} />
              </label>
              <button 
                onClick={() => setIsManualAddModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-tertiary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-tertiary/20"
              >
                <Plus size={18} />
                {language === 'ar' ? 'إضافة يدوي' : 'Add Manually'}
              </button>
              <button 
                onClick={downloadExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                <Download size={18} />
                {language === 'ar' ? 'تحميل البيانات' : 'Download Data'}
              </button>
              <button 
                onClick={() => setIsResetConfirmOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-error text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-error/20"
              >
                <RotateCcw size={18} />
                {language === 'ar' ? 'تصفير النظام' : 'Reset System'}
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-surface-container-low/30 p-4 rounded-2xl border border-outline-variant/10">
            <div className="relative w-full md:w-96">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-sm">search</span>
              <input 
                className="w-full pl-11 pr-4 py-3 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:text-on-surface-variant/30" 
                placeholder={t('admin.search')} 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-surface-container-lowest p-1.5 rounded-2xl border border-outline-variant/5 shadow-sm">
              {(['all', 'completed', 'pending', 'blocked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                    filter === f 
                      ? "bg-primary text-white shadow-md shadow-primary/20" 
                      : "text-on-surface-variant/60 hover:text-primary hover:bg-surface-container-low"
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
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-primary group-hover:underline">{u.name}</p>
                            {u.role === 'admin' && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-md uppercase tracking-tighter border border-primary/20">
                                <Shield size={10} className="fill-primary/20" />
                                {language === 'ar' ? 'مسؤول' : 'Admin'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {u.role === 'admin' ? (
                        <div className="flex flex-col">
                          <span className="font-black text-primary text-sm tracking-tighter uppercase italic flex items-center gap-1">
                            <Shield size={12} className="text-secondary" />
                            {language === 'ar' ? 'مسؤول النظام' : 'System Admin'}
                          </span>
                          <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase tracking-widest">
                            {language === 'ar' ? 'صلاحيات كاملة' : 'Full Access'}
                          </span>
                        </div>
                      ) : score ? (
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
                      <div className="flex items-center justify-end gap-3">
                        {/* Manage Role Button */}
                        <button 
                          onClick={() => handleToggleRole(u.uid, u.role)}
                          disabled={u.uid === user?.uid || roleLoadingId === u.uid || u.email === SUPER_ADMIN_EMAIL}
                          className={cn(
                            "transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-0",
                            u.role === 'admin' ? "text-cyan-400" : "text-cyan-400/60 hover:text-cyan-400",
                            u.email === SUPER_ADMIN_EMAIL && "hidden"
                          )}
                          title={u.email === SUPER_ADMIN_EMAIL ? (language === 'ar' ? 'حساب المسؤول الرئيسي' : 'Main Admin Account') : (u.role === 'admin' ? (language === 'ar' ? 'تنزيل لمرتبة مستخدم' : 'Demote to Applicant') : (language === 'ar' ? 'تعيين كمسؤول' : 'Promote to Admin'))}
                        >
                          <UserCog size={22} className={cn(roleLoadingId === u.uid && "animate-spin")} />
                        </button>

                        {/* Block Button */}
                        <button 
                          onClick={() => handleToggleBlock(u.uid, !!u.isBlocked)}
                          disabled={u.uid === user?.uid || blockingId === u.uid || u.email === SUPER_ADMIN_EMAIL}
                          className={cn(
                            "transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-0",
                            u.isBlocked ? "text-orange-500" : "text-orange-500/60 hover:text-orange-500",
                            u.email === SUPER_ADMIN_EMAIL && "hidden"
                          )}
                          title={u.email === SUPER_ADMIN_EMAIL ? (language === 'ar' ? 'حساب المسؤول الرئيسي' : 'Main Admin Account') : (u.isBlocked ? (language === 'ar' ? 'إلغاء الحظر' : 'Unblock') : (language === 'ar' ? 'حظر' : 'Block'))}
                        >
                          {u.isBlocked ? <RotateCcw size={22} /> : <Ban size={22} />}
                        </button>

                        {/* Delete Button */}
                        {deletingId === u.uid ? (
                          <div className="flex items-center gap-2 animate-in zoom-in duration-200">
                             <button 
                               onClick={() => handleDeleteUser(u.uid)} 
                               className="p-1 px-3 bg-error text-white text-[10px] font-black rounded-full hover:bg-error-dark"
                             >
                               {language === 'ar' ? 'تأكيد' : 'CONFIRM'}
                             </button>
                             <button 
                               onClick={() => setDeletingId(null)} 
                               className="text-on-surface-variant hover:text-primary transition-colors"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(u.uid)} 
                            disabled={u.uid === user?.uid || u.email === SUPER_ADMIN_EMAIL} 
                            className={cn(
                              "text-on-surface-variant/40 hover:text-white transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-0", 
                              u.email === SUPER_ADMIN_EMAIL && "hidden"
                            )}
                          >
                            <Trash2 size={22} />
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
                    {language === 'ar' ? 'حضور' : 'Attended'}
                  </p>
                  <p className="font-bold text-primary flex items-center gap-2 text-sm">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    {selectedUser.attendedSessionsCount ?? 0}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-on-surface-variant/50 uppercase tracking-widest">
                    {language === 'ar' ? 'غياب' : 'Absent'}
                  </p>
                  <p className="font-bold text-error flex items-center gap-2 text-sm">
                    <Clock size={12} />
                    {selectedUser.absentSessionsCount ?? 0}
                  </p>
                </div>

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

      {/* Manual Email Modal */}
      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-md w-full shadow-2xl border border-outline-variant/20 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <RotateCcw className="text-error" size={32} />
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
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-colors uppercase tracking-widest text-[10px]"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleResetSystem}
                className="flex-[2] py-4 bg-error text-white font-bold rounded-2xl shadow-lg shadow-error/30 hover:opacity-90 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                {language === 'ar' ? 'تصفير الآن' : 'Reset Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isManualAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            onClick={() => setIsManualAddModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/30 animate-in fade-in zoom-in duration-300">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black text-primary tracking-tighter">
                    {language === 'ar' ? 'إضافة إيميل يدوي' : 'Add Email Manually'}
                  </h3>
                  <p className="text-sm text-on-surface-variant font-medium mt-1">
                    {language === 'ar' ? 'أضف بريداً إلكترونياً مسموحاً له بالتسجيل' : 'Add an email permitted to register'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsManualAddModalOpen(false)}
                  className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant/50"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddManualEmail} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-primary/50 uppercase tracking-widest pl-1">
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="example@domain.com"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary transition-all placeholder:text-on-surface-variant/30"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsManualAddModalOpen(false)}
                    className="flex-1 py-4 bg-surface-container-high text-on-surface font-bold rounded-2xl hover:bg-surface-container-highest transition-colors uppercase tracking-widest text-[10px]"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingManual}
                    className="flex-[2] py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:opacity-90 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                  >
                    {isAddingManual ? (
                      <RotateCcw className="animate-spin" size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    {language === 'ar' ? 'إضافة الآن' : 'Add Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
