---
name: react-patterns
description: React 19 architecture patterns — hooks, context, state management (Zustand/Redux Toolkit), React Query, TypeScript strict, performance optimization, testing patterns with Vitest/RTL.
origin: chrysa
---

# React Development Patterns

Modern React 19 patterns for the chrysa ecosystem (TypeScript strict, Tailwind, shadcn/ui).

## When to Activate

- Building React 19 applications
- Designing component architecture and state management
- Implementing React Query / data fetching patterns
- Optimizing performance (memoization, code splitting)
- Testing with Vitest and React Testing Library

## Project Structure (from react-app-generator)

```text
src/
├── app/                  # App shell, routing, providers
│   ├── App.tsx
│   ├── providers.tsx     # All context providers
│   └── router.tsx        # React Router v7 config
├── features/             # Feature-sliced design
│   └── users/
│       ├── api/          # React Query hooks
│       ├── components/   # Feature-scoped components
│       ├── hooks/        # Feature-scoped hooks
│       ├── store/        # Zustand slice (if needed)
│       └── types.ts
├── shared/
│   ├── components/       # Reusable UI (shadcn/ui)
│   ├── hooks/            # Generic hooks
│   ├── lib/              # Utilities, API client
│   └── types/            # Global types
└── constants/            # App-wide constants (as const)
```

## Component Patterns

```tsx
// Co-located types
interface UserCardProps {
  userId: string;
  onSelect?: (id: string) => void;
}

// Compound components for flexible APIs
export function UserCard({ userId, onSelect }: UserCardProps) {
  const { data: user, isLoading } = useUser(userId);

  if (isLoading) return <UserCard.Skeleton />;
  if (!user) return null;

  return (
    <Card onClick={() => onSelect?.(userId)}>
      <UserCard.Avatar src={user.avatar} />
      <UserCard.Info name={user.name} email={user.email} />
    </Card>
  );
}

UserCard.Skeleton = function Skeleton() { return <Skeleton className="h-16" />; };
```

## React Query Patterns

```tsx
// Query factory for consistent key management
const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};

function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

## Zustand State Management

```tsx
// Feature slice pattern
interface BearState {
  count: number;
  increment: () => void;
  reset: () => void;
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      (set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
        reset: () => set({ count: 0 }),
      }),
      { name: 'bear-storage' }
    )
  )
);

// Selector pattern (prevents unnecessary re-renders)
const count = useBearStore((s) => s.count);
```

## Custom Hooks

```tsx
// Encapsulate complex logic, not just reuse
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Hook for async operations with loading/error state
function useAsync<T>(asyncFn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: Error }>({
    loading: true,
  });
  useEffect(() => {
    asyncFn().then((data) => setState({ data, loading: false }))
             .catch((error) => setState({ loading: false, error }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
```

## Performance Patterns

```tsx
// React.memo for expensive pure components
const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
  return <>{items.map(item => <Item key={item.id} {...item} />)}</>;
});

// useMemo: only for genuinely expensive calculations (>1ms)
const sortedItems = useMemo(
  () => items.toSorted((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// useCallback: stabilize callbacks passed to memoized children
const handleDelete = useCallback((id: string) => {
  deleteItem(id);
}, [deleteItem]);

// Code splitting
const HeavyPage = lazy(() => import('./pages/HeavyPage'));
```

## TypeScript Patterns

```tsx
// Discriminated unions for state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Generic component with constraint
function Select<T extends { id: string; label: string }>({
  options,
  onChange,
}: {
  options: T[];
  onChange: (item: T) => void;
}) { /* ... */ }

// Utility types for API responses
type ApiResponse<T> = {
  data: T;
  meta: { total: number; page: number };
};
```

## Testing (Vitest + RTL)

```tsx
describe('UserCard', () => {
  it('renders user info when data loads', async () => {
    server.use(
      http.get('/api/users/1', () => HttpResponse.json({ id: '1', name: 'Alice' }))
    );

    render(<UserCard userId="1" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument(); // skeleton
    await waitForElementToBeRemoved(() => screen.queryByRole('progressbar'));
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
```

## Performance Checklist

- [ ] No anonymous functions in JSX props passed to memoized children
- [ ] Large lists: `@tanstack/react-virtual` or windowing
- [ ] Images: `loading="lazy"`, proper `width`/`height`, WebP format
- [ ] Bundle: analyze with `vite-bundle-visualizer`, split at route level
- [ ] React DevTools Profiler: no unnecessary re-renders in hot paths
