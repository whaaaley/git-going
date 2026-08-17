import { describe, it } from 'node:test'
import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { buildManifest, formatSummary, isFailure, parseBunSummary, parseNodeSummary } from './runtimes.report.ts'

describe('All Runtime Report Tests', () => {
  describe('reading a node summary', () => {
    it('reads the pass and fail counts', () => {
      // Arrange
      const output = ['ℹ tests 21', 'ℹ pass 21', 'ℹ fail 0'].join('\n')

      // Act
      const summary = parseNodeSummary(output)

      // Assert
      assertEquals(summary, { passed: 21, failed: 0 })
    })

    it('reads a failure count', () => {
      // Arrange
      const output = ['ℹ pass 15', 'ℹ fail 1'].join('\n')

      // Act
      const summary = parseNodeSummary(output)

      // Assert
      assertEquals(summary, { passed: 15, failed: 1 })
    })

    it('reads counts through the colour codes the runtime emits when piped', () => {
      // Arrange
      const output = ['\u001b[34mℹ pass 21\u001b[39m', '\u001b[34mℹ fail 0\u001b[39m'].join('\n')

      // Act
      const summary = parseNodeSummary(output)

      // Assert
      assertEquals(summary, { passed: 21, failed: 0 })
    })

    it('reports zero when the runtime printed no summary', () => {
      // Act
      const summary = parseNodeSummary('command not found')

      // Assert
      assertEquals(summary, { passed: 0, failed: 0 })
    })
  })

  describe('reading a bun summary', () => {
    it('reads the pass and fail counts', () => {
      // Arrange
      const output = [' 21 pass', ' 0 fail', 'Ran 21 tests across 2 files.'].join('\n')

      // Act
      const summary = parseBunSummary(output)

      // Assert
      assertEquals(summary, { passed: 21, failed: 0 })
    })

    it('reports zero when the runtime printed no summary', () => {
      // Act
      const summary = parseBunSummary('')

      // Assert
      assertEquals(summary, { passed: 0, failed: 0 })
    })
  })

  describe('judging a run', () => {
    it('treats a reported failure as a failure', () => {
      // Assert
      assert(isFailure({ runtime: 'node', version: '26.7.0', passed: 20, failed: 1 }))
    })

    it('treats a run that passed nothing as a failure', () => {
      // Assert
      assert(isFailure({ runtime: 'bun', version: '1.3.14', passed: 0, failed: 0 }))
    })

    it('treats a run that passed with no failure as a pass', () => {
      // Assert
      assertEquals(isFailure({ runtime: 'node', version: '26.7.0', passed: 21, failed: 0 }), false)
    })
  })

  describe('summarising a set of runs', () => {
    it('names every run and reports the set as passing', () => {
      // Arrange
      const results = [
        { runtime: 'node', version: '24.19.0', passed: 21, failed: 0 },
        { runtime: 'bun', version: '1.3.14', passed: 21, failed: 0 },
      ]

      // Act
      const lines = formatSummary(results).join('\n')

      // Assert
      assertStringIncludes(lines, 'ok  node 24.19.0  21 passed, 0 failed')
      assertStringIncludes(lines, 'All 2 runtime runs passed.')
    })

    it('counts the failing runs when one fails', () => {
      // Arrange
      const results = [
        { runtime: 'node', version: '24.19.0', passed: 21, failed: 0 },
        { runtime: 'bun', version: '1.3.14', passed: 20, failed: 1 },
      ]

      // Act
      const lines = formatSummary(results).join('\n')

      // Assert
      assertStringIncludes(lines, 'FAIL  bun 1.3.14')
      assertStringIncludes(lines, '1 of 2 runtime runs failed.')
    })
  })

  describe('building the staged manifest', () => {
    it('carries the dependencies the runtimes resolve through', () => {
      // Act
      const manifest = buildManifest({ '@std/assert': 'npm:@jsr/std__assert@^1.0.19' }, { '@types/node': '^26.2.0' })

      // Assert
      assertStringIncludes(manifest, '"@std/assert": "npm:@jsr/std__assert@^1.0.19"')
      assertStringIncludes(manifest, '"@types/node": "^26.2.0"')
    })

    it('marks the manifest private so it is never mistaken for a published package', () => {
      // Act
      const manifest = buildManifest({}, {})

      // Assert
      assertStringIncludes(manifest, '"private": true')
    })
  })
})
