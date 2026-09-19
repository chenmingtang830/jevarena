import { ReviewedCommunity } from "@/components/reviewed-community";

export const metadata = {
  title: "Community questions",
  description: "Explore AI-screened community questions. Copy a prompt or choose your own models to test it.",
};
export default function Community() {
  return <main id="main" className="prose-page"><ReviewedCommunity /></main>;
}
