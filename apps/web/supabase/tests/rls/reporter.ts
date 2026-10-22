// The gate's count (BUILD-PROMPT R1 foundation: "every actor × table × operation passes, with the count"):
// one line at the end of the run, "RLS: <passed>/<total> checks".
import type { Reporter, TestModule } from 'vitest/node'

export default class RlsCountReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    let passed = 0
    let total = 0
    let notRun = 0
    for (const m of testModules) {
      if (m.project.name !== 'rls') continue
      const tests = [...m.children.allTests()]
      if (!tests.length && m.state() === 'failed') notRun++
      for (const t of tests) {
        total++
        if (t.result().state === 'passed') passed++
      }
    }
    if (!total && !notRun) return
    process.stdout.write(`\nRLS: ${passed}/${total} checks\n`)
    if (notRun) process.stdout.write(`(${notRun} test file(s) failed before any check ran)\n`)
  }
}
