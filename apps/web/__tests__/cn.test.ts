import { cn } from '@/lib/cn';

describe('cn', () => {
  it('joins truthy classes', () => {
    expect(cn('a', false && 'x', 'b', undefined, 'c')).toBe('a b c');
  });
});

