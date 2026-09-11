import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
