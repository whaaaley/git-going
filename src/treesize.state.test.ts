import { describe, it } from 'node:test'
import { assertEquals } from '@std/assert'
import { empty, parse, serialize } from './treesize.state.ts'

describe('All Treesize State Tests', () => {
  describe('reading a stored state', () => {
    it('returns the stored tier when the session matches', () => {
      // Arrange
      const raw = '{"sessionId":"s1","announced":"notice"}'

      // Act
      const state = parse(raw, 's1')

      // Assert
      assertEquals(state, { sessionId: 's1', announced: 'notice' })
    })

    it('forgets a tier announced in an earlier session', () => {
      // Arrange
      const raw = '{"sessionId":"s1","announced":"urgent"}'

      // Act
      const state = parse(raw, 's2')

      // Assert
      assertEquals(state, empty)
    })

    it('round trips through serialize', () => {
      // Arrange
      const state = { sessionId: 's1', announced: 'warning' }

      // Act
      const restored = parse(serialize(state), 's1')

      // Assert
      assertEquals(restored, state)
    })
  })

  describe('unreadable states', () => {
    it('starts fresh on text that is not json', () => {
      // Act
      const state = parse('not json at all', 's1')

      // Assert
      assertEquals(state, empty)
    })

    it('starts fresh on an empty file', () => {
      // Act
      const state = parse('', 's1')

      // Assert
      assertEquals(state, empty)
    })

    it('starts fresh on json that is not an object', () => {
      // Act
      const fromArray = parse('[1,2,3]', 's1')
      const fromNull = parse('null', 's1')

      // Assert
      assertEquals(fromArray, empty)
      assertEquals(fromNull, empty)
    })

    it('starts fresh when a field has the wrong type', () => {
      // Act
      const badTier = parse('{"sessionId":"s1","announced":7}', 's1')
      const badSession = parse('{"sessionId":3,"announced":"notice"}', 's1')

      // Assert
      assertEquals(badTier, empty)
      assertEquals(badSession, empty)
    })

    it('starts fresh when a field is missing', () => {
      // Act
      const state = parse('{"sessionId":"s1"}', 's1')

      // Assert
      assertEquals(state, empty)
    })
  })
})
