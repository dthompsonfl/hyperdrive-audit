# Type-aware analysis examples

Hyperdrive v4 uses the TypeScript compiler API to create real `Program` instances and inspect symbols with `TypeChecker`. This lets it catch architecture defects that syntax-only scanners miss.

## Runtime import used only as a type

```ts
import { UserRow } from '../server/types';

type Props = {
  row: UserRow;
};
```

Finding:

```txt
value-import-used-only-as-type
```

Suggested remediation:

```ts
import type { UserRow } from '../server/types';
```

This removes erased type dependencies from the runtime graph and prevents accidental client/server contamination.

## Invalid type-only import used as a value

```ts
import type { ClientButton } from './ClientButton';

export const X = ClientButton;
```

Finding:

```txt
type-only-import-used-as-value
```

Type-only imports are erased from emitted JavaScript, so runtime value usage is invalid.

## Client Component exposes non-serializable props

```tsx
'use client';

type Props = {
  label: string;
  onSave: () => void;
};

export function ClientButton(props: Props) {
  return <button onClick={props.onSave}>{props.label}</button>;
}
```

Finding:

```txt
client-component-nonserializable-prop-type
```

Suggested remediation: keep callbacks inside the client leaf or expose a validated Server Action intentionally.

## Server Component passes non-serializable props to a Client Component

```tsx
import { ClientButton } from './ClientButton';

export default function Page() {
  return <ClientButton label="Save" onSave={() => console.log('bad')} />;
}
```

Finding:

```txt
server-passes-nonserializable-prop-to-client-component
```

Suggested remediation: pass primitive/serializable DTO props, move the callback into the client component, or use a validated mutation action.

## Server Action signature leaks unsafe types

```ts
'use server';

export async function save(input: { run: () => void }) {
  return { ok: true };
}
```

Finding:

```txt
server-action-nonserializable-signature
```

Suggested remediation: validate an explicit DTO with zod/valibot and return a serializable result union.
