import type { JSX } from "preact";

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "ar-shell": JSX.HTMLAttributes<HTMLElement>;
    }
  }
}
