// import { apiService } from './apiService';

export interface HOD {
  id: number;
  name: string;
  email: string;
  employee_id: string;
  phone: string;
  designation: string;
  specialization: string;
  experience_years: number;
  department: {
    id: number;
    name: string;
    code?: string;
  };
  image?: string;
  created_at: string;
  updated_at?: string;
}

export interface Department {
  department_id: number;
  name: string;
  code: string;
  description?: string;
}

class HODService {
  private baseURL = 'http://localhost:8000/api/register/admin';

  private getAuthHeaders(): HeadersInit {
    // Try multiple possible token storage locations
    let token = localStorage.getItem('token');
    
    if (!token) {
      const authData = localStorage.getItem('auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          token = parsed.access_token || parsed.token;
        } catch (e) {
          console.error('Error parsing auth data:', e);
        }
      }
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Token ${token}`;
    }
    
    console.log('Auth headers:', headers);
    return headers;
  }

  // Get all HOD records
  async getAllHODs(): Promise<{ success: boolean; data: HOD[]; count: number }> {
    try {
      console.log('Fetching HODs from:', `${this.baseURL}/hod-records/`);
      const response = await fetch(`${this.baseURL}/hod-records/`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('API Result:', result);
      return result;
    } catch (error) {
      console.error('Error fetching HODs:', error);
      throw error;
    }
  }

  // Get HOD by ID
  async getHODById(id: number): Promise<{ success: boolean; data: HOD }> {
    try {
      const response = await fetch(`${this.baseURL}/hod-records/${id}/`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching HOD:', error);
      throw error;
    }
  }

  // Update HOD
  async updateHOD(id: number, hodData: Partial<HOD>): Promise<{ success: boolean; message: string; data: HOD }> {
    try {
      const response = await fetch(`${this.baseURL}/hod/${id}/edit/`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(hodData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating HOD:', error);
      throw error;
    }
  }

  // Retire HOD
  async retireHOD(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseURL}/hod-records/${id}/`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action: 'retire' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error retiring HOD:', error);
      throw error;
    }
  }

  // Delete HOD
  async deleteHOD(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.baseURL}/hod-records/${id}/`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting HOD:', error);
      throw error;
    }
  }

  // Get departments for HOD management
  async getDepartments(): Promise<{ success: boolean; data: Department[] }> {
    try {
      const response = await fetch(`${this.baseURL}/hod-departments/`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
  }

  // Create new HOD
  async createHOD(hodData: Partial<HOD>): Promise<{ success: boolean; message: string; data?: HOD }> {
    try {
      const response = await fetch(`${this.baseURL}/hod-records/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(hodData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('Error creating HOD:', error);
      throw error;
    }
  }

  // Get HOD statistics
  async getHODStats(): Promise<{ 
    success: boolean; 
    stats: { 
      total_hods: number; 
      pending_requests: number;
      retired_hods?: number;
      department_wise: Array<{ department__name: string; count: number }> 
    } 
  }> {
    try {
      const response = await fetch(`${this.baseURL}/hod-stats/`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching HOD stats:', error);
      throw error;
    }
  }
}

export const hodService = new HODService();