import type { Metadata } from "next";
import { UiKit } from "./UiKit";

// Página oculta: no aparece en ningún menú y no se indexa.
export const metadata: Metadata = {
  title: "UI Kit · Base Selene",
  robots: { index: false, follow: false },
};

export default function UiKitPage() {
  return <UiKit />;
}
