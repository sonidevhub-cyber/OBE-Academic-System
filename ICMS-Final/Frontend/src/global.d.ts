import React from 'react';

// Explicitly forces TS compiler to accept react-icons elements under React 19 environment
declare module 'react' {
  interface Attributes {
    className?: string;
  }
}

declare global {
  namespace JSX {
    type Element = React.JSX.Element;
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}