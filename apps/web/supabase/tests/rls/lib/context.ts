// What global-setup.ts hands every test file through Vitest's provide/inject: one session per actor, made once.
import type { ActorName } from './seed'

export interface ActorSession { id: string | null; email: string | null; token: string | null; aal: 'aal1' | 'aal2' | null }
export interface RlsContext { runId: string; actors: Record<ActorName, ActorSession> }

declare module 'vitest' {
  interface ProvidedContext {
    rls: RlsContext
  }
}
