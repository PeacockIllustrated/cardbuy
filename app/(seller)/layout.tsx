import { SellerNav } from "@/components/cardbuy/SellerNav";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SellerNav />
      {children}
    </>
  );
}
