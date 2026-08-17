import { describe, it } from 'node:test'
import { assert, assertEquals, assertInstanceOf } from '@std/assert'
import { safe, safeAsync } from './safe.utils.ts'

describe('All Safe Utils Tests', () => {
  describe('running a sync callback', () => {
    it('returns the value with a null error when the callback succeeds', () => {
      // Arrange
      const fn = (): number => 7

      // Act
      const { data, error } = safe(fn)

      // Assert
      assertEquals(data, 7)
      assertEquals(error, null)
    })

    it('returns the thrown error with null data when the callback throws', () => {
      // Arrange
      const thrown = new Error('sync failed')

      // Act
      const { data, error } = safe(() => {
        throw thrown
      })

      // Assert
      assertEquals(data, null)
      assertEquals(error, thrown)
    })
  })

  describe('running an async callback', () => {
    it('returns the resolved value with a null error', async () => {
      // Arrange
      const fn = (): Promise<string> => Promise.resolve('ok')

      // Act
      const { data, error } = await safeAsync(fn)

      // Assert
      assertEquals(data, 'ok')
      assertEquals(error, null)
    })

    it('returns the rejection reason with null data', async () => {
      // Arrange
      const thrown = new Error('async failed')

      // Act
      const { data, error } = await safeAsync(() => Promise.reject(thrown))

      // Assert
      assertEquals(data, null)
      assertEquals(error, thrown)
    })
  })

  describe('wrapping a thrown value that is not an Error', () => {
    it('wraps a thrown string in an Error carrying its text', () => {
      // Arrange
      const fn = (): never => {
        throw 'plain string'
      }

      // Act
      const { error } = safe(fn)

      // Assert
      assertInstanceOf(error, Error)
      assertEquals(error.message, 'plain string')
    })

    it('wraps a rejection that is not an Error', async () => {
      // Arrange
      const fn = (): Promise<never> => Promise.reject(404)

      // Act
      const { error } = await safeAsync(fn)

      // Assert
      assertInstanceOf(error, Error)
      assertEquals(error.message, '404')
    })
  })

  describe('narrowing the result', () => {
    it('narrows data to the value type once error is checked', () => {
      // Arrange
      const fn = (): string[] => ['a', 'b']

      // Act
      const { data, error } = safe(fn)

      // Assert
      if (error) throw error

      assertEquals(data.length, 2)
      assert(data.includes('a'))
    })

    it('narrows error to an Error once data is known to be null', () => {
      // Arrange
      const fn = (): number => {
        throw new Error('nope')
      }

      // Act
      const { data, error } = safe(fn)

      // Assert
      assertEquals(data, null)
      assertInstanceOf(error, Error)
      assertEquals(error.message, 'nope')
    })
  })
})
