import React from 'react';
import { Button } from '@/components/ui/button';
import { renderToString } from 'react-dom/server';

describe('Button', () => {
  it('renders as anchor when href is provided', () => {
    const html = renderToString(<Button href="/go">Click</Button>);
    expect(html).toContain('<a');
    expect(html).toContain('btn');
    expect(html).toContain('btn-primary');
  });

  it('supports ghost variant', () => {
    const html = renderToString(<Button variant="ghost">Ghost</Button>);
    expect(html).toContain('<button');
    expect(html).toContain('btn-ghost');
  });
});
