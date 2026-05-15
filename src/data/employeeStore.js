import { apiGet, apiPost, apiPut, apiDelete } from '../lib/apiClient.js';

export const getEmployees = () => apiGet('/api/employees');

export const saveEmployee = (employee) =>
  apiPost('/api/employees', employee);

export const updateEmployee = (id, employee) =>
  apiPut(`/api/employees/${id}`, employee);

export const deleteEmployee = (id) =>
  apiDelete(`/api/employees/${id}`);

export const importEmployees = (newEmployees) =>
  apiPost('/api/employees/import', { employees: newEmployees });

export const clearEmployees = () =>
  apiDelete('/api/employees');
