import React, { useState, useEffect } from 'react';
import { getUsers, createUser, deactivateUser, updateUser } from '../../api/users';
import { User, PrimaryRole, SecondaryRole, UserCreateData } from '../../types/user';
import { api } from '../../api/api';
import { getFullImageUrl } from '../../utils/imageHelpers';

const Users: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    // Form state
    const [formData, setFormData] = useState<UserCreateData>({
        full_name: '',
        email: '',
        password: '',
        role: 'instructor',
        secondary_role: 'none',
        designation: 'Assistant Professor',
        phone: '',
        programs: [],
        batch: null,
        profile_pic: null
    });
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [programs, setPrograms] = useState<any[]>([]);

    const tabs = ['All', 'hod', 'coordinator', 'instructor', 'tvf'];
    const designations = ['Assistant Professor', 'Professor', 'Associate Professor', 'Lecturer'];

    useEffect(() => {
        fetchUsers();
        fetchInitialData();
    }, [activeTab]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let data: User[] = [];
            if (activeTab === 'All') {
                const allUsers = await getUsers();
                data = allUsers.filter(user => 
                    ['hod', 'coordinator', 'instructor', 'tvf'].includes(user.role.toLowerCase())
                );
            } else {
                data = await getUsers(activeTab);
            }
            setUsers(data);
        } catch (error) {
            showToast('Failed to fetch faculty members', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const programsRes = await api.get('/programs/');
            setPrograms(programsRes.data);
        } catch (error) {
            console.error('Failed to fetch initial data', error);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleToggleStatus = async (user: User) => {
        const action = user.is_active ? 'deactivate' : 'activate';
        if (window.confirm(`Are you sure you want to ${action} this faculty member?`)) {
            try {
                if (user.is_active) {
                    await deactivateUser(user.id);
                } else {
                    await updateUser(user.id, { is_active: true });
                }
                showToast(`Faculty member ${action}d successfully`, 'success');
                fetchUsers();
            } catch (error: any) {
                showToast(error.response?.data?.error || `Failed to ${action} faculty member`, 'error');
            }
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData({ ...formData, profile_pic: file });
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleEdit = (user: User) => {
        setEditingUserId(user.id);
        setFormData({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            secondary_role: user.secondary_role,
            designation: user.designation || 'Assistant Professor',
            phone: user.phone || '',
            password: '',
            programs: [], // Would need mapping if available
            batch: null,
            profile_pic: null
        });
        setImagePreview(user.profile_pic ? (getFullImageUrl(user.profile_pic) || null) : null);
        setShowEditModal(true);
    };

    const resetForm = () => {
        setFormData({
            full_name: '',
            email: '',
            password: '',
            role: 'instructor',
            secondary_role: 'none',
            designation: 'Assistant Professor',
            phone: '',
            programs: [],
            batch: null,
            profile_pic: null
        });
        setImagePreview(null);
        setEditingUserId(null);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.full_name || !formData.email || (!editingUserId && !formData.password)) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        const data = new FormData();
        data.append('full_name', formData.full_name);
        data.append('email', formData.email);
        if (formData.password) data.append('password', formData.password);
        data.append('role', formData.role);
        data.append('secondary_role', formData.role === 'tvf' ? 'none' : formData.secondary_role);
        data.append('designation', formData.role === 'tvf' ? 'Visiting Faculty' : (formData.designation || ''));
        data.append('phone', formData.phone || '');
        
        formData.programs.forEach(pId => data.append('programs', pId));
        if (formData.profile_pic) data.append('profile_pic', formData.profile_pic);

        try {
            if (editingUserId) {
                await updateUser(editingUserId, data);
                showToast('Faculty member updated successfully', 'success');
                setShowEditModal(false);
            } else {
                await createUser(data);
                showToast('Faculty member created successfully', 'success');
                setShowAddModal(false);
            }
            resetForm();
            fetchUsers();
        } catch (error: any) {
            showToast(error.response?.data?.error || error.response?.data?.email?.[0] || 'Failed to save faculty member', 'error');
        }
    };

    const renderRoleBadge = (user: User) => {
        const baseStyle = "px-2 py-1 rounded-full text-xs font-medium";
        if (user.role === 'tvf') return <span className={`${baseStyle} bg-gray-100 text-gray-800`}>TVF</span>;
        
        const roleColors: Record<string, string> = {
            SAC: "bg-purple-100 text-purple-800",
            hod: "bg-red-100 text-red-800",
            coordinator: "bg-blue-100 text-blue-800",
            instructor: "bg-green-100 text-green-800"
        };

        return (
            <div className="flex gap-1">
                <span className={`${baseStyle} ${roleColors[user.role] || 'bg-gray-100 text-gray-800'}`}>
                    {user.role.toUpperCase()}
                </span>
                {user.secondary_role !== 'none' && (
                    <span className={`${baseStyle} ${roleColors[user.secondary_role] || 'bg-gray-100 text-gray-800'}`}>
                        + {user.secondary_role.toUpperCase()}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Faculty Management</h1>
                    <p className="text-gray-600">Manage instructors, HODs, coordinators, and visiting faculty</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Faculty Member
                </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 mb-6 bg-white p-1 rounded-lg shadow-sm">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            activeTab === tab 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Faculty</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Designation</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Programs</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-4 text-center">No faculty members found</td></tr>
                        ) : users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 flex-shrink-0">
                                            {user.profile_pic ? (
                                                <img className="h-10 w-10 rounded-full object-cover" src={getFullImageUrl(user.profile_pic)} alt="" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                                                    {user.full_name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                            <div className="text-xs text-gray-500">{user.custom_id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-900">{user.email}</div>
                                    <div className="text-xs text-gray-500">{user.phone || '-'}</div>
                                </td>
                                <td className="px-6 py-4">{renderRoleBadge(user)}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{user.designation || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {user.programs_list.length > 0 ? user.programs_list.join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium space-x-2">
                                    <button 
                                        onClick={() => handleEdit(user)}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        Edit
                                    </button>
                                    {user.role !== 'SAC' && (
                                        <button 
                                            onClick={() => handleToggleStatus(user)}
                                            className={`${user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                                        >
                                            {user.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Faculty Modal (Add/Edit) */}
            {(showAddModal || showEditModal) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                            <h3 className="text-lg font-bold">{showEditModal ? 'Edit Faculty Member' : 'Add New Faculty Member'}</h3>
                            <button onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Profile Pic */}
                                <div className="md:col-span-2 flex flex-col items-center pb-4 border-b">
                                    <div className="h-24 w-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden mb-2 relative group">
                                        {imagePreview ? (
                                            <img src={imagePreview} className="h-full w-full object-cover" alt="Preview" />
                                        ) : (
                                            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        )}
                                        <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <span className="text-white text-xs font-medium">Change</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500">Profile Picture (Optional)</p>
                                </div>

                                {/* Personal Info */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-blue-600 text-sm uppercase tracking-wider">Personal Details</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                        <input 
                                            type="text" 
                                            required
                                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={formData.full_name}
                                            onChange={e => setFormData({...formData, full_name: e.target.value})}
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                                        <input 
                                            type="email" 
                                            required
                                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input 
                                            type="text" 
                                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={formData.phone}
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            placeholder="+92 3xx xxxxxxx"
                                        />
                                    </div>
                                    {!showEditModal ? (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                            <input 
                                                type="password" 
                                                required
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                                                value={formData.password}
                                                onChange={e => setFormData({...formData, password: e.target.value})}
                                                placeholder="Create a password"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Update Password</label>
                                            <input 
                                                type="password" 
                                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                                                value={formData.password}
                                                onChange={e => setFormData({...formData, password: e.target.value})}
                                                placeholder="Leave blank to keep current"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1 italic">Only enter if you want to change the password</p>
                                        </div>
                                    )}
                                </div>

                                {/* Role & Designation */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-blue-600 text-sm uppercase tracking-wider">Professional Info</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Role *</label>
                                        <select 
                                            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.role}
                                            onChange={e => setFormData({...formData, role: e.target.value as PrimaryRole})}
                                        >
                                            <option value="instructor">Instructor</option>
                                            <option value="hod">HOD</option>
                                            <option value="coordinator">Coordinator</option>
                                            <option value="tvf">Visiting Faculty (TVF)</option>
                                        </select>
                                    </div>

                                    {formData.role !== 'tvf' ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                                                <select 
                                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={formData.designation}
                                                    onChange={e => setFormData({...formData, designation: e.target.value})}
                                                >
                                                    {designations.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Roles</label>
                                                <div className="flex gap-4 mt-2">
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="sec_role"
                                                            checked={formData.secondary_role === 'none'} 
                                                            onChange={() => setFormData({...formData, secondary_role: 'none'})}
                                                        />
                                                        <span className="text-sm">None</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="sec_role"
                                                            checked={formData.secondary_role === 'hod'} 
                                                            onChange={() => setFormData({...formData, secondary_role: 'hod'})}
                                                        />
                                                        <span className="text-sm">HOD</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <input 
                                                            type="radio" 
                                                            name="sec_role"
                                                            checked={formData.secondary_role === 'coordinator'} 
                                                            onChange={() => setFormData({...formData, secondary_role: 'coordinator'})}
                                                        />
                                                        <span className="text-sm">Coordinator</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <p className="text-xs text-gray-600 italic">TVF role has limited access. No additional designations or roles required.</p>
                                        </div>
                                    )}

                                    {(formData.role === 'hod' || formData.role === 'coordinator' || formData.secondary_role === 'hod' || formData.secondary_role === 'coordinator') && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Programs Assignment</label>
                                            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1 bg-white">
                                                {programs.map(p => (
                                                    <label key={p.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={formData.programs.includes(p.id)}
                                                            onChange={e => {
                                                                const newPrograms = e.target.checked 
                                                                    ? [...formData.programs, p.id]
                                                                    : formData.programs.filter(id => id !== p.id);
                                                                setFormData({...formData, programs: newPrograms});
                                                            }}
                                                            className="h-4 w-4 rounded text-blue-600"
                                                        />
                                                        <span className="text-xs text-gray-700">{p.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t flex justify-end space-x-3 sticky bottom-0 bg-white">
                                <button 
                                    type="button"
                                    onClick={() => { setShowAddModal(false); setShowEditModal(false); resetForm(); }}
                                    className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                                >
                                    {showEditModal ? 'Update Faculty' : 'Create Faculty'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl z-[100] transition-all transform translate-y-0 ${
                    toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                }`}>
                    <div className="flex items-center space-x-2">
                        <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                        <span className="font-medium">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;

