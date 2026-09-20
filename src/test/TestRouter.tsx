import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";

/** Opt into React Router v7 behavior early (silences upgrade warnings in tests). */
const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

/** MemoryRouter with React Router v7 future flags enabled. */
export function TestRouter({ children, ...props }: MemoryRouterProps) {
  return (
    <MemoryRouter future={routerFutureFlags} {...props}>
      {children}
    </MemoryRouter>
  );
}
