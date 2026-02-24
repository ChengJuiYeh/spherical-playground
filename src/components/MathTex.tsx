"use client";

import "katex/dist/katex.min.css";
import TeX from "@matejmazur/react-katex";

export default function MathTex({
  tex,
  block = false,
}: {
  tex: string;
  block?: boolean;
}) {
  return <TeX math={tex} block={block} />;
}
