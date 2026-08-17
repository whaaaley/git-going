import { describe, it } from 'node:test'
import { assertEquals } from '@std/assert'
import { defaults } from './config.ts'
import { validate } from './commit.validator.ts'

const config = defaults.commit

const rulesOf = (message: string): string[] => {
  return validate(message, config).map((failure) => failure.rule)
}

describe('All Commit Subject Tests', () => {
  describe('accepted subjects', () => {
    it('accepts a type and description', () => {
      // Assert
      assertEquals(validate('feat: add the treesize hook', config), [])
    })

    it('accepts a scope between the type and the description', () => {
      // Assert
      assertEquals(validate('fix(tools): count deletions toward the threshold', config), [])
    })

    it('accepts a bang and colon inside the description', () => {
      // Assert
      assertEquals(validate('feat: adds a bang!: inside', config), [])
    })

    it('checks only the first line of a multi-line message', () => {
      // Assert
      assertEquals(validate('docs: rewrite the readme\n\nA body that ends with a period.', config), [])
    })

    it('leaves a merge subject alone', () => {
      // Assert
      assertEquals(validate('Merge branch main into topic', config), [])
    })

    it('leaves a revert subject alone', () => {
      // Assert
      assertEquals(validate('Revert "feat: add the treesize hook"', config), [])
    })
  })

  describe('rejected subjects', () => {
    it('rejects a subject with no type at all', () => {
      // Assert
      assertEquals(rulesOf('rewrote the readme'), ['format'])
    })

    it('rejects a type outside the configured list', () => {
      // Assert
      assertEquals(rulesOf('wip: something half done'), ['type'])
    })

    it('rejects a description that starts with a capital', () => {
      // Assert
      assertEquals(rulesOf('feat: Add the treesize hook'), ['case'])
    })

    it('rejects a description that ends with punctuation', () => {
      // Assert
      assertEquals(rulesOf('feat: add the treesize hook.'), ['punctuation'])
    })

    it('rejects a subject past the length limit', () => {
      // Arrange
      const long = `feat: ${'a'.repeat(config.maxLength)}`

      // Assert
      assertEquals(rulesOf(long), ['length'])
    })

    it('names the breaking rule for the indicator after a type', () => {
      // Assert
      assertEquals(rulesOf('feat!: drop the copied hook scripts'), ['breaking'])
    })

    it('names the breaking rule for the indicator after a scope', () => {
      // Assert
      assertEquals(rulesOf('feat(tools)!: drop the copied hook scripts'), ['breaking'])
    })
  })

  describe('project vocabulary', () => {
    it('accepts any scope when a project lists none', () => {
      // Assert
      assertEquals(validate('feat(anything): add a thing', config), [])
    })

    it('rejects a scope outside a list a project did name', () => {
      // Arrange
      const scoped = { ...config, scopes: ['tools'] }

      // Act
      const rules = validate('feat(client): add a thing', scoped).map((failure) => failure.rule)

      // Assert
      assertEquals(rules, ['scope'])
    })

    it('accepts a type a project added', () => {
      // Arrange
      const extended = { ...config, types: ['wip'] }

      // Assert
      assertEquals(validate('wip: something half done', extended), [])
    })

    it('rejects a subject past a length limit a project lowered', () => {
      // Arrange
      const short = { ...config, maxLength: 20 }

      // Act
      const rules = validate('feat: add the treesize hook', short).map((failure) => failure.rule)

      // Assert
      assertEquals(rules, ['length'])
    })
  })
})
