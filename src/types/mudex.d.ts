import "react";

// Mudex File-Display Web-Component (https://www.mudex.org/webcomponents).
// Custom Element als JSX-Intrinsic bekanntmachen.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mudex-file-display": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        url?: string;
        "content-type"?: string;
        "file-name"?: string;
        "show-file-name"?: string;
      };
    }
  }
}
