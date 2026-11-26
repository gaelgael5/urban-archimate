/**
 * Console logger for the library.
 *
 * Defaults to 'warn' so the editor stays quiet (the imported code base
 * logs verbosely at 'log' level). Set `globalThis.URBAN_ARCHIMATE_LOG_LEVEL`
 * to 'log' to get the full debug output.
 */
const LOG_LEVEL =
  (typeof globalThis !== 'undefined' && globalThis.URBAN_ARCHIMATE_LOG_LEVEL) || 'warn';

const NO_OP = () => {};

export class ConsoleLogger {

  constructor(options) {
    const { level } = options || {};

    this.error = console.error.bind(console);

    if (level === 'error') {
      this.warn = NO_OP;
      this.log = NO_OP;

      return;
    }

    this.warn = console.warn.bind(console);

    if (level === 'warn') {
      this.log = NO_OP;

      return;
    }

    this.log = console.log.bind(console);
  }
}

export const logger = new ConsoleLogger({ level: LOG_LEVEL });
