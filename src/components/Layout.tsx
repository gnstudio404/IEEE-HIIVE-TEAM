import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../lib/firebase';
import { LogOut, LayoutDashboard, Users, HelpCircle, User, Menu, X, Globe, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { profile, isAdmin } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = isAdmin 
    ? [
        { name: t('nav.dashboard'), path: '/admin', icon: LayoutDashboard },
        { name: t('nav.questions'), path: '/admin/questions', icon: HelpCircle },
        { name: t('nav.teams'), path: '/admin/teams', icon: Users },
        { name: t('nav.users'), path: '/admin/applicants', icon: User },
      ]
    : [
        { name: t('nav.home'), path: '/', icon: LayoutDashboard },
        { name: t('nav.takeTest'), path: '/test', icon: HelpCircle },
      ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Users className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">IEEE HIIVE TEAM</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2",
                    location.pathname === item.path 
                      ? "text-indigo-600 dark:text-indigo-400" 
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

              {/* Language Switcher */}
              <button
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <Globe className="w-4 h-4" />
                {language === 'en' ? 'العربية' : 'English'}
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
              
              <div className="flex items-center gap-3">
                <div className={cn("text-right hidden lg:block", isRTL && "text-left")}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{profile?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{profile?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-slate-600 dark:text-slate-400"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium",
                  location.pathname === item.path 
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>

            <button
              onClick={() => {
                setLanguage(language === 'en' ? 'ar' : 'en');
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Globe className="w-5 h-5" />
              {language === 'en' ? 'العربية' : 'English'}
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-5 h-5" />
              {t('nav.logout')}
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} IEEE HIIVE TEAM. Smart Team Assignment Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
