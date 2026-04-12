import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserScore, Team } from '../types';
import { toast } from 'sonner';
import { Search, Filter, User, Mail, Building, CheckCircle2, Clock, MoreVertical, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';

export default function AdminApplicants() {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState<UserProfile[]>([]);
  const [scores, setScores] = useState<Record<string, UserScore>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleDeleteUser = async (userId: string) => {
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
                         (filter === 'pending' && !u.completedTest);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Review user profiles, manage roles, and team assignments.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-slate-400 w-5 h-5 mr-2" />
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full md:w-auto">
            {(['all', 'completed', 'pending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all ${
                  filter === f ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Traits</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned Team</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredApplicants.map((u) => {
                const score = scores[u.uid];
                const team = teams.find(t => t.id === u.assignedTeamId);

                return (
                  <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                        }`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{u.name}</p>
                            {u.role === 'admin' && (
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded uppercase">Admin</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.completedTest ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-bold border border-green-100 dark:border-green-900/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-100 dark:border-amber-900/30">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {score ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            Primary: {score.primaryTrait}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Secondary: {score.secondaryTrait}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500 italic">No score</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.assignedTeamId || ''}
                        onChange={(e) => handleReassign(u.uid, e.target.value || null)}
                        className="text-sm bg-transparent border-none focus:ring-0 font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                      >
                        <option value="" className="bg-white dark:bg-slate-800">Unassigned</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id} className="bg-white dark:bg-slate-800">{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {deletingId === u.uid ? (
                          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-1 rounded-lg border border-red-100 dark:border-red-900/30">
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase px-1">Confirm?</span>
                            <button 
                              onClick={() => handleDeleteUser(u.uid)}
                              className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                              title="Confirm Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              title="Cancel"
                            >
                              <MoreVertical className="w-3.5 h-3.5 rotate-90" />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(u.uid)}
                            disabled={u.uid === user?.uid}
                            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors disabled:opacity-0 disabled:cursor-default"
                            title={u.uid === user?.uid ? "" : "Delete User"}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredApplicants.length === 0 && (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No applicants found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
