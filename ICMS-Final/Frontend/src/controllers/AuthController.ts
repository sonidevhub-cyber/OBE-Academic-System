import authService from '../api/authService';

export class AuthController {
  static async login(credentials: { username: string; password: string }) {
    try {
      const response = await authService.login(credentials);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    }
  }

  static async register(userData: any) {
    try {
      const response = await authService.register(userData);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
    }
  }

  static logout() {
    authService.logout();
  }
}