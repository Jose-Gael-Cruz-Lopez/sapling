/**
 * Tests for lib/graphUtils.ts — all exported pure utility functions.
 * No component rendering, no API calls, no mocks needed.
 */
import {
  hexToCourseColor,
  getCourseColor,
  getMasteryColor,
  getMasteryHighlightColor,
  getMasteryLabel,
  getNodeRadius,
  filterCrossSubjectEdges,
  computeGraphDiff,
  formatRelativeTime,
  formatDueDate,
  daysUntil,
  PRESET_COURSE_COLORS,
} from '@/lib/graphUtils';
import type { GraphNode, GraphEdge } from '@/lib/types';

// ── hexToCourseColor ──────────────────────────────────────────────────────────

describe('hexToCourseColor', () => {
  it('builds correct rgba values from a valid hex', () => {
    const result = hexToCourseColor('#ff0000');
    expect(result.fill).toBe('#ff0000');
    expect(result.bg).toMatch(/^rgba\(255,0,0,/);
    expect(result.border).toMatch(/^rgba\(255,0,0,/);
  });

  it('returns the first palette colour for an invalid hex', () => {
    const fallback = hexToCourseColor('not-a-hex');
    expect(fallback.fill).toBe(PRESET_COURSE_COLORS[0]);
  });

  it('returns the first palette colour for a 3-digit hex shorthand', () => {
    // Our implementation requires 6-digit hex
    const fallback = hexToCourseColor('#fff');
    expect(fallback.fill).toBe(PRESET_COURSE_COLORS[0]);
  });
});

// ── getCourseColor ────────────────────────────────────────────────────────────

describe('getCourseColor', () => {
  it('returns a colour object with required shape', () => {
    const result = getCourseColor('Mathematics');
    expect(result).toHaveProperty('fill');
    expect(result).toHaveProperty('bg');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('border');
  });

  it('is deterministic — same input always yields same colour', () => {
    expect(getCourseColor('CS101')).toEqual(getCourseColor('CS101'));
  });

  it('maps different subjects to palette colours (may differ)', () => {
    // Two sufficiently different strings should hash to different indices at least sometimes
    const colours = new Set(
      ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'].map(s => getCourseColor(s).fill)
    );
    expect(colours.size).toBeGreaterThan(1);
  });

  it('returns first palette colour for empty string', () => {
    expect(getCourseColor('').fill).toBe(PRESET_COURSE_COLORS[0]);
  });

  it('respects a valid overrideHex', () => {
    const result = getCourseColor('Math', '#123456');
    expect(result.fill).toBe('#123456');
  });

  it('ignores an invalid overrideHex and falls back to hash', () => {
    const withOverride  = getCourseColor('Math', 'not-a-hex');
    const withoutOverride = getCourseColor('Math');
    expect(withOverride).toEqual(withoutOverride);
  });
});

// ── getMasteryColor / getMasteryHighlightColor ────────────────────────────────

describe('getMasteryColor', () => {
  it.each([
    ['mastered',     '#16a34a'],
    ['learning',     '#d97706'],
    ['struggling',   '#dc2626'],
    ['unexplored',   '#6b7280'],
    ['subject_root', '#7c3aed'],
  ])('returns correct colour for %s', (tier, expected) => {
    expect(getMasteryColor(tier)).toBe(expected);
  });

  it('returns fallback for unknown tier', () => {
    expect(getMasteryColor('invented_tier')).toBe('#475569');
  });
});

describe('getMasteryHighlightColor', () => {
  it('returns a highlight for mastered', () => {
    expect(getMasteryHighlightColor('mastered')).toBe('#86efac');
  });

  it('returns fallback for unknown tier', () => {
    expect(getMasteryHighlightColor('???')).toBe('#94a3b8');
  });
});

// ── getMasteryLabel ───────────────────────────────────────────────────────────

describe('getMasteryLabel', () => {
  it('formats 0.0 as 0%', () => {
    expect(getMasteryLabel(0.0)).toBe('0%');
  });

  it('formats 1.0 as 100%', () => {
    expect(getMasteryLabel(1.0)).toBe('100%');
  });

  it('rounds to nearest integer', () => {
    expect(getMasteryLabel(0.456)).toBe('46%');
    expect(getMasteryLabel(0.754)).toBe('75%');
  });
});

// ── getNodeRadius ─────────────────────────────────────────────────────────────

describe('getNodeRadius', () => {
  it('returns minimum radius (7) at mastery 0', () => {
    expect(getNodeRadius(0)).toBe(7);
  });

  it('returns maximum radius (14) at mastery 1', () => {
    expect(getNodeRadius(1)).toBe(14);
  });

  it('scales linearly between 0 and 1', () => {
    expect(getNodeRadius(0.5)).toBe(10.5);
  });
});

// ── filterCrossSubjectEdges ───────────────────────────────────────────────────

function makeNode(id: string, subject: string): GraphNode {
  return { id, concept_name: id, mastery_score: 0.5, mastery_tier: 'learning', times_studied: 0, last_studied_at: null, subject };
}

function makeEdge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target, strength: 0.7 };
}

describe('filterCrossSubjectEdges', () => {
  it('keeps edges within the same subject', () => {
    const nodes = [makeNode('a', 'Math'), makeNode('b', 'Math')];
    const edges = [makeEdge('e1', 'a', 'b')];
    expect(filterCrossSubjectEdges(nodes, edges)).toHaveLength(1);
  });

  it('removes edges that cross subject boundaries', () => {
    const nodes = [makeNode('a', 'Math'), makeNode('b', 'CS')];
    const edges = [makeEdge('e1', 'a', 'b')];
    expect(filterCrossSubjectEdges(nodes, edges)).toHaveLength(0);
  });

  it('always keeps subject_root__ edges regardless of subjects', () => {
    const nodes = [makeNode('a', 'Math'), makeNode('subject_root__CS', 'CS')];
    const edges = [makeEdge('e1', 'subject_root__CS', 'a')];
    expect(filterCrossSubjectEdges(nodes, edges)).toHaveLength(1);
  });

  it('returns empty array when no edges', () => {
    const nodes = [makeNode('a', 'Math')];
    expect(filterCrossSubjectEdges(nodes, [])).toHaveLength(0);
  });
});

// ── computeGraphDiff ──────────────────────────────────────────────────────────

describe('computeGraphDiff', () => {
  it('detects new nodes', () => {
    const prev: GraphNode[] = [];
    const next = [makeNode('n1', 'Math')];
    const { newNodeIds } = computeGraphDiff(prev, next, [], []);
    expect(newNodeIds.has('n1')).toBe(true);
  });

  it('detects mastery tier changes as updated nodes', () => {
    const prev = [{ ...makeNode('n1', 'Math'), mastery_tier: 'learning' as const }];
    const next = [{ ...makeNode('n1', 'Math'), mastery_tier: 'mastered' as const }];
    const { updatedNodeIds } = computeGraphDiff(prev, next, [], []);
    expect(updatedNodeIds.has('n1')).toBe(true);
  });

  it('does not flag a node as updated when mastery tier is unchanged', () => {
    const node = makeNode('n1', 'Math');
    const { updatedNodeIds } = computeGraphDiff([node], [node], [], []);
    expect(updatedNodeIds.has('n1')).toBe(false);
  });

  it('detects new edges', () => {
    const newEdge = makeEdge('e1', 'a', 'b');
    const { newEdgeIds } = computeGraphDiff([], [], [], [newEdge]);
    expect(newEdgeIds.has('e1')).toBe(true);
  });

  it('does not flag an existing edge as new', () => {
    const edge = makeEdge('e1', 'a', 'b');
    const { newEdgeIds } = computeGraphDiff([], [], [edge], [edge]);
    expect(newEdgeIds.has('e1')).toBe(false);
  });

  it('returns all empty sets when nothing changed', () => {
    const node = makeNode('n1', 'Math');
    const edge = makeEdge('e1', 'a', 'b');
    const { newNodeIds, updatedNodeIds, newEdgeIds } = computeGraphDiff([node], [node], [edge], [edge]);
    expect(newNodeIds.size).toBe(0);
    expect(updatedNodeIds.size).toBe(0);
    expect(newEdgeIds.size).toBe(0);
  });
});

// ── formatRelativeTime ────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const now = Date.now();

  it('returns "Never" for null', () => {
    expect(formatRelativeTime(null)).toBe('Never');
  });

  it('returns "Just now" for less than 1 minute ago', () => {
    const thirtySecondsAgo = new Date(now - 30_000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('Just now');
  });

  it('returns minutes for < 1 hour ago', () => {
    const tenMinutesAgo = new Date(now - 10 * 60_000).toISOString();
    expect(formatRelativeTime(tenMinutesAgo)).toBe('10m ago');
  });

  it('returns hours for < 24 hours ago', () => {
    const threeHoursAgo = new Date(now - 3 * 3_600_000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for >= 24 hours ago', () => {
    const twoDaysAgo = new Date(now - 2 * 86_400_000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
  });
});

// ── formatDueDate ─────────────────────────────────────────────────────────────

describe('formatDueDate', () => {
  it('formats a date as "Mon DD"', () => {
    // '2026-03-15' → "Mar 15"
    const result = formatDueDate('2026-03-15');
    expect(result).toBe('Mar 15');
  });

  it('formats January correctly', () => {
    expect(formatDueDate('2026-01-01')).toBe('Jan 1');
  });

  it('formats December correctly', () => {
    expect(formatDueDate('2026-12-31')).toBe('Dec 31');
  });
});

// ── daysUntil ─────────────────────────────────────────────────────────────────

/** Build a YYYY-MM-DD string in LOCAL time to match how daysUntil parses dates. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil(localDateStr(new Date()))).toBe(0);
  });

  it('returns positive number for a future date', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    expect(daysUntil(localDateStr(future))).toBe(3);
  });

  it('returns negative number for a past date', () => {
    const past = new Date();
    past.setDate(past.getDate() - 2);
    expect(daysUntil(localDateStr(past))).toBe(-2);
  });
});
