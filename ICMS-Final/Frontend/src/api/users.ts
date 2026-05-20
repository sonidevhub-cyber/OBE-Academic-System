import { api } from './api';
import { User, UserCreateData, CreatedUserResponse } from '../types/user';

export const getUsers = async (role?: string) => {
    const response = await api.get<User[]>('/users/', {
        params: { role }
    });
    return response.data;
};

export const createUser = async (data: UserCreateData | FormData) => {
    const response = await api.post<CreatedUserResponse>('/users/', data);
    return response.data;
};

export const updateUser = async (id: string, data: Partial<UserCreateData> | FormData) => {
    const response = await api.patch<User>(`/users/${id}/`, data);
    return response.data;
};

export const deactivateUser = async (id: string) => {
    const response = await api.delete(`/users/${id}/deactivate/`);
    return response.data;
};
