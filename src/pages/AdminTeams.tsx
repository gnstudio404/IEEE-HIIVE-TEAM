import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Team, UserProfile, UserScore } from '../types';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Save, X, Users, Wand2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function AdminTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Team>>({
    name: '',
    minSize: 4,
    maxSize: 6,
    memberCount: 0
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      let querySnapshot;
      try {
        querySnapshot = await getDocs(collection(db, 'teams'));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'teams');
        return;
      }
      setTeams(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    } catch (error) {
      console.error("Error fetching teams:", error);
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("Please enter a team name");
      return;
    }

    try {
      if (editingId) {
        try {
          await updateDoc(doc(db, 'teams', editingId), formData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `teams/${editingId}`);
          return;
        }
        toast.success("Team updated");
      } else {
        try {
          await addDoc(collection(db, 'teams'), { ...formData, memberCount: 0 });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'teams');
          return;
        }
        toast.success("Team created");
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({ name: '', minSize: 4, maxSize: 6, memberCount: 0 });
      fetchTeams();
    } catch (error) {
      toast.error("Failed to save team");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure? This will not unassign users automatically.")) {
      try {
        try {
          await deleteDoc(doc(db, 'teams', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `teams/${id}`);
          return;
        }
        toast.success("Team deleted");
        fetchTeams();
      } catch (error) {
        toast.error("Failed to delete team");
      }
    }
  };

  const handleAutoAssign = async () => {
    if (teams.length === 0) {
      toast.error("Please create at least one team first.");
      return;
    }

    setAssigning(true);
    try {
      // 1. Fetch all applicants who completed the test and are NOT assigned
      let usersSnap;
      try {
        usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'applicant'), where('completedTest', '==', true)));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
        return;
      }
      const unassignedUsers = usersSnap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => !u.assignedTeamId);

      if (unassignedUsers.length === 0) {
        toast.info("No unassigned applicants found.");
        setAssigning(false);
        return;
      }

      // 2. Fetch scores for these users
      let scoresSnap;
      try {
        scoresSnap = await getDocs(collection(db, 'scores'));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'scores');
        return;
      }
      const scoresMap: Record<string, UserScore> = {};
      scoresSnap.docs.forEach(doc => {
        scoresMap[doc.id] = doc.data() as UserScore;
      });

      // 3. Sort users by their primary trait to distribute them
      const usersWithScores = unassignedUsers.map(u => ({
        user: u,
        score: scoresMap[u.uid]
      })).filter(u => u.score);

      // Group by primary trait
      const groupedByTrait: Record<string, typeof usersWithScores> = {};
      usersWithScores.forEach(u => {
        const trait = u.score.primaryTrait;
        if (!groupedByTrait[trait]) groupedByTrait[trait] = [];
        groupedByTrait[trait].push(u);
      });

      // 4. Assignment Logic
      const batch = writeBatch(db);
      const currentTeams = [...teams];
      
      // Flatten users in a way that mixes traits
      const traits = Object.keys(groupedByTrait);
      const sortedUsers: typeof usersWithScores = [];
      let hasMore = true;
      let i = 0;
      while (hasMore) {
        hasMore = false;
        traits.forEach(t => {
          if (groupedByTrait[t][i]) {
            sortedUsers.push(groupedByTrait[t][i]);
            hasMore = true;
          }
        });
        i++;
      }

      // Distribute into teams
      sortedUsers.forEach(u => {
        // Find team with least members that is not full
        const availableTeams = currentTeams.filter(t => t.memberCount < t.maxSize);
        if (availableTeams.length === 0) return;

        // Sort by member count ascending
        availableTeams.sort((a, b) => a.memberCount - b.memberCount);
        const targetTeam = availableTeams[0];

        // Update user
        batch.update(doc(db, 'users', u.user.uid), {
          assignedTeamId: targetTeam.id
        });

        // Update team count locally
        targetTeam.memberCount++;
        
        // Create assignment record
        batch.set(doc(collection(db, 'assignments')), {
          userId: u.user.uid,
          teamId: targetTeam.id,
          assignedBy: 'system',
          timestamp: new Date().toISOString()
        });
      });

      // Update team counts in DB
      currentTeams.forEach(t => {
        batch.update(doc(db, 'teams', t.id), {
          memberCount: t.memberCount
        });
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-auto-assign');
        return;
      }
      toast.success(`Successfully assigned ${sortedUsers.length} users!`);
      fetchTeams();
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to run assignment engine");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Teams Management</h1>
          <p className="text-slate-500 mt-1">Manage teams and run the assignment algorithm.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAutoAssign}
            disabled={assigning}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-all border border-indigo-100 disabled:opacity-50"
          >
            {assigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            Auto Assign Teams
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Team
          </button>
        </div>
      </div>

      {(isAdding || editingId) && (
        <div className="bg-white rounded-2xl p-8 border border-indigo-200 shadow-lg shadow-indigo-50 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Team' : 'New Team'}</h3>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-1">Team Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Team Alpha..."
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Min Size</label>
              <input
                type="number"
                value={formData.minSize}
                onChange={(e) => setFormData({ ...formData, minSize: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Max Size</label>
              <input
                type="number"
                value={formData.maxSize}
                onChange={(e) => setFormData({ ...formData, maxSize: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              <Save className="w-4 h-4" />
              Save Team
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
              <Users className="w-16 h-16" />
            </div>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-xl font-bold text-slate-900">{team.name}</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Team ID: {team.id.slice(0, 8)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => { setEditingId(team.id); setFormData(team); }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(team.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Members</p>
                  <p className="text-2xl font-bold text-slate-900">{team.memberCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium">Capacity</p>
                  <p className="text-sm font-bold text-slate-700">{team.minSize} - {team.maxSize}</p>
                </div>
              </div>

              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    team.memberCount < team.minSize ? "bg-amber-400" : 
                    team.memberCount > team.maxSize ? "bg-red-500" : "bg-green-500"
                  )}
                  style={{ width: `${Math.min((team.memberCount / team.maxSize) * 100, 100)}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                {team.memberCount < team.minSize ? (
                  <div className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Below minimum size
                  </div>
                ) : team.memberCount >= team.maxSize ? (
                  <div className="flex items-center gap-1.5 text-red-600 text-xs font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Team is full
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Balanced size
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckCircleIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
