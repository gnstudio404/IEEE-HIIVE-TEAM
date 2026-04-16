import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Team, UserProfile, UserScore } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft, Users, Mail, Building, Phone, Award, Star } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminTeamDetails() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [scores, setScores] = useState<Record<string, UserScore>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchTeamData();
    }
  }, [teamId]);

  const fetchTeamData = async () => {
    try {
      // Fetch Team
      const teamDoc = await getDoc(doc(db, 'teams', teamId!));
      if (!teamDoc.exists()) {
        navigate('/admin/teams');
        return;
      }
      const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
      setTeam(teamData);

      // Fetch Members
      const membersQuery = query(collection(db, 'users'), where('assignedTeamId', '==', teamId));
      const membersSnap = await getDocs(membersQuery);
      const membersData = membersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setMembers(membersData);

      // Fetch Scores for members
      if (membersData.length > 0) {
        const scoresData: Record<string, UserScore> = {};
        for (const member of membersData) {
          const scoreDoc = await getDoc(doc(db, 'scores', member.uid));
          if (scoreDoc.exists()) {
            scoresData[member.uid] = scoreDoc.data() as UserScore;
          }
        }
        setScores(scoresData);
      }
    } catch (error) {
      console.error("Error fetching team details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!team) return null;

  // Sort members to put leader at top
  const sortedMembers = [...members].sort((a, b) => {
    const scoreA = scores[a.uid]?.leaderScore || 0;
    const scoreB = scores[b.uid]?.leaderScore || 0;
    return scoreB - scoreA;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/admin/teams')}
          className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
        >
          <ArrowLeft className={cn(language === 'ar' && "rotate-180")} />
        </button>
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">{team.name}</h1>
          <p className="text-on-surface-variant">
            {language === 'ar' 
              ? `أعضاء الفريق (${members.length} / ${team.maxSize})` 
              : `Team Members (${members.length} / ${team.maxSize})`}
          </p>
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedMembers.map((member, idx) => {
          const score = scores[member.uid];
          const isLeader = idx === 0 && members.length > 0;

          return (
            <div 
              key={member.uid}
              className={cn(
                "bg-surface-container-lowest rounded-3xl p-6 border transition-all hover:shadow-xl group relative overflow-hidden",
                isLeader ? "border-primary/30 ring-1 ring-primary/10 shadow-lg" : "border-outline-variant/10 shadow-sm"
              )}
            >
              {isLeader && (
                <div className="absolute top-0 right-0 bg-primary text-white px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Star size={10} fill="currentColor" />
                  {language === 'ar' ? 'قائد الفريق' : 'Team Leader'}
                </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-surface-container shadow-sm">
                  <img 
                    src={member.photoURL || "https://picsum.photos/seed/user/200/200"} 
                    alt={member.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="font-black text-primary tracking-tight truncate max-w-[150px]">{member.name}</h3>
                  <p className="text-xs text-on-surface-variant truncate max-w-[150px]">{member.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                {score ? (
                  <div className="p-4 bg-surface-container-low rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-widest">
                        {language === 'ar' ? 'نوع الشخصية' : 'Personality Type'}
                      </span>
                      <span className="text-xs font-black text-primary">
                        {score.leaderScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-lg font-black text-primary tracking-tighter">
                      {score.personalityType === 'The Leader'
                        ? (language === 'ar' ? score.personalityTypeAr : score.personalityType)
                        : (language === 'ar' ? 'عضو فريق' : 'Team Member')
                      }
                    </div>
                    <div className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">
                      {language === 'ar' ? score.personalityTypeAr : score.personalityType}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-surface-container-low rounded-2xl text-center italic text-xs text-on-surface-variant/50">
                    {language === 'ar' ? 'لم يكتمل الاختبار بعد' : 'Test not completed yet'}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Building size={14} className="text-primary" />
                    <span className="truncate">{member.department || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Phone size={14} className="text-primary" />
                    <span>{member.phone || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="col-span-full py-20 text-center bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/20">
            <Users className="mx-auto text-outline-variant/30 mb-4" size={48} />
            <p className="text-on-surface-variant font-bold">
              {language === 'ar' ? 'لا يوجد أعضاء في هذا الفريق بعد' : 'No members in this team yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
