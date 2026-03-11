/**
 * Tests for lib/api.ts
 *
 * Verifies that each exported function calls the correct URL, HTTP method,
 * and request body, and that errors from the server are surfaced correctly.
 * `global.fetch` is mocked — no real network traffic.
 */

// Silence Next.js build warnings about NEXT_PUBLIC_ env in test
process.env.NEXT_PUBLIC_API_URL = '';

import {
  getUsers,
  getGraph,
  getRecommendations,
  getCourses,
  addCourse,
  updateCourseColor,
  deleteCourse,
  startSession,
  sendChat,
  sendAction,
  endSession,
  getSessions,
  generateQuiz,
  submitQuiz,
  getUpcomingAssignments,
  saveAssignments,
  getCalendarStatus,
  syncToGoogleCalendar,
  exportToGoogleCalendar,
  importGoogleEvents,
  disconnectGoogleCalendar,
} from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetch(data: unknown, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(ok ? '' : JSON.stringify(data)),
  }) as jest.Mock;
}

function lastCall() {
  return (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit | undefined];
}

afterEach(() => jest.resetAllMocks());

// ── fetchJSON error handling ──────────────────────────────────────────────────

describe('fetchJSON error handling', () => {
  it('throws when server returns a non-OK status', async () => {
    mockFetch('Not found', false, 404);
    await expect(getGraph('u1')).rejects.toThrow();
  });

  it('includes the status code in the error message when body is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    }) as jest.Mock;
    await expect(getGraph('u1')).rejects.toThrow('HTTP 502');
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────

describe('getUsers', () => {
  it('GET /api/users', async () => {
    mockFetch({ users: [] });
    await getUsers();
    const [url, opts] = lastCall();
    expect(url).toBe('/api/users');
    expect(opts?.method).toBeUndefined(); // default GET
  });
});

// ── Graph ─────────────────────────────────────────────────────────────────────

describe('getGraph', () => {
  it('GET /api/graph/:userId', async () => {
    mockFetch({ nodes: [], edges: [], stats: {} });
    await getGraph('user_andres');
    expect(lastCall()[0]).toBe('/api/graph/user_andres');
  });
});

describe('getRecommendations', () => {
  it('GET /api/graph/:userId/recommendations', async () => {
    mockFetch({ recommendations: [] });
    await getRecommendations('user_andres');
    expect(lastCall()[0]).toBe('/api/graph/user_andres/recommendations');
  });
});

describe('getCourses', () => {
  it('GET /api/graph/:userId/courses', async () => {
    mockFetch({ courses: [] });
    await getCourses('user_andres');
    expect(lastCall()[0]).toBe('/api/graph/user_andres/courses');
  });
});

describe('addCourse', () => {
  it('POST /api/graph/:userId/courses with course_name', async () => {
    mockFetch({ course_name: 'Math', already_existed: false });
    await addCourse('user_andres', 'Math');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/graph/user_andres/courses');
    expect(opts?.method).toBe('POST');
    expect(JSON.parse(opts?.body as string)).toMatchObject({ course_name: 'Math' });
  });

  it('includes color when provided', async () => {
    mockFetch({ course_name: 'Math', already_existed: false });
    await addCourse('user_andres', 'Math', '#ff0000');
    const body = JSON.parse(lastCall()[1]?.body as string);
    expect(body.color).toBe('#ff0000');
  });
});

describe('updateCourseColor', () => {
  it('PATCH /api/graph/:userId/courses/:name/color', async () => {
    mockFetch({ updated: true });
    await updateCourseColor('user_andres', 'Math', '#123456');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/graph/user_andres/courses/Math/color');
    expect(opts?.method).toBe('PATCH');
    expect(JSON.parse(opts?.body as string)).toEqual({ color: '#123456' });
  });

  it('URL-encodes course names with spaces', async () => {
    mockFetch({ updated: true });
    await updateCourseColor('user_andres', 'Linear Algebra', '#fff');
    expect(lastCall()[0]).toBe('/api/graph/user_andres/courses/Linear%20Algebra/color');
  });
});

describe('deleteCourse', () => {
  it('DELETE /api/graph/:userId/courses/:name', async () => {
    mockFetch({ deleted: true });
    await deleteCourse('user_andres', 'Math');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/graph/user_andres/courses/Math');
    expect(opts?.method).toBe('DELETE');
  });
});

// ── Learn ─────────────────────────────────────────────────────────────────────

describe('startSession', () => {
  it('POST /api/learn/start-session with correct body', async () => {
    mockFetch({ session_id: 's1', initial_message: 'Hi', graph_state: {} });
    await startSession('user_andres', 'Recursion', 'socratic');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/learn/start-session');
    expect(opts?.method).toBe('POST');
    const body = JSON.parse(opts?.body as string);
    expect(body).toMatchObject({ user_id: 'user_andres', topic: 'Recursion', mode: 'socratic' });
  });
});

describe('sendChat', () => {
  it('POST /api/learn/chat with session_id and message', async () => {
    mockFetch({ reply: 'Hello', graph_update: {}, mastery_changes: [] });
    await sendChat('s1', 'user_andres', 'Hello?', 'socratic');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/learn/chat');
    const body = JSON.parse(opts?.body as string);
    expect(body).toMatchObject({ session_id: 's1', user_id: 'user_andres', message: 'Hello?' });
  });
});

describe('sendAction', () => {
  it('POST /api/learn/action with action_type', async () => {
    mockFetch({ reply: 'Here is a hint', graph_update: {} });
    await sendAction('s1', 'user_andres', 'hint', 'socratic');
    const body = JSON.parse(lastCall()[1]?.body as string);
    expect(body).toMatchObject({ session_id: 's1', action_type: 'hint' });
  });
});

describe('endSession', () => {
  it('POST /api/learn/end-session with session_id', async () => {
    mockFetch({ summary: {} });
    await endSession('s1');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/learn/end-session');
    expect(JSON.parse(opts?.body as string)).toEqual({ session_id: 's1' });
  });
});

describe('getSessions', () => {
  it('GET /api/learn/sessions/:userId?limit=N', async () => {
    mockFetch({ sessions: [] });
    await getSessions('user_andres', 5);
    expect(lastCall()[0]).toBe('/api/learn/sessions/user_andres?limit=5');
  });

  it('defaults to limit=10', async () => {
    mockFetch({ sessions: [] });
    await getSessions('user_andres');
    expect(lastCall()[0]).toContain('limit=10');
  });
});

// ── Quiz ──────────────────────────────────────────────────────────────────────

describe('generateQuiz', () => {
  it('POST /api/quiz/generate with correct body', async () => {
    mockFetch({ quiz_id: 'q1', questions: [] });
    await generateQuiz('user_andres', 'node1', 5, 'medium');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/quiz/generate');
    const body = JSON.parse(opts?.body as string);
    expect(body).toMatchObject({
      user_id: 'user_andres',
      concept_node_id: 'node1',
      num_questions: 5,
      difficulty: 'medium',
    });
  });
});

describe('submitQuiz', () => {
  it('POST /api/quiz/submit with quiz_id and answers', async () => {
    mockFetch({ score: 4, total: 5, mastery_before: 0.5, mastery_after: 0.62, results: [] });
    const answers = [{ question_id: 1, selected_label: 'A' }];
    await submitQuiz('q1', answers);
    const [url, opts] = lastCall();
    expect(url).toBe('/api/quiz/submit');
    const body = JSON.parse(opts?.body as string);
    expect(body).toEqual({ quiz_id: 'q1', answers });
  });
});

// ── Calendar ──────────────────────────────────────────────────────────────────

describe('getUpcomingAssignments', () => {
  it('GET /api/calendar/upcoming/:userId', async () => {
    mockFetch({ assignments: [] });
    await getUpcomingAssignments('user_andres');
    expect(lastCall()[0]).toBe('/api/calendar/upcoming/user_andres');
  });
});

describe('saveAssignments', () => {
  it('POST /api/calendar/save with user_id and assignments', async () => {
    mockFetch({ saved_count: 2 });
    const assignments = [{ title: 'HW1', due_date: '2026-03-01', assignment_type: 'homework', course_name: '' }];
    await saveAssignments('user_andres', assignments);
    const [url, opts] = lastCall();
    expect(url).toBe('/api/calendar/save');
    const body = JSON.parse(opts?.body as string);
    expect(body).toMatchObject({ user_id: 'user_andres', assignments });
  });
});

describe('getCalendarStatus', () => {
  it('GET /api/calendar/status/:userId', async () => {
    mockFetch({ connected: false });
    await getCalendarStatus('user_andres');
    expect(lastCall()[0]).toBe('/api/calendar/status/user_andres');
  });
});

describe('syncToGoogleCalendar', () => {
  it('POST /api/calendar/sync with user_id', async () => {
    mockFetch({ synced_count: 3 });
    await syncToGoogleCalendar('user_andres');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/calendar/sync');
    expect(JSON.parse(opts?.body as string)).toEqual({ user_id: 'user_andres' });
  });
});

describe('exportToGoogleCalendar', () => {
  it('POST /api/calendar/export with user_id and assignment_ids', async () => {
    mockFetch({ exported_count: 1, skipped_count: 0 });
    await exportToGoogleCalendar('user_andres', ['a1', 'a2']);
    const body = JSON.parse(lastCall()[1]?.body as string);
    expect(body).toEqual({ user_id: 'user_andres', assignment_ids: ['a1', 'a2'] });
  });
});

describe('importGoogleEvents', () => {
  it('GET /api/calendar/import/:userId?days_ahead=N', async () => {
    mockFetch({ events: [], count: 0 });
    await importGoogleEvents('user_andres', 14);
    expect(lastCall()[0]).toBe('/api/calendar/import/user_andres?days_ahead=14');
  });

  it('defaults to days_ahead=30', async () => {
    mockFetch({ events: [], count: 0 });
    await importGoogleEvents('user_andres');
    expect(lastCall()[0]).toContain('days_ahead=30');
  });
});

describe('disconnectGoogleCalendar', () => {
  it('DELETE /api/calendar/disconnect/:userId', async () => {
    mockFetch({ disconnected: true });
    await disconnectGoogleCalendar('user_andres');
    const [url, opts] = lastCall();
    expect(url).toBe('/api/calendar/disconnect/user_andres');
    expect(opts?.method).toBe('DELETE');
  });
});
