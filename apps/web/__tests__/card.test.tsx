import React from 'react';
import { renderToString } from 'react-dom/server';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

describe('Card', () => {
  it('renders card with title and content', () => {
    const html = renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    );
    expect(html).toContain('Title');
    expect(html).toContain('Body');
  });
});
