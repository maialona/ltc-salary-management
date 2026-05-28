import { useState } from 'react';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext.jsx';
import { InstitutionProvider } from './context/InstitutionContext.jsx';
import AuthGate from './components/AuthGate.jsx';
import EmployeeManagement from './pages/EmployeeManagement';
import DeductionManagement from './pages/DeductionManagement';
import BonusManagement from './pages/BonusManagement';
import RecordsProcessing from './pages/RecordsProcessing';
import SalarySummary from './pages/SalarySummary';
import SalarySlipDownload from './pages/SalarySlipDownload';
import ACodeCalculation from './pages/ACodeCalculation';
import UserManagement from './pages/UserManagement.jsx';
import SummaryReconciliation from './pages/SummaryReconciliation';
import RevenueReport from './pages/RevenueReport';

function App() {
  const [activeTab, setActiveTab] = useState('employees');

  return (
    <ThemeProvider>
      <AuthProvider>
        <InstitutionProvider>
          <AuthGate>
            <Layout activeTab={activeTab} onTabChange={setActiveTab}>
              {activeTab === 'employees' && <EmployeeManagement />}
              {activeTab === 'deductions' && <DeductionManagement />}
              {activeTab === 'bonuses' && <BonusManagement />}
              {activeTab === 'records' && <RecordsProcessing />}
              {activeTab === 'acode' && <ACodeCalculation />}
              {activeTab === 'reconcile' && <SummaryReconciliation />}
              {activeTab === 'revenue' && <RevenueReport />}
              {activeTab === 'summary' && <SalarySummary />}
              {activeTab === 'download' && <SalarySlipDownload />}
              {activeTab === 'users' && <UserManagement />}
            </Layout>
          </AuthGate>
        </InstitutionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
