import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.questions': 'Questions',
    'nav.teams': 'Teams',
    'nav.users': 'Users',
    'nav.home': 'Home',
    'nav.takeTest': 'Take Test',
    'nav.logout': 'Logout',
    'home.welcome': 'Welcome',
    'home.trackProgress': 'Track your team assignment progress here.',
    'home.testCompleted': 'Test Completed',
    'home.testPending': 'Test Pending',
    'home.step1': 'Registration',
    'home.step1Desc': 'Complete your profile and join the applicant pool.',
    'home.step2': 'MCQ Test',
    'home.step2Desc': 'Take a 30-question test to determine your professional profile.',
    'home.step3': 'Team Assignment',
    'home.step3Desc': 'Our smart algorithm will assign you to a balanced team.',
    'home.startTest': 'Start Test',
    'home.completed': 'Completed',
    'home.waitingAdmin': 'Waiting for admin...',
    'home.yourTeam': 'Your Team',
    'home.assignedSuccess': 'You have been successfully assigned!',
    'home.teamSize': 'Team Size',
    'home.capacity': 'Capacity',
    'home.members': 'members',
    'home.profileTitle': 'Your Professional Profile',
    'home.primaryTrait': 'Primary Trait',
    'home.primaryTraitDesc': 'This is your most dominant professional characteristic.',
    'home.secondaryTrait': 'Secondary Trait',
    'home.secondaryTraitDesc': 'This trait strongly complements your primary style.',
    'test.title': 'Professional Profile Test',
    'test.question': 'Question',
    'test.next': 'Next',
    'test.back': 'Back',
    'test.finish': 'Finish Test',
    'test.submitting': 'Submitting...',
    'test.noQuestions': 'No active questions found. Please contact an admin.',
    'test.completedTitle': 'Test Completed!',
    'test.completedDesc': 'Thank you for completing the test. Your profile is being analyzed.',
    'test.viewResults': 'View Results',
    'admin.dashboard': 'Admin Dashboard',
    'admin.applicants': 'Applicants Management',
    'admin.teams': 'Teams Management',
    'admin.questions': 'Questions Management',
    'login.title': 'Welcome Back',
    'login.subtitle': 'Sign in to your account to continue',
    'login.email': 'Email Address',
    'login.password': 'Password',
    'login.signIn': 'Sign In',
    'login.signingIn': 'Signing in...',
    'login.noAccount': "Don't have an account?",
    'login.register': 'Register here',
    'login.google': 'Sign in with Google',
    'register.title': 'Create Account',
    'register.subtitle': 'Join us and find your perfect team',
    'register.name': 'Full Name',
    'register.phone': 'Phone Number',
    'register.department': 'Department',
    'register.signUp': 'Create Account',
    'register.signingUp': 'Creating account...',
    'register.hasAccount': 'Already have an account?',
    'register.login': 'Login here',
    'register.google': 'Sign up with Google',
  },
  ar: {
    'nav.dashboard': 'لوحة التحكم',
    'nav.questions': 'الأسئلة',
    'nav.teams': 'الفرق',
    'nav.users': 'المستخدمين',
    'nav.home': 'الرئيسية',
    'nav.takeTest': 'أداء الاختبار',
    'nav.logout': 'تسجيل الخروج',
    'home.welcome': 'مرحباً',
    'home.trackProgress': 'تتبع تقدم تعيين فريقك هنا.',
    'home.testCompleted': 'تم إكمال الاختبار',
    'home.testPending': 'الاختبار قيد الانتظار',
    'home.step1': 'التسجيل',
    'home.step1Desc': 'أكمل ملفك الشخصي وانضم إلى مجموعة المتقدمين.',
    'home.step2': 'اختبار MCQ',
    'home.step2Desc': 'قم بإجراء اختبار مكون من 30 سؤالاً لتحديد ملفك المهني.',
    'home.step3': 'تعيين الفريق',
    'home.step3Desc': 'سيقوم نظامنا الذكي بتعيينك في فريق متوازن.',
    'home.startTest': 'ابدأ الاختبار',
    'home.completed': 'مكتمل',
    'home.waitingAdmin': 'بانتظار المسؤول...',
    'home.yourTeam': 'فريقك',
    'home.assignedSuccess': 'تم تعيينك بنجاح!',
    'home.teamSize': 'حجم الفريق',
    'home.capacity': 'السعة',
    'home.members': 'أعضاء',
    'home.profileTitle': 'ملفك المهني',
    'home.primaryTrait': 'السمة الأساسية',
    'home.primaryTraitDesc': 'هذه هي السمة المهنية الأكثر هيمنة لديك.',
    'home.secondaryTrait': 'السمة الثانوية',
    'home.secondaryTraitDesc': 'هذه السمة تكمل أسلوبك الأساسي بشكل قوي.',
    'test.title': 'اختبار الملف المهني',
    'test.question': 'سؤال',
    'test.next': 'التالي',
    'test.back': 'السابق',
    'test.finish': 'إنهاء الاختبار',
    'test.submitting': 'جاري الإرسال...',
    'test.noQuestions': 'لم يتم العثور على أسئلة نشطة. يرجى الاتصال بالمسؤول.',
    'test.completedTitle': 'اكتمل الاختبار!',
    'test.completedDesc': 'شكراً لإكمال الاختبار. يتم الآن تحليل ملفك الشخصي.',
    'test.viewResults': 'عرض النتائج',
    'admin.dashboard': 'لوحة تحكم المسؤول',
    'admin.applicants': 'إدارة المتقدمين',
    'admin.teams': 'إدارة الفرق',
    'admin.questions': 'إدارة الأسئلة',
    'login.title': 'مرحباً بعودتك',
    'login.subtitle': 'قم بتسجيل الدخول إلى حسابك للمتابعة',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.signIn': 'تسجيل الدخول',
    'login.signingIn': 'جاري تسجيل الدخول...',
    'login.noAccount': 'ليس لديك حساب؟',
    'login.register': 'سجل هنا',
    'login.google': 'تسجيل الدخول بواسطة جوجل',
    'register.title': 'إنشاء حساب',
    'register.subtitle': 'انضم إلينا وجد فريقك المثالي',
    'register.name': 'الاسم الكامل',
    'register.phone': 'رقم الهاتف',
    'register.department': 'القسم',
    'register.signUp': 'إنشاء الحساب',
    'register.signingUp': 'جاري إنشاء الحساب...',
    'register.hasAccount': 'لديك حساب بالفعل؟',
    'register.login': 'سجل دخول هنا',
    'register.google': 'إنشاء حساب بواسطة جوجل',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
