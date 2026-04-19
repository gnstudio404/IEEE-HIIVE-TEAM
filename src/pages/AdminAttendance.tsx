import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, writeBatch, doc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Download, Users, BarChart2, Trash2, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface AttendanceRow {
  Email: string;
  'Attendance %': number;
  'Sessions Attended': number;
}

export default function AdminAttendance() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stats, setStats] = useState<{ processed: { email: string; name: string; attended: number; absent: number; percentage: number }[]; missing: string[] } | null>(null);
  const [globalStats, setGlobalStats] = useState<{
    total: number;
    avgAttendance: number;
    distribution: { name: string; value: number; color: string }[];
  } | null>(null);

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  const clearAllStats = async () => {
    setClearing(true);
    setShowConfirm(false);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      let batch = writeBatch(db);
      let count = 0;
      
      for (const userDoc of usersSnap.docs) {
        batch.update(doc(db, 'users', userDoc.id), {
          attendancePercentage: deleteField(),
          attendedSessionsCount: deleteField(),
          absentSessionsCount: deleteField(),
          updatedAt: new Date().toISOString()
        });
        count++;

        if (count % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }

      if (count % 400 !== 0) {
        await batch.commit();
      }
      
      setGlobalStats(null);
      setStats(null);
      fetchGlobalStats();
      toast.success(language === 'ar' ? 'تم مسح جميع الإحصائيات بنجاح' : 'All statistics cleared successfully');
    } catch (error) {
      console.error("Error clearing stats:", error);
      toast.error(language === 'ar' ? 'فشل مسح الإحصائيات' : 'Failed to clear statistics');
    } finally {
      setClearing(false);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const attendanceData = usersSnap.docs
        .map(d => d.data())
        .filter(d => d.attendancePercentage !== undefined);

      if (attendanceData.length === 0) {
        setGlobalStats(null);
        return;
      }

      const total = attendanceData.length;
      const sum = attendanceData.reduce((acc, curr) => acc + (curr.attendancePercentage || 0), 0);
      const avg = sum / total;

      const tiers = [
        { name: '0-25%', min: 0, max: 25, value: 0, color: '#ef4444' },
        { name: '25-50%', min: 25, max: 50, value: 0, color: '#f59e0b' },
        { name: '50-75%', min: 50, max: 75, value: 0, color: '#3b82f6' },
        { name: '75-100%', min: 75, max: 101, value: 0, color: '#10b981' },
      ];

      attendanceData.forEach(d => {
        const pct = d.attendancePercentage || 0;
        const tier = tiers.find(t => pct >= t.min && pct < t.max);
        if (tier) tier.value++;
      });

      setGlobalStats({
        total,
        avgAttendance: avg,
        distribution: tiers
      });
    } catch (error) {
      console.error("Error fetching global stats:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStats(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const processed: { email: string; name: string; attended: number; absent: number; percentage: number }[] = [];
        const missingEmails: string[] = [];
        
        const batch = writeBatch(db);
        let count = 0;

        for (const row of data) {
          // Robust key lookup (case-insensitive)
          const findValue = (keys: string[]) => {
            const rowKey = Object.keys(row).find(k => 
              keys.some(searchKey => k.trim().toLowerCase() === searchKey.toLowerCase())
            );
            return rowKey ? row[rowKey] : undefined;
          };

          const email = findValue(['Email', 'email', 'E-mail']);
          const attended = Number(findValue(['Sessions Attended', 'Attended', 'attended'])) || 0;
          const absent = Number(findValue(['Sessions Missed', 'Absent', 'Missed', 'absent'])) || 0;

          if (!email) continue;

          const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            const total = attended + absent;
            const percentage = total > 0 ? (attended / total) * 100 : 0;

            batch.update(doc(db, 'users', userDoc.id), {
              attendancePercentage: Number(percentage.toFixed(1)),
              attendedSessionsCount: Number(attended),
              absentSessionsCount: Number(absent),
              updatedAt: new Date().toISOString()
            });

            processed.push({ 
              email: email, 
              name: userData.name || email,
              attended: attended,
              absent: absent,
              percentage: Number(percentage.toFixed(1))
            });
            count++;
            
            // Commit batch every 400 docs to be safe (Firestore limit is 500)
            if (count % 400 === 0) {
              await batch.commit();
            }
          } else {
            missingEmails.push(email);
          }
        }

        if (count % 400 !== 0) {
          await batch.commit();
        }

        setStats({ processed: processed, missing: missingEmails });
        fetchGlobalStats();
        toast.success(language === 'ar' ? 'تم تحديث بيانات الحضور بنجاح' : 'Attendance data updated successfully');
      } catch (error) {
        console.error("Error processing excel:", error);
        toast.error(language === 'ar' ? 'خطأ في معالجة الملف' : 'Error processing file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      { Name: 'Omar Magdy', Email: 'omarwork1011@gmail.com', 'Sessions Attended': 2, 'Sessions Missed': 0 },
      { Name: 'Mohamed Atala', Email: 'mo.3tala2@ieee.org', 'Sessions Attended': 0, 'Sessions Missed': 2 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'attendance_template.xlsx');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-3 bg-surface-container-low hover:bg-surface-container-high rounded-full transition-all text-primary"
          >
            <ChevronLeft size={24} className={cn(language === 'ar' && "rotate-180")} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">
              {language === 'ar' ? 'إدارة الحضور والغياب' : 'Attendance Management'}
            </h1>
            <p className="text-on-surface-variant font-medium">
              {language === 'ar' 
                ? 'تابع نسب حضور المتقدمين وقم بتحديثها عبر ملفات Excel.' 
                : 'Track and update applicant attendance via Excel uploads.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowConfirm(true)}
          disabled={clearing || initialLoading}
          className="flex items-center gap-2 px-6 py-3 bg-error/10 text-error rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-error hover:text-white transition-all disabled:opacity-50"
        >
          {clearing ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          {language === 'ar' ? 'مسح جميع الإحصائيات' : 'Clear All Stats'}
        </button>
      </header>

      {globalStats && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-surface-container-low p-6 rounded-[32px] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-xl text-primary font-bold">
                  <Users size={20} />
                </div>
                <h4 className="text-sm font-black text-on-surface-variant uppercase tracking-widest">
                  {language === 'ar' ? 'إجمالي المتابعين' : 'Tracked Users'}
                </h4>
              </div>
              <p className="text-5xl font-black text-primary tracking-tighter">{globalStats.total}</p>
              <p className="text-xs text-on-surface-variant mt-2 font-medium">
                {language === 'ar' ? 'مستخدم تم تسجيل حضورهم' : 'Users with registered attendance'}
              </p>
            </div>
            
            <div className="bg-surface-container-low p-6 rounded-[32px] border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-secondary/10 rounded-xl text-secondary font-bold">
                  <BarChart2 size={20} />
                </div>
                <h4 className="text-sm font-black text-on-surface-variant uppercase tracking-widest">
                  {language === 'ar' ? 'متوسط الحضور' : 'Avg. Attendance'}
                </h4>
              </div>
              <p className="text-5xl font-black text-secondary tracking-tighter">{globalStats.avgAttendance.toFixed(1)}%</p>
              <p className="text-xs text-on-surface-variant mt-2 font-medium">
                {language === 'ar' ? 'نسبة الحضور العامة' : 'Collective average attendance'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-3 bg-surface-container-low p-8 rounded-[40px] border border-outline-variant/10 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h4 className="font-black text-primary uppercase text-sm tracking-[0.2em]">
                {language === 'ar' ? 'توزيع نسب الحضور' : 'Attendance Distribution'}
              </h4>
            </div>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={globalStats.distribution}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-on-surface-variant)' }} 
                  />
                  <YAxis hide />
                  <RechartsTooltip 
                    cursor={{ fill: 'transparent' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-surface-container-high p-3 rounded-xl border border-outline-variant/10 shadow-xl">
                            <p className="text-xs font-black text-primary">{payload[0].payload.name}</p>
                            <p className="text-xl font-bold text-on-surface">{payload[0].value} {language === 'ar' ? 'مستخدم' : 'Users'}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={40}>
                    {globalStats.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-surface-container-lowest w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300 text-center space-y-6">
              <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-primary tracking-tight mb-2">
                  {language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}
                </h3>
                <p className="text-on-surface-variant font-medium">
                  {language === 'ar' 
                    ? 'سيتم مسح جميع سجلات الحضور والغياب لجميع الطلاب نهائياً. لا يمكن التراجع عن هذا الإجراء.' 
                    : 'This will permanently clear all attendance and absence records for all students. This action cannot be undone.'}
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-6 py-3 bg-surface-container-high text-on-surface font-bold rounded-xl hover:bg-outline-variant/20 transition-all"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={clearAllStats}
                  className="flex-1 px-6 py-3 bg-error text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-error/20"
                >
                  {language === 'ar' ? 'نعم، امسح الكل' : 'Yes, Clear All'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface-container-lowest p-10 rounded-[40px] border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
              {loading ? <Loader2 className="w-10 h-10 animate-spin" /> : <Upload size={40} />}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-primary">
                {language === 'ar' ? 'اختر ملف Excel' : 'Choose Excel File'}
              </h3>
              <p className="text-on-surface-variant text-sm max-w-xs">
                {language === 'ar' 
                  ? 'تأكد من وجود أعمدة (Email) و (Sessions Attended) و (Sessions Missed)' 
                  : 'Ensure columns (Email), (Sessions Attended), and (Sessions Missed) exist.'}
              </p>
            </div>

            <label className={cn(
              "bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest cursor-pointer hover:brightness-110 transition-all shadow-xl shadow-primary/20 flex items-center gap-3",
              loading && "opacity-50 cursor-not-allowed"
            )}>
              <FileSpreadsheet size={20} />
              {language === 'ar' ? 'رفع الملف' : 'Upload File'}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={loading} />
            </label>

            <button 
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-primary font-bold hover:underline py-2"
            >
              <Download size={16} />
              {language === 'ar' ? 'تحميل نموذج للملف' : 'Download template'}
            </button>
          </div>

          {stats && (
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 space-y-6">
              <div className="flex items-center gap-3 text-emerald-600">
                <CheckCircle2 size={24} />
                <h4 className="text-lg font-black">{language === 'ar' ? 'تحديث ناجح' : 'Upload Successful'}</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low p-6 rounded-2xl text-center">
                  <p className="text-4xl font-black text-primary">{stats.processed.length}</p>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest mt-1">
                    {language === 'ar' ? 'تم تحديثهم' : 'Processed'}
                  </p>
                </div>
                <div className="bg-surface-container-low p-6 rounded-2xl text-center">
                  <p className="text-4xl font-black text-error">{stats.missing.length}</p>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest mt-1">
                    {language === 'ar' ? 'غير موجودين' : 'Not Found'}
                  </p>
                </div>
              </div>

              {stats.processed.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    {language === 'ar' ? 'المستخدمون الذين تم تحديثهم:' : 'Successfully updated users:'}
                  </p>
                  <div className="max-h-60 overflow-y-auto bg-surface-container-high/30 p-4 rounded-xl space-y-2">
                    {stats.processed.map((u: any, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-outline-variant/5 pb-2 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{u.name}</span>
                          <span className="text-[10px] text-on-surface-variant/50">{u.email}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-secondary">{u.percentage}%</span>
                          <p className="text-[8px] uppercase tracking-tighter text-on-surface-variant/40">
                            {u.attended} {language === 'ar' ? 'حاضر' : 'Attended'} / {u.absent} {language === 'ar' ? 'غائب' : 'Absent'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.missing.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-on-surface-variant flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    {language === 'ar' ? 'إيميلات غير موجودة في النظام:' : 'Emails not found in system:'}
                  </p>
                  <div className="max-h-40 overflow-y-auto bg-surface-container-high/30 p-4 rounded-xl space-y-1">
                    {stats.missing.map((email, idx) => (
                      <p key={idx} className="text-xs font-mono text-on-surface-variant/70">{email}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-primary/5 p-8 rounded-[32px] border border-primary/10">
            <h4 className="text-primary font-black uppercase text-xs tracking-[0.2em] mb-4">
              {language === 'ar' ? 'تعليمات الملف' : 'File Instructions'}
            </h4>
            <ul className="space-y-4">
              <li className="flex gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-[10px]">1</div>
                <p>{language === 'ar' ? 'يجب استخدام عناوين الأعمدة باللغة الإنجليزية حصراً (Email, Sessions Attended, Sessions Missed).' : 'You must use English column headers exclusively (Email, Sessions Attended, Sessions Missed).'}</p>
              </li>
              <li className="flex gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-[10px]">2</div>
                <p>{language === 'ar' ? 'يجب أن يكون الملف بصيغة .xlsx أو .xls' : 'File must be .xlsx or .xls'}</p>
              </li>
              <li className="flex gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-[10px]">3</div>
                <p>{language === 'ar' ? 'البيانات المرفوعة ستظهر فوراً في ملف المتقدم الشخصي.' : 'Uploaded data will appear instantly in the applicant profile.'} </p>
              </li>
            </ul>
          </div>
          
          <div className="bg-surface-container-low p-8 rounded-[32px] border border-outline-variant/10 text-center">
            <p className="text-xs text-on-surface-variant/60">
              {language === 'ar' 
                ? 'تحتاج لمساعدة؟ تواصل مع الدعم الفني.' 
                : 'Need help? Contact technical support.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
