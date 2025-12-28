const STORAGE_KEY = 'salary_system_employees';
import { generateUUID } from '../utils/uuid';

export const getEmployees = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveEmployee = (employee) => {
  const employees = getEmployees();
  const existingIndex = employees.findIndex((e) => e.id === employee.id);
  
  if (existingIndex >= 0) {
    employees[existingIndex] = employee;
  } else {
    // Check for duplicate Emp ID
    if (employees.some(e => e.empId === employee.empId)) {
      throw new Error(`Employee ID ${employee.empId} already exists.`);
    }
    employees.push(employee);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
  return employees;
};

export const deleteEmployee = (id) => {
  const employees = getEmployees();
  const filtered = employees.filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return filtered;
};

export const importEmployees = (newEmployees) => {
  const current = getEmployees();
  let updated = [...current];
  let count = 0;

  newEmployees.forEach(newEmp => {
    const customId = newEmp.id || generateUUID(); 
    // If Emp ID exists, update it. Else add.
    const index = updated.findIndex(e => e.empId === newEmp.empId);
    if (index >= 0) {
      updated[index] = { ...updated[index], ...newEmp, id: updated[index].id }; // keep internal ID
    } else {
      updated.push({ ...newEmp, id: customId });
      count++;
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return { updated, count };
};

export const clearEmployees = () => {
    localStorage.removeItem(STORAGE_KEY);
    return [];
};
