# Satsigner

Satsigner is a privacy-first bitcoin signer with complete UTXO control. Built on the Bitcoin Development Kit (BDK), Satsigner provides native support for single-signature, multi-signature, and watch-only accounts across mainnet, testnet, and signet networks.

Focused on user experience for everyday use. It also allows easy movements between Bitcoin layers, enhancing the utility of your sats.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Conventional commit titles, plain language: `fix:  skip re-encryption when the PIN is unchanged`.
- Body: the problem in a sentence or two, then how you fixed it.

## Where code lives

- `apps/mobile` - Satsigner mobile app.
- `apps/docs` - Documentation website.

## Security

Security is very important for Satsigner. Audit the code you write for possible security vulnerabilities.

## Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure, UI stays dumb.
- Comments describe how a thing is used, and move when the code moves. To be used mostly to describe functions, not to annotate every line of behavior.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Code best practices

### General

1. Avoid using `useEffect`;
2. We are using react-compiler, so avoid using `useMemo`, `memo`, and `useCallback`;
3. Avoid using `let`. Prefer `const`;
4. Avoid duplicating code, including `types`/`interfaces`.
5. Inferred types over annotations. `any` is the enemy.
6. Avoid Typescript casting (`as Something`);
7. Avoid having business logic in components and page components. Extract these functions to other files;
8. Code must be readable. No nested conditional logic, nested try/catch, or too much complexity in one function;
9. Use `i18n` strings. Add them in `locales` folder if not already present in `*.json` files;
10. Expected to write tests when coding a new feature;
11. Components should be responsible for receiving data through props and rendering it. Business logic should be kept separate and not placed within components;
12. We are using react-compiler, so only use `useMemo`, `memo`, and `useCallback` when strictly necessary;
13. Name hooks with `use` + domain + action (e.g., `useAccountSync`, `useTransactionBroadcast`);
14. Never leave `console.log` or `console.warn` in production code;
15. Avoid using IIFEs;
16. No magic numbers or magic strings. Extract to named constants in `/constants` folder or on the same file if it makes sense;
17. Prefer early returns over nested `if/else`. Guard clauses at top of function, happy path at bottom;
18. For asynchronous state management and server state, prefer using `TanStack Query`;
19. Don't pass locally-defined functions as JSX props. New reference each render causes child re-renders. Hoist outside component or use stable handler.

### For mobile app

1. Use `FlashList` over `FlatList`;
2. Use `expo-secure-store` or encrypted storage from `@/storage/encrypted` to store sensitive data;
3. Prefix all reusable components with `SS` — you already follow this convention (`SSButton`, `SSText`, etc.);

### Important notes

We want the Satsigner codebase to be:

- Maintainable
- Readable
- Testable
- Secure
- Predictable
- Robust
- Performant
