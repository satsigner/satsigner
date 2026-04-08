---
paths:
  - "apps/mobile/**/*.{ts,tsx}"
---

# Best Practices

1. Avoid using `useEffect`;
2. We are using react-compiler, so avoid using `useMemo`, `memo`, and `useCallback`;
3. Avoid duplicating code. Use or create `util`, `api`, or `store` functions;
4. Avoid using `any`;
5. Avoid Typescript casting (`as Something`);
6. Avoid having business logic in components and page components. Extract these functions to other files;
7. Don't write useless or divider comments. Only write comments if really needed. The code should speak for itself;
8. Try to not duplicate `types`. Place them in the `types` folder;
9. Code must be readable. No nested conditional logic, nested try/catch, or too much complexity in one function;
10. Use `i18n` strings. Add them in `locales` folder if not already present in `*.json` files;
11. Try to write tests when you code a new feature;
12. Components should be responsible for receiving data through props and rendering it. Business logic should be kept separate and not placed within components;
13. We are using react-compiler, so only use `useMemo`, `memo`, and `useCallback` when strictly necessary;
14. Prefix all reusable components with `SS` — you already follow this convention (`SSButton`, `SSText`, etc.);
15. Name hooks with `use` + domain + action (e.g., `useAccountSync`, `useTransactionBroadcast`);
16. Use `FlashList` over `FlatList`.
