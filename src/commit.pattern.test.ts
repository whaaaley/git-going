import { describe, it } from 'node:test'
import { assert, assertEquals, assertFalse } from '@std/assert'
import { breakingPattern, capitalPattern, punctuationPattern, scopePattern, subjectPattern, typePattern } from './commit.pattern.ts'

describe('All Commit Pattern Tests', () => {
  describe('typePattern', () => {
    it('accepts lowercase letters', () => {
      // Assert
      assert(typePattern.test('feat'))
    })

    it('rejects a capital', () => {
      // Assert
      assertFalse(typePattern.test('Feat'))
    })

    it('rejects a digit', () => {
      // Assert
      assertFalse(typePattern.test('wip2'))
    })

    it('rejects a dash', () => {
      // Assert
      assertFalse(typePattern.test('feat-x'))
    })

    it('rejects the empty string', () => {
      // Assert
      assertFalse(typePattern.test(''))
    })
  })

  describe('scopePattern', () => {
    it('accepts lowercase letters', () => {
      // Assert
      assert(scopePattern.test('server'))
    })

    it('accepts a dash between words', () => {
      // Assert
      assert(scopePattern.test('date-time'))
    })

    it('rejects a capital', () => {
      // Assert
      assertFalse(scopePattern.test('Server'))
    })

    it('rejects a slash', () => {
      // Assert
      assertFalse(scopePattern.test('apps/web'))
    })

    it('rejects a digit', () => {
      // Assert
      assertFalse(scopePattern.test('v2'))
    })

    it('rejects the empty string', () => {
      // Assert
      assertFalse(scopePattern.test(''))
    })
  })

  describe('subjectPattern', () => {
    it('captures the type and description without a scope', () => {
      // Act
      const found = subjectPattern.exec('feat: x')

      // Assert
      assertEquals(found?.slice(1), ['feat', undefined, 'x'])
    })

    it('captures the type, scope, and description', () => {
      // Act
      const found = subjectPattern.exec('feat(scope): x')

      // Assert
      assertEquals(found?.slice(1), ['feat', 'scope', 'x'])
    })

    it('rejects a missing colon', () => {
      // Assert
      assertEquals(subjectPattern.exec('feat add a thing'), null)
    })

    it('rejects a missing space after the colon', () => {
      // Assert
      assertEquals(subjectPattern.exec('feat:x'), null)
    })

    it('rejects an empty description', () => {
      // Assert
      assertEquals(subjectPattern.exec('feat: '), null)
    })

    it('rejects a type outside the type pattern', () => {
      // Assert
      assertEquals(subjectPattern.exec('wip2: x'), null)
    })

    it('rejects a scope outside the scope pattern', () => {
      // Assert
      assertEquals(subjectPattern.exec('feat(apps/web): x'), null)
    })

    it('anchors the type to the start of the subject', () => {
      // Assert
      assertEquals(subjectPattern.exec('a feat: x'), null)
    })
  })

  describe('breakingPattern', () => {
    it('matches the marker after a type', () => {
      // Assert
      assert(breakingPattern.test('feat!: drop a thing'))
    })

    it('matches the marker after a scope', () => {
      // Assert
      assert(breakingPattern.test('feat(scope)!: drop a thing'))
    })

    it('does not match a bang and colon inside the description', () => {
      // Assert
      assertFalse(breakingPattern.test('feat: adds a bang!: inside'))
    })

    it('anchors the type to the start of the subject', () => {
      // Assert
      assertFalse(breakingPattern.test('a feat!: drop a thing'))
    })
  })

  describe('shared sources', () => {
    it('rejects a type in the subject that the type pattern rejects', () => {
      // Assert
      assertEquals(subjectPattern.exec('Feat: x'), null)
    })

    it('rejects a type in the breaking marker that the type pattern rejects', () => {
      // Assert
      assertFalse(breakingPattern.test('Feat!: x'))
    })
  })

  describe('capitalPattern', () => {
    it('matches a leading capital', () => {
      // Assert
      assert(capitalPattern.test('Add a thing'))
    })

    it('does not match a leading lowercase letter', () => {
      // Assert
      assertFalse(capitalPattern.test('add a thing'))
    })

    it('does not match a capital later in the description', () => {
      // Assert
      assertFalse(capitalPattern.test('add a Thing'))
    })
  })

  describe('punctuationPattern', () => {
    it('matches a trailing period', () => {
      // Assert
      assert(punctuationPattern.test('add a thing.'))
    })

    it('matches every punctuation mark it names', () => {
      // Assert
      for (const mark of ['.', '!', ',', ';', ':']) {
        assert(punctuationPattern.test(`add a thing${mark}`))
      }
    })

    it('does not match a description ending in a letter', () => {
      // Assert
      assertFalse(punctuationPattern.test('add a thing'))
    })

    it('does not match punctuation in the middle', () => {
      // Assert
      assertFalse(punctuationPattern.test('add a thing. and more'))
    })
  })
})
