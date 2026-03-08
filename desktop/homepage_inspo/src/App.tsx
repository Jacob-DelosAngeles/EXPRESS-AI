import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import QuickActions from './components/QuickActions';
import JobsTable from './components/JobsTable';
import StatusFooter from './components/StatusFooter';

export default function App() {
  return (
    <div className="h-screen flex overflow-hidden bg-[#0F1117]">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-8 pb-20">
        <div className="max-w-7xl mx-auto">
          <Header />
          <HeroSection />
          <QuickActions />
          <JobsTable />
        </div>
      </main>

      <StatusFooter />
    </div>
  );
}
