'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import CustomSelect from '@/components/CustomSelect';
import {
  getStudyGuideCourses,
  getStudyGuideExams,
  getStudyGuide,
  regenerateStudyGuide,
} from '@/lib/api';

const UI_FONT = "var(--font-dm-sans), 'DM Sans', sans-serif";

interface DayEntry {
  date: string;
  day_label: string;
  focus: string;
  concepts: string[];
}

interface Guide {
  exam: string;
  due_date: string;
  summary: string;
  days: DayEntry[];
}

export default function StudyClient() {
  const { userId, userReady } = useUser();

  const [courses, setCourses] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');

  const [exams, setExams] = useState<{ id: string; title: string; due_date: string | null }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');

  const [guide, setGuide] = useState<Guide | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Fetch courses once user is ready
  useEffect(() => {
    if (!userReady) return;
    getStudyGuideCourses(userId)
      .then(res => setCourses(res.courses))
      .catch(console.error);
  }, [userId, userReady]);

  // Fetch exams when course changes
  useEffect(() => {
    setSelectedExamId('');
    setExams([]);
    setGuide(null);
    setGuideError('');
    if (!selectedCourse || !userReady) return;
    getStudyGuideExams(userId, selectedCourse)
      .then(res => setExams(res.exams))
      .catch(console.error);
  }, [selectedCourse, userId, userReady]);

  // Fetch guide when exam changes
  useEffect(() => {
    setGuide(null);
    setGuideError('');
    if (!selectedExamId || !selectedCourse || !userReady) return;
    setGuideLoading(true);
    getStudyGuide(userId, selectedCourse, selectedExamId)
      .then(res => {
        setGuide(res.guide);
        setGeneratedAt(res.generated_at);
      })
      .catch(e => setGuideError(e.message || 'Failed to load study guide.'))
      .finally(() => setGuideLoading(false));
  }, [selectedExamId, selectedCourse, userId, userReady]);

  const handleRegenerate = async () => {
    if (!selectedExamId || !selectedCourse) return;
    setRegenerating(true);
    setGuideError('');
    try {
      const res = await regenerateStudyGuide(userId, selectedCourse, selectedExamId);
      setGuide(res.guide);
      setGeneratedAt(res.generated_at);
    } catch (e: any) {
      setGuideError(e.message || 'Regeneration failed.');
    } finally {
      setRegenerating(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const courseOptions = courses.map(c => ({ value: c, label: c }));
  const examOptions = exams.map(e => ({ value: e.id, label: `${e.title}${e.due_date ? ` — ${e.due_date}` : ''}` }));

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      fontFamily: UI_FONT,
    }}>
      {/* Header */}
      <h1 style={{
        fontFamily: "var(--font-spectral), 'Spectral', Georgia, serif",
        fontSize: '32px',
        fontWeight: 700,
        color: '#111827',
        margin: 0,
        letterSpacing: '-0.02em',
      }}>
        Study Guide
      </h1>

      {/* Selectors */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Course
          </label>
          <CustomSelect
            value={selectedCourse}
            onChange={setSelectedCourse}
            options={courseOptions}
            placeholder="Select a course…"
            style={{ width: '220px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '280px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Exam
          </label>
          <CustomSelect
            value={selectedExamId}
            onChange={setSelectedExamId}
            options={examOptions}
            placeholder={selectedCourse ? 'Select an exam…' : 'Select a course first'}
            style={{ width: '280px' }}
          />
        </div>

        {guide && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{
              padding: '5px 16px',
              background: 'rgba(26,92,42,0.08)',
              color: '#1a5c2a',
              border: '1px solid rgba(26,92,42,0.3)',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: regenerating ? 'default' : 'pointer',
              opacity: regenerating ? 0.6 : 1,
              fontFamily: UI_FONT,
              alignSelf: 'flex-end',
              height: '33px',
            }}
          >
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </div>

      {/* Empty / prompt states */}
      {!selectedCourse && courses.length === 0 && (
        <div style={{
          border: '1px solid rgba(107,114,128,0.15)',
          borderRadius: '10px',
          padding: '48px 32px',
          textAlign: 'center',
          background: '#f8faf8',
        }}>
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            No courses found. Upload a syllabus in the Library to get started.
          </p>
        </div>
      )}

      {selectedCourse && exams.length === 0 && !guideLoading && (
        <div style={{
          border: '1px solid rgba(107,114,128,0.15)',
          borderRadius: '10px',
          padding: '48px 32px',
          textAlign: 'center',
          background: '#f8faf8',
        }}>
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            No exams found for <strong style={{ color: '#374151' }}>{selectedCourse}</strong>.
            Make sure your syllabus has been uploaded and assignments extracted.
          </p>
        </div>
      )}

      {/* Loading state */}
      {guideLoading && (
        <div style={{
          border: '1px solid rgba(107,114,128,0.15)',
          borderRadius: '10px',
          padding: '64px 32px',
          textAlign: 'center',
          background: '#f8faf8',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(26,92,42,0.15)',
            borderTop: '3px solid #1a5c2a',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            Generating your study guide… this may take a moment.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error */}
      {guideError && (
        <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{guideError}</p>
      )}

      {/* Guide */}
      {guide && !guideLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary card */}
          <div style={{
            border: '1px solid rgba(107,114,128,0.15)',
            borderRadius: '10px',
            padding: '20px 24px',
            background: '#ffffff',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                  Exam Overview
                </p>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                  {guide.exam}
                </h2>
                {guide.due_date && (
                  <span style={{
                    fontSize: '12px',
                    color: '#b91c1c',
                    fontWeight: 600,
                    background: 'rgba(220,38,38,0.08)',
                    border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    display: 'inline-block',
                    marginBottom: '10px',
                  }}>
                    Due {guide.due_date}
                  </span>
                )}
                <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: 1.6 }}>
                  {guide.summary}
                </p>
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '12px 0 0' }}>
              Last updated {formatDate(generatedAt)}
            </p>
          </div>

          {/* Day timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              {guide.days.length}-Day Study Plan
            </p>

            {guide.days.map((day, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Timeline indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '14px' }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: idx === 0 ? '#1a5c2a' : 'rgba(26,92,42,0.1)',
                    color: idx === 0 ? '#ffffff' : '#1a5c2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>
                  {idx < guide.days.length - 1 && (
                    <div style={{ width: '2px', background: 'rgba(26,92,42,0.12)', flexGrow: 1, minHeight: '24px', marginTop: '4px' }} />
                  )}
                </div>

                {/* Day card */}
                <div style={{
                  flex: 1,
                  border: '1px solid rgba(107,114,128,0.15)',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  background: '#ffffff',
                  marginBottom: idx < guide.days.length - 1 ? '0' : '0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      {day.day_label}
                    </span>
                    {day.date && (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{day.date}</span>
                    )}
                  </div>

                  <p style={{ fontSize: '13px', color: '#4b5563', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {day.focus}
                  </p>

                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {day.concepts.map((concept, ci) => (
                      <li key={ci} style={{ fontSize: '13px', color: '#374151' }}>
                        {concept}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
