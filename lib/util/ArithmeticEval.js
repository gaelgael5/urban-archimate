/**
 * Minimal arithmetic expression evaluator used by PathMap to resolve
 * path templates such as `{{e.x0}-15}` once coordinates are substituted
 * (e.g. "12.5-15"). Supports numbers, + - * /, parentheses and unary +/-.
 *
 * Replaces the former dependency on mathjs (only `evaluate` was used).
 */
export function evaluate(expression) {
  var input = String(expression);
  var pos = 0;

  function skipSpaces() {
    while (pos < input.length && input[pos] === ' ') {
      pos++;
    }
  }

  function parseNumber() {
    skipSpaces();
    var start = pos;
    while (pos < input.length && /[0-9.]/.test(input[pos])) {
      pos++;
    }
    if (start === pos) {
      throw new Error('invalid arithmetic expression: ' + input);
    }
    return parseFloat(input.slice(start, pos));
  }

  function parseFactor() {
    skipSpaces();
    var char = input[pos];
    if (char === '+') {
      pos++;
      return parseFactor();
    }
    if (char === '-') {
      pos++;
      return -parseFactor();
    }
    if (char === '(') {
      pos++;
      var value = parseExpression();
      skipSpaces();
      if (input[pos] !== ')') {
        throw new Error('invalid arithmetic expression: ' + input);
      }
      pos++;
      return value;
    }
    return parseNumber();
  }

  function parseTerm() {
    var value = parseFactor();
    for (;;) {
      skipSpaces();
      var char = input[pos];
      if (char === '*') {
        pos++;
        value *= parseFactor();
      } else if (char === '/') {
        pos++;
        value /= parseFactor();
      } else {
        return value;
      }
    }
  }

  function parseExpression() {
    var value = parseTerm();
    for (;;) {
      skipSpaces();
      var char = input[pos];
      if (char === '+') {
        pos++;
        value += parseTerm();
      } else if (char === '-') {
        pos++;
        value -= parseTerm();
      } else {
        return value;
      }
    }
  }

  var result = parseExpression();
  skipSpaces();
  if (pos !== input.length) {
    throw new Error('invalid arithmetic expression: ' + input);
  }
  return result;
}
