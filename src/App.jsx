import { useState, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext.jsx';
import { InstitutionProvider } from './context/InstitutionContext.jsx';
import AuthGate from './components/AuthGate.jsx';

const EmployeeManagement    = lazy(() => import('./pages/EmployeeManagement'));
const DeductionManagement   = lazy(() => import('./pages/DeductionManagement'));
const BonusManagement       = lazy(() => import('./pages/BonusManagement'));
const RecordsProcessing     = lazy(() => import('./pages/RecordsProcessing'));
const SalarySummary         = lazy(() => import('./pages/SalarySummary'));
const SalarySlipDownload    = lazy(() => import('./pages/SalarySlipDownload'));
const ACodeCalculation      = lazy(() => import('./pages/ACodeCalculation'));
const UserManagement        = lazy(() => import('./pages/UserManagement.jsx'));
const SummaryReconciliation = lazy(() => import('./pages/SummaryReconciliation'));
const RevenueReport         = lazy(() => import('./pages/RevenueReport'));
const ReceivableReport      = lazy(() => import('./pages/ReceivableReport'));

function App() {
  const [activeTab, setActiveTab] = useState('employees');

  return (
    <ThemeProvider>
      <AuthProvider>
        <InstitutionProvider>
          <AuthGate>
            <Layout activeTab={activeTab} onTabChange={setActiveTab}>
              <Suspense fallback={null}>
                {activeTab === 'employees' && <EmployeeManagement />}
                {activeTab === 'deductions' && <DeductionManagement />}
                {activeTab === 'bonuses' && <BonusManagement />}
                {activeTab === 'records' && <RecordsProcessing />}
                {activeTab === 'acode' && <ACodeCalculation />}
                {activeTab === 'reconcile' && <SummaryReconciliation />}
                {activeTab === 'revenue' && <RevenueReport />}
                {activeTab === 'receivable' && <ReceivableReport />}
                {activeTab === 'summary' && <SalarySummary />}
                {activeTab === 'download' && <SalarySlipDownload />}
                {activeTab === 'users' && <UserManagement />}
              </Suspense>
            </Layout>
          </AuthGate>
        </InstitutionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
