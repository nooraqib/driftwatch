import Header from "@/components/marketing/Header";
import Footer from "@/components/marketing/Footer";

export default function MarketingLayout({ children }) {
  return (
    <div className="marketing flex min-h-full flex-1 flex-col bg-mkt-bg text-mkt-text">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
