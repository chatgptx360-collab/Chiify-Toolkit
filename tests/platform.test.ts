import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createLogger, type LogLevel } from '../lib/logging'
import { cloneableError, crashError } from '../lib/workers/protocol'
import { safeFileName, safeXmlId, relativeHref } from '../lib/epub/naming'
import { appError } from '../lib/utils/result'

/**
 * Platform tests — logging, the worker boundary, and the input-safety rules.
 *
 * These cover the parts of the system that have no user-visible surface of
 * their own and are therefore the easiest to break without noticing. A logger
 * that leaks in production, an error that cannot cross a worker boundary, or a
 * filename that escapes its directory all fail silently until the day they do
 * not.
 */

/** A logger that records instead of printing, so output can be asserted on. */
function recordingLogger(level: LogLevel) {
  const lines: string[] = []

  const logger = createLogger({
    level,
    sink: (logLevel, message) => lines.push(`${logLevel} ${message}`),
    now: (() => {
      let t = 0
      return () => (t += 25)
    })(),
  })

  return { logger, lines }
}

describe('logging', () => {
  it('emits everything at debug level', () => {
    const { logger, lines } = recordingLogger('debug')

    logger.debug('d')
    logger.info('i')
    logger.warn('w')
    logger.error('e')

    assert.equal(lines.length, 4)
  })

  it('keeps only warnings and errors at the production level', () => {
    const { logger, lines } = recordingLogger('warn')

    logger.debug('should not appear')
    logger.info('should not appear')
    logger.warn('kept')
    logger.error('kept')

    assert.deepEqual(
      lines.map((line) => line.split(' ')[0]),
      ['warn', 'error'],
    )
  })

  it('says nothing at all when silenced', () => {
    const { logger, lines } = recordingLogger('silent')

    logger.error('not even this')

    assert.deepEqual(lines, [])
  })

  it('namespaces child loggers cumulatively', () => {
    const { logger, lines } = recordingLogger('debug')

    logger.child('parser').child('docx').info('hello')

    assert.match(lines[0] ?? '', /\[chiify:parser:docx\] hello/)
  })

  it('times an operation and returns the elapsed milliseconds', () => {
    const { logger, lines } = recordingLogger('debug')

    const done = logger.time('parse')
    const elapsed = done()

    assert.equal(elapsed, 25)
    assert.match(lines[0] ?? '', /parse took 25ms/)
  })

  it('reports a timing once, however often it is stopped', () => {
    const { logger, lines } = recordingLogger('debug')

    const done = logger.time('generate')
    const first = done()
    const second = done()

    // A job that finishes and is then cancelled must not re-measure.
    assert.equal(first, second)
    assert.equal(lines.filter((line) => line.includes('generate took')).length, 1)
  })
})

describe('the worker boundary', () => {
  it('strips a cause that could not be cloned', () => {
    const withCause = appError('parse.failed', 'It did not work.', {
      hint: 'Try again.',
      source: 'book.docx',
      // A function is the canonical uncloneable value.
      cause: () => undefined,
    })

    const cleaned = cloneableError(withCause)

    assert.equal('cause' in cleaned, false)
    assert.equal(cleaned.message, 'It did not work.')
    assert.equal(cleaned.hint, 'Try again.')
    assert.equal(cleaned.source, 'book.docx')
  })

  it('survives a structured clone once cleaned', () => {
    const cleaned = cloneableError(
      appError('parse.failed', 'It did not work.', { cause: new Map([['fn', () => 1]]) }),
    )

    // Throws if anything uncloneable survived.
    assert.doesNotThrow(() => structuredClone(cleaned))
  })

  it('omits optional fields rather than setting them undefined', () => {
    const cleaned = cloneableError(appError('x.y', 'message'))

    assert.deepEqual(Object.keys(cleaned).sort(), ['code', 'message', 'severity'])
  })

  it('recognises running out of memory and says something useful about it', () => {
    const error = crashError(new Error('Array buffer allocation failed'), 'parse')

    assert.match(error.code, /out-of-memory/)
    assert.match(error.hint ?? '', /splitting the manuscript/)
  })

  it('never exposes an internal message to the author', () => {
    const error = crashError(
      new Error('TypeError: undefined is not a function at line 42'),
      'generate',
    )

    assert.ok(!error.message.includes('undefined is not a function'))
    assert.ok(!error.message.includes('line 42'))
    assert.match(error.message, /building your book/)
  })

  it('describes the operation that failed', () => {
    assert.match(crashError(new Error('x'), 'parse').message, /reading your manuscript/)
    assert.match(crashError(new Error('x'), 'generate').message, /building your book/)
  })
})

describe('input safety', () => {
  it('strips directory traversal from a filename', () => {
    for (const hostile of ['../../etc/passwd', '..\\..\\windows\\system32', '/absolute/path']) {
      const safe = safeFileName(hostile, '.xhtml')

      assert.ok(!safe.includes('..'), `traversal survived: ${safe}`)
      assert.ok(!safe.includes('/'), `separator survived: ${safe}`)
      assert.ok(!safe.includes('\\'), `separator survived: ${safe}`)
    }
  })

  it('produces ASCII names from any script', () => {
    for (const name of ['Глава первая', '第一章', 'Chapitre — Un', '🙂 emoji']) {
      const safe = safeFileName(name, '.xhtml')

      assert.ok(/^[ -~]+$/.test(safe), `non-ASCII survived: ${safe}`)
      assert.ok(!safe.includes(' '), `space survived: ${safe}`)
    }
  })

  it('never produces an empty or extension-only name', () => {
    for (const name of ['', '   ', '...', '///']) {
      const safe = safeFileName(name, '.xhtml')

      assert.ok(safe.length > '.xhtml'.length, `empty stem: ${safe}`)
      assert.ok(safe.endsWith('.xhtml'))
    }
  })

  it('avoids names Windows cannot create', () => {
    for (const reserved of ['con', 'CON', 'aux', 'nul', 'com1', 'lpt1']) {
      const safe = safeFileName(reserved, '.xhtml')

      assert.notEqual(safe.toLowerCase(), `${reserved.toLowerCase()}.xhtml`)
    }
  })

  it('produces XML ids that are valid wherever they start', () => {
    for (const raw of ['1chapter', '-leading', '', '💥', 'has spaces']) {
      const id = safeXmlId(raw, 'id')

      assert.match(id, /^[A-Za-z_][\w.-]*$/, `invalid id: ${id}`)
    }
  })

  it('resolves hrefs relative to the referencing document', () => {
    assert.equal(relativeHref('text/chapter-01.xhtml', 'images/plate.png'), '../images/plate.png')
    assert.equal(relativeHref('text/chapter-01.xhtml', 'text/chapter-02.xhtml'), 'chapter-02.xhtml')
    assert.equal(relativeHref('nav.xhtml', 'text/chapter-01.xhtml'), 'text/chapter-01.xhtml')
  })
})
