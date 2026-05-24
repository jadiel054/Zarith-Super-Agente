import "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "l-orbit": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        speed?: string | number;
        color?: string;
      };
      "l-ring": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        stroke?: string | number;
        speed?: string | number;
        color?: string;
        "bg-opacity"?: string | number;
      };
      "l-ring-2": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        stroke?: string | number;
        stroke-length?: string | number;
        speed?: string | number;
        color?: string;
      };
      "l-waveform": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        stroke?: string | number;
        speed?: string | number;
        color?: string;
      };
      "l-line-wobble": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        stroke?: string | number;
        speed?: string | number;
        color?: string;
        "bg-opacity"?: string | number;
      };
      "l-dot-pulse": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        speed?: string | number;
        color?: string;
      };
      "l-bouncy": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: string | number;
        speed?: string | number;
        color?: string;
      };
    }
  }
}
