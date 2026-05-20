export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalDepartments: number;
  totalCourses: number;
  totalStudents: number;
  totalStaff: number;
}

export interface DepartmentCount {
  [departmentId: number]: number;
}

export interface PerformanceData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
  }[];
}
