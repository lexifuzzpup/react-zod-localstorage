# react-zod-localstorage

A lightweight library for reading/writing localStorage with zod, as a React hook

## Example:
```tsx
import z from "zod";
import { useLocalStorageJson } from "react-zod-localstorage";

const User = z.object({
    username: z.string(),
    email: z.string()
});

export function SelfCard() {
    const [ user, setUser ] = useLocalStorageJson("user", User);

    return (
        <div>
            <span>Logged in as { user?.username ?? "anonymous" }.</span>
            { user && <>
                <span>Your email is { user.email }.</span>
                <button onClick={() => setUser(undefined)}>Log out</button>
            </> }
        </div>
    )
}
```

To install dependencies:

```bash
bun install
```

To test:

```bash
bun test
```