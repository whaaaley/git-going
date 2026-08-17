import { describe, it } from 'node:test'
import { assertEquals } from '@std/assert'
import { pluralize } from './pluralize.utils.ts'

describe('All Pluralize Utils Tests', () => {
  describe('pluralize', () => {
    it('leaves a count of one singular', () => {
      assertEquals(pluralize('file', 1), '1 file')
    })

    it('pluralizes a count of zero', () => {
      assertEquals(pluralize('file', 0), '0 files')
    })

    it('pluralizes a count above one', () => {
      assertEquals(pluralize('changed line', 12), '12 changed lines')
    })

    // English treats absolute value one as singular, so -1 takes the one form while -2 does not.
    it('treats a negative one as singular and other negatives as plural', () => {
      assertEquals(pluralize('file', -1), '-1 file')
      assertEquals(pluralize('file', -2), '-2 files')
    })

    it('pluralizes a fractional count', () => {
      assertEquals(pluralize('file', 1.5), '1.5 files')
    })

    it('returns the bare word when the count is omitted from the output', () => {
      assertEquals(pluralize('file', 1, false), 'file')
      assertEquals(pluralize('file', 3, false), 'files')
    })

    // The plural category comes from CLDR but the suffix is a plain s, so irregular nouns come out wrong.
    it('appends a naive s to a noun that does not take one', () => {
      assertEquals(pluralize('box', 2), '2 boxs')
    })
  })
})
