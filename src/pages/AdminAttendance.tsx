import React, { useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useLanguage } from '../context/LanguageContext';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, ChevronLeft, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface AttendanceRow {
  Email: string;
  'Attendance %': number;
  'Sessions Attended': number;
}

export default function AdminAttendance() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ processed: number; missing: string[] } | null>(null);

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

        const processedEmails: string[] = [];
        const missingEmails: string[] = [];
        
        const batch = writeBatch(db);
        let count = 0;

        for (const row of data) {
          const email = row.Email || row['البريد الإلكتروني'] || row['الايميل'];
          const attendancePct = row['Attendance %'] || row['نسبة الحضور'] || row['نسبة الغياب']; // User said percentage of absence/attendance
          const sessionsCount = row['Sessions Attended'] || row['عدد الجلسات'] || row['عدد السشنات'];

          if (!email) continue;

          const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            batch.update(doc(db, 'users', userDoc.id), {
              attendancePercentage: Number(attendancePct) || 0,
              attendedSessionsCount: Number(sessionsCount) || 0,
              updatedAt: new Date().toISOString()
            });
            processedEmails.push(email);
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

        setStats({ processed: count, missing: missingEmails });
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
      { Email: 'user@example.com', 'Attendance %': 95, 'Sessions Attended': 12 },
      { Email: 'test@hiive.tech', 'Attendance %': 80, 'Sessions Attended': 10 },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'attendance_template.xlsx');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center gap-4">
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
              ? 'ارفع ملف Excel لتحديث نسب الحضور للمتقدمين.' 
              : 'Upload an Excel file to update applicant attendance rates.'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  ? 'تأكد من وجود أعمدة (Email) و (Attendance %) و (Sessions Attended)' 
                  : 'Ensure columns (Email), (Attendance %), and (Sessions Attended) exist.'}
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
                  <p className="text-4xl font-black text-primary">{stats.processed}</p>
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
                <p>{language === 'ar' ? 'يجب أن يكون الملف بصيغة .xlsx أو .xls' : 'File must be .xlsx or .xls'}</p>
              </li>
              <li className="flex gap-3 text-sm">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-[10px]">2</div>
                <p>{language === 'ar' ? 'تأكد من صحة البريد الإلكتروني لكل متقدم.' : 'Ensure email correctness for each applicant.'} </p>
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
