import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Star, Send, Loader2, MessageSquare, Award, BookOpen, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export default function SessionFeedback() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<any>(null);
  
  const [ratings, setRatings] = useState({
    overall: 0,
    topic: 0,
    instructor: 0,
    benefit: 0
  });
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'sessions', sessionId!));
      if (docSnap.exists()) {
        setSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error('Session not found');
        navigate('/sessions');
      }
      setLoading(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratings.overall || !ratings.topic || !ratings.instructor || !ratings.benefit) {
      toast.error(language === 'ar' ? 'يرجى تقييم جميع البنود' : 'Please rate all items');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'sessionFeedbacks'), {
        sessionId,
        userId: user?.uid,
        overallRating: ratings.overall,
        topicRating: ratings.topic,
        instructorRating: ratings.instructor,
        benefitRating: ratings.benefit,
        comment,
        createdAt: new Date().toISOString()
      });
      
      toast.success(language === 'ar' ? 'شكراً لتقييمك!' : 'Thank you for your feedback!');
      navigate('/sessions');
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'sessionFeedbacks');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (key: keyof typeof ratings, label: string, icon: React.ReactNode) => (
    <div className="space-y-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          {icon}
        </div>
        <h4 className="font-black text-on-surface uppercase tracking-tight text-sm">{label}</h4>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRatings({ ...ratings, [key]: star })}
            className={cn(
              "p-2 transition-all duration-300 hover:scale-125",
              ratings[key] >= star ? "text-yellow-400 fill-yellow-400" : "text-on-surface/20 hover:text-yellow-500/40"
            )}
          >
            <Star size={32} className={cn(ratings[key] >= star && "fill-current")} />
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="animate-spin text-primary" size={48} />
      <p className="font-bold text-on-surface-variant animate-pulse">
        {language === 'ar' ? 'جاري التحميل...' : 'Loading feedback form...'}
      </p>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-8 py-6"
    >
      <header className="text-center space-y-4">
        <div className="inline-block p-4 bg-primary/10 rounded-full text-primary mb-2">
          <Award size={40} />
        </div>
        <h2 className="text-4xl font-black text-primary tracking-tighter uppercase">
          {language === 'ar' ? 'تقييم الجلسة' : 'Session Feedback'}
        </h2>
        <p className="text-on-surface-variant font-medium text-lg">
          {language === 'ar' 
            ? `كيف كانت تجربتك في جلسة "${session?.titleAr}"؟` 
            : `How was your experience in "${session?.title}"?`
          }
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {renderStars('overall', language === 'ar' ? 'التقييم العام' : 'Overall Rating', <Star size={20} />)}
          {renderStars('topic', language === 'ar' ? 'موضوع الجلسة' : 'Session Topic', <BookOpen size={20} />)}
          {renderStars('instructor', language === 'ar' ? 'المحاضر' : 'Instructor', <Users size={20} />)}
          {renderStars('benefit', language === 'ar' ? 'مدى الاستفادة' : 'Benefit/Impact', <Award size={20} />)}
        </div>

        <div className="space-y-4 bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <MessageSquare size={20} />
            </div>
            <h4 className="font-black text-on-surface uppercase tracking-tight">
              {language === 'ar' ? 'تعليق إضافي (اختياري)' : 'Additional Comment (Optional)'}
            </h4>
          </div>
          <textarea
            placeholder={language === 'ar' ? 'اكتب ملاحظاتك هنا...' : 'Write your thoughts here...'}
            className="w-full bg-surface-container-high p-4 rounded-2xl border-none focus:ring-4 focus:ring-primary/20 h-32 resize-none font-medium"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white py-6 rounded-[2rem] font-black text-xl uppercase tracking-widest hive-shadow hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <>
              <Send size={24} />
              {language === 'ar' ? 'إرسال التقييم' : 'Submit Feedback'}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
