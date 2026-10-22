// Vitest (BUILD-PROMPT §0.3). `npm run test:rls` runs the access-rule suite against the hosted dev project
// (docs/07-APP-SPEC.md §6 Tests). It lives in its own project, so its sign-ins (globalSetup) only happen when its
// files are selected; unit tests added later get a project of their own.
import { defineConfig } from 'vitest/config'
import { BaseSequencer, type TestSpecification } from 'vitest/node'
import RlsCountReporter from './supabase/tests/rls/reporter'

// The seed check reads the DEMO data before anything else runs; then the matrix; then the flows.
const RLS_ORDER = ['seed.test.ts', 'matrix.test.ts', 'flows.test.ts']
class RlsOrder extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    const rank = (f: TestSpecification) => {
      const i = RLS_ORDER.findIndex((name) => f.moduleId.endsWith(`/supabase/tests/rls/${name}`))
      return i < 0 ? RLS_ORDER.length : i
    }
    return [...(await super.sort(files))].sort((a, b) => rank(a) - rank(b))
  }
}

export default defineConfig({
  test: {
    reporters: ['default', new RlsCountReporter()],
    fileParallelism: false, // one file at a time: the files share the dev project and the seed's people
    sequence: { sequencer: RlsOrder },
    projects: [
      {
        test: {
          name: 'rls',
          include: ['supabase/tests/rls/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['supabase/tests/rls/global-setup.ts'],
          setupFiles: ['supabase/tests/rls/setup-env.ts'],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 300_000,
        },
      },
    ],
  },
})
