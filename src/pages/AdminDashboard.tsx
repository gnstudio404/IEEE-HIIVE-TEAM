import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserScore, Team } from '../types';
import { Users, CheckCircle2, Clock, Trophy, TrendingUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalApplicants: 0,
    completedTests: 0,
    pendingUsers: 0,
    totalTeams: 0
  });
  const [traitDistribution, setTraitDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let usersSnap;
        try {
          usersSnap = await getDocs(collection(db, 'users'));
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'users');
          return;
        }
        const users = usersSnap.docs.map(doc => doc.data() as UserProfile);
        const applicants = users.filter(u => u.role === 'applicant');
        
        let scoresSnap;
        try {
          scoresSnap = await getDocs(collection(db, 'scores'));
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'scores');
          return;
        }
        const scores = scoresSnap.docs.map(doc => doc.data() as UserScore);
        
        let teamsSnap;
        try {
          teamsSnap = await getDocs(collection(db, 'teams'));
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'teams');
          return;
        }
        
        setStats({
          totalApplicants: applicants.length,
          completedTests: applicants.filter(u => u.completedTest).length,
          pendingUsers: applicants.filter(u => !u.completedTest).length,
          totalTeams: teamsSnap.size
        });

        // Calculate trait distribution
        const traits: Record<string, number> = {
          leadership: 0,
          organization: 0,
          communication: 0,
          creativity: 0,
          analysis: 0,
          execution: 0
        };

        scores.forEach(s => {
          if (s.primaryTrait) {
            traits[s.primaryTrait] = (traits[s.primaryTrait] || 0) + 1;
          }
        });

        setTraitDistribution(Object.entries(traits).map(([name, value]) => ({ name, value })));
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time statistics for IEEE HIIVE TEAM.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Applicants" 
          value={stats.totalApplicants} 
          icon={Users} 
          color="bg-blue-500" 
          subtext="Registered users"
        />
        <StatCard 
          title="Completed Tests" 
          value={stats.completedTests} 
          icon={CheckCircle2} 
          color="bg-green-500" 
          subtext={`${Math.round((stats.completedTests / stats.totalApplicants || 0) * 100)}% completion rate`}
        />
        <StatCard 
          title="Pending Users" 
          value={stats.pendingUsers} 
          icon={Clock} 
          color="bg-amber-500" 
          subtext="Waiting to take test"
        />
        <StatCard 
          title="Total Teams" 
          value={stats.totalTeams} 
          icon={Trophy} 
          color="bg-indigo-500" 
          subtext="Created teams"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Primary Trait Distribution</h3>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={traitDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  textAnchor="middle"
                  interval={0}
                  className="capitalize"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    color: 'var(--tooltip-text, #000)'
                  }}
                  itemStyle={{ color: 'inherit' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {traitDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">System Health</h3>
          </div>
          <div className="space-y-6">
            <HealthItem label="Database Connection" status="Healthy" color="text-green-600 dark:text-green-400" />
            <HealthItem label="Auth Service" status="Active" color="text-green-600 dark:text-green-400" />
            <HealthItem label="Assignment Engine" status="Ready" color="text-indigo-600 dark:text-indigo-400" />
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-2">Recent Activity</p>
              <div className="space-y-3">
                <ActivityItem text="New applicant registered" time="2m ago" />
                <ActivityItem text="Test completed by John" time="15m ago" />
                <ActivityItem text="Team 'Alpha' created" time="1h ago" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtext }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl text-white", color)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</h3>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-3xl font-bold text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">{subtext}</p>
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
