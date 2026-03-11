# Sapling Frontend — Test Suite

All frontend tests live in `src/__tests__/`. Tests use **Jest** + **React Testing Library** and run fully offline (no backend required).

---

## Quick start

```bash
# From the frontend/ directory
cd frontend
npm test               # run all tests once
npm run test:watch     # watch mode — re-runs on file save
```

---

## Test files

| File | What it covers |
|---|---|
| `graphUtils.test.ts` | All pure utility functions in `lib/graphUtils.ts` — colour mapping, mastery labels, radius, edge filtering, graph diffing, date formatting |
| `api.test.ts` | Every function in `lib/api.ts` — verifies correct URL, HTTP method, and request body; tests error handling when the server returns a non-OK status |
| `chatPanel.test.tsx` | `ChatPanel` component — message rendering, send button state, Enter-key submission, hint/confused/skip actions, loading indicator |
| `sessionSummary.test.tsx` | `SessionSummary` component — concepts covered, mastery change deltas, time spent (singular/plural), recommended next, button callbacks |
| `dataFetching.test.tsx` | useEffect fetch guards — ensures pages don't fetch before `userReady`, and re-fetch when `userId` changes |
| `hydration.test.tsx` | Next.js hydration and SearchParams safety |
| `userContext.test.tsx` | `UserContext` provider — user list loading, active user switching |

---

## Adding new tests

- **Pure functions** (utilities, helpers) → `graphUtils.test.ts` or a new `*.test.ts`
- **API calls** → `api.test.ts` — mock `global.fetch`, assert on URL/method/body
- **Components** → new `componentName.test.tsx` — use `@testing-library/react`, query by role/text, avoid testing implementation details

### Mocking fetch

```ts
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ your: 'data' }),
    text: () => Promise.resolve(''),
  }) as jest.Mock;
});
afterEach(() => jest.resetAllMocks());
```

### Mocking the API module

```ts
jest.mock('@/lib/api', () => ({
  getGraph: jest.fn(() => Promise.resolve({ nodes: [], edges: [], stats: {} })),
}));
```
