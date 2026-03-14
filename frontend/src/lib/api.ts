const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUsers = () =>
  fetchJSON<{ users: { id: string; name: string; room_id: string | null }[] }>('/api/users');

// ── Graph ─────────────────────────────────────────────────────────────────────

export const getGraph = (userId: string) =>
  fetchJSON<{ nodes: any[]; edges: any[]; stats: any }>(`/api/graph/${userId}`);

export const getRecommendations = (userId: string) =>
  fetchJSON<{ recommendations: any[] }>(`/api/graph/${userId}/recommendations`);

export const getCourses = (userId: string) =>
  fetchJSON<{ courses: { id: string; course_name: string; color: string | null; node_count: number; created_at: string }[] }>(
    `/api/graph/${userId}/courses`
  );

export const addCourse = (userId: string, courseName: string, color?: string) =>
  fetchJSON<{ course_name: string; already_existed: boolean }>(`/api/graph/${userId}/courses`, {
    method: 'POST',
    body: JSON.stringify({ course_name: courseName, ...(color ? { color } : {}) }),
  });

export const updateCourseColor = (userId: string, courseName: string, color: string) =>
  fetchJSON<{ updated: boolean }>(
    `/api/graph/${userId}/courses/${encodeURIComponent(courseName)}/color`,
    { method: 'PATCH', body: JSON.stringify({ color }) }
  );

export const deleteCourse = (userId: string, courseName: string) =>
  fetchJSON<{ deleted: boolean }>(
    `/api/graph/${userId}/courses/${encodeURIComponent(courseName)}`,
    { method: 'DELETE' }
  );

// ── Learn ─────────────────────────────────────────────────────────────────────

export const startSession = (userId: string, topic: string, mode: string, useSharedContext = true) =>
  fetchJSON<{ session_id: string; initial_message: string; graph_state: any }>('/api/learn/start-session', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, topic, mode, use_shared_context: useSharedContext }),
  });

export const sendChat = (sessionId: string, userId: string, message: string, mode: string, useSharedContext = true) =>
  fetchJSON<{ reply: string; graph_update: any; mastery_changes: any[] }>('/api/learn/chat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, user_id: userId, message, mode, use_shared_context: useSharedContext }),
  });

export const sendAction = (sessionId: string, userId: string, actionType: string, mode: string, useSharedContext = true) =>
  fetchJSON<{ reply: string; graph_update: any }>('/api/learn/action', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, user_id: userId, action_type: actionType, mode, use_shared_context: useSharedContext }),
  });

export const switchMode = (sessionId: string, userId: string, newMode: string) =>
  fetchJSON<{ reply: string }>('/api/learn/mode-switch', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, user_id: userId, new_mode: newMode }),
  });

export const endSession = (sessionId: string) =>
  fetchJSON<{ summary: any }>('/api/learn/end-session', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });

export const getSessions = (userId: string, limit = 10) =>
  fetchJSON<{
    sessions: {
      id: string;
      topic: string;
      mode: string;
      started_at: string;
      ended_at: string | null;
      message_count: number;
      is_active: boolean;
    }[];
  }>(`/api/learn/sessions/${userId}?limit=${limit}`);

export const resumeSession = (sessionId: string) =>
  fetchJSON<{
    session: { id: string; topic: string; mode: string; started_at: string; ended_at: string | null };
    messages: { id: string; role: string; content: string; created_at: string }[];
  }>(`/api/learn/sessions/${sessionId}/resume`);

// ── Quiz ──────────────────────────────────────────────────────────────────────

export const generateQuiz = (userId: string, conceptNodeId: string, numQuestions: number, difficulty: string, useSharedContext = true) =>
  fetchJSON<{ quiz_id: string; questions: any[] }>('/api/quiz/generate', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, concept_node_id: conceptNodeId, num_questions: numQuestions, difficulty, use_shared_context: useSharedContext }),
  });

export const submitQuiz = (quizId: string, answers: any[]) =>
  fetchJSON<{ score: number; total: number; mastery_before: number; mastery_after: number; results: any[] }>('/api/quiz/submit', {
    method: 'POST',
    body: JSON.stringify({ quiz_id: quizId, answers }),
  });

// ── Calendar ──────────────────────────────────────────────────────────────────

export const extractSyllabus = (formData: FormData, userId?: string): Promise<any> => {
  if (userId) formData.set('user_id', userId);
  return fetch(`${API_URL}/api/calendar/extract`, {
    method: 'POST',
    body: formData,
  }).then(r => r.json());
};

export const getUpcomingAssignments = (userId: string) =>
  fetchJSON<{ assignments: any[] }>(`/api/calendar/upcoming/${userId}`);

export const saveAssignments = (userId: string, assignments: any[]) =>
  fetchJSON<{ saved_count: number }>('/api/calendar/save', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, assignments }),
  });

export const getCalendarAuthUrl = (userId: string) =>
  fetchJSON<{ url: string }>(`/api/calendar/auth-url?user_id=${encodeURIComponent(userId)}`);

export const getCalendarStatus = (userId: string) =>
  fetchJSON<{ connected: boolean; expires_at?: string }>(`/api/calendar/status/${userId}`);
export const checkCalendarStatus = getCalendarStatus;

export const syncToGoogleCalendar = (userId: string) =>
  fetchJSON<{ synced_count: number }>('/api/calendar/sync', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

export const exportToGoogleCalendar = (userId: string, assignmentIds: string[]) =>
  fetchJSON<{ exported_count: number; skipped_count: number }>('/api/calendar/export', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, assignment_ids: assignmentIds }),
  });

export const importGoogleEvents = (userId: string, daysAhead = 30) =>
  fetchJSON<{ events: any[]; count: number }>(
    `/api/calendar/import/${userId}?days_ahead=${daysAhead}`
  );

export const disconnectGoogleCalendar = (userId: string) =>
  fetchJSON<{ disconnected: boolean }>(`/api/calendar/disconnect/${userId}`, {
    method: 'DELETE',
  });

// ── Social ────────────────────────────────────────────────────────────────────

export const createRoom = (userId: string, roomName: string) =>
  fetchJSON<{ room_id: string; invite_code: string }>('/api/social/rooms/create', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, room_name: roomName }),
  });

export const joinRoom = (userId: string, inviteCode: string) =>
  fetchJSON<{ room: any }>('/api/social/rooms/join', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, invite_code: inviteCode }),
  });

export const getUserRooms = (userId: string) =>
  fetchJSON<{ rooms: any[] }>(`/api/social/rooms/${userId}`);

export const getRoomOverview = (roomId: string) =>
  fetchJSON<{ room: any; members: any[]; ai_summary: string }>(`/api/social/rooms/${roomId}/overview`);

export const getRoomActivity = (roomId: string) =>
  fetchJSON<{ activities: any[] }>(`/api/social/rooms/${roomId}/activity`);

export const findStudyMatches = (roomId: string, userId: string) =>
  fetchJSON<{ matches: any[] }>(`/api/social/rooms/${roomId}/match`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

export const findSchoolMatches = (userId: string) =>
  fetchJSON<{ matches: any[] }>('/api/social/school-match', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

export const getSchoolStudents = () =>
  fetchJSON<{ students: any[] }>('/api/social/students');