'use client';

import { PlasmicRootProvider } from '@plasmicapp/loader-nextjs';
import { PLASMIC } from './plasmic-init';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

PLASMIC.registerComponent(Button, {
  name: 'Button',
  props: {
    variant: { type: 'choice', options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] },
    size: { type: 'choice', options: ['default', 'sm', 'lg', 'icon'] },
    children: 'slot',
    onClick: { type: 'eventHandler', argTypes: [{ name: 'event', type: 'object' }] },
    disabled: 'boolean'
  }
});

PLASMIC.registerComponent(Card, {
  name: 'Card',
  props: { children: 'slot', className: 'string' }
});

export function ClientPlasmicRootProvider(props: Omit<React.ComponentProps<typeof PlasmicRootProvider>, 'loader'>) {
  return <PlasmicRootProvider loader={PLASMIC} {...props} />;
}
