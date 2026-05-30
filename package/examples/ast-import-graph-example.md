# AST Import Graph Example

Hyperdrive v3 loads the host repository's `typescript` package and resolves runtime imports through the TypeScript compiler API.

## Bad: client graph reaches server code

```tsx
// app/components/account-button.tsx
'use client';

import { getCurrentUser } from '@/lib/server/users';

export function AccountButton() {
  return <button>{getCurrentUser().name}</button>;
}
```

```ts
// lib/server/users.ts
import 'server-only';
import { prisma } from '@/lib/server/prisma';

export async function getCurrentUser() {
  return prisma.user.findFirstOrThrow();
}
```

Hyperdrive reports `architecture/client-graph-imports-server-code` and emits an autofix suggestion to split the client leaf from the server data function.

## Better

```tsx
// app/account/account-button.client.tsx
'use client';

export function AccountButtonClient({ name }: { name: string }) {
  return <button>{name}</button>;
}
```

```tsx
// app/account/account-button.tsx
import { getCurrentUser } from '@/lib/server/users';
import { AccountButtonClient } from './account-button.client';

export async function AccountButton() {
  const user = await getCurrentUser();
  return <AccountButtonClient name={user.name} />;
}
```

## Bad: route handler imports client code

```ts
// app/api/example/route.ts
import { Modal } from '@/components/modal';

export async function POST() {
  return Response.json({ ok: true });
}
```

If `Modal` is a Client Component, Hyperdrive reports `architecture/server-runtime-imports-client-code`.

## Graph command

```bash
hyperdrive-auditor --root . --profile ci --graph-output hyperdrive-graph.json --fix-suggestions-output hyperdrive-fixes.json
```
