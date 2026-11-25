import { describe, it, expect } from 'vitest';

import { evaluate } from '../../lib/util/ArithmeticEval.js';

describe('ArithmeticEval', () => {

  it('evaluates plain numbers', () => {
    expect(evaluate('42')).toBe(42);
    expect(evaluate('4.25')).toBe(4.25);
  });

  it('evaluates additions and subtractions', () => {
    expect(evaluate('12.5-15')).toBe(-2.5);
    expect(evaluate('1+2+3')).toBe(6);
  });

  it('evaluates multiplications, divisions and precedence', () => {
    expect(evaluate('2+3*4')).toBe(14);
    expect(evaluate('10/4')).toBe(2.5);
  });

  it('evaluates parentheses and unary minus', () => {
    expect(evaluate('(2+3)*4')).toBe(20);
    expect(evaluate('-5+10')).toBe(5);
    expect(evaluate('2*(-3)')).toBe(-6);
  });

  it('rejects invalid input', () => {
    expect(() => evaluate('foo')).toThrow();
    expect(() => evaluate('1+')).toThrow();
  });
});
