import { useState } from 'react';
import Layout from './components/Layout';
// Import pages (placeholders for now)
import EmployeeManagement from './pages/EmployeeManagement';
import DeductionManagement from './pages/DeductionManagement';
import BonusManagement from './pages/BonusManagement';
import RecordsProcessing from './pages/RecordsProcessing';
import SalarySummary from './pages/SalarySummary';
import SalarySlipDownload from './pages/SalarySlipDownload';

// Placeholder components if files don't exist yet (to avoid build errors)
const PlaceholderEmployee = () => <div className="p-8 glass-card"><h2>Employee Management (Coming Soon)</h2></div>;
const PlaceholderRecords = () => <div className="p-8 glass-card"><h2>Records Processing (Coming Soon)</h2></div>;

function App() {
  const [activeTab, setActiveTab] = useState('employees');

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'employees' && (
        // We will replace this with actual component once created
        <EmployeeManagement />
      )}
      {activeTab === 'deductions' && (
        <DeductionManagement />
      )}
      {activeTab === 'bonuses' && (
        <BonusManagement />
      )}
      {activeTab === 'records' && (
        <RecordsProcessing />
      )}
      {activeTab === 'summary' && (
        <SalarySummary />
      )}
      {activeTab === 'download' && (
        <SalarySlipDownload />
      )}
    </Layout>
  );
}

export default App;
