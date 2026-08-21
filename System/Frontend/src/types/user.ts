export type PrimaryRole = 
    'SAC' | 'hod' | 'coordinator' | 
    'instructor' | 'tvf' | 
    'student' | 'alumni' 
 
export type SecondaryRole = 
    'none' | 'hod' | 'coordinator' 
 
export interface User { 
    id: string 
    custom_id?: string
    full_name: string 
    email: string 
    role: PrimaryRole 
    secondary_role: SecondaryRole 
    role_display: string 
    programs_list: string[] 
    batch_name: string | null 
    is_active: boolean 
    designation?: string
    phone?: string
    profile_pic?: string
    created_at: string 
} 
 
export interface UserCreateData { 
    full_name: string 
    email: string 
    role: PrimaryRole 
    secondary_role: SecondaryRole 
    programs: string[] 
    batch: string | null 
    password?: string
    designation?: string
    phone?: string
    profile_pic?: File | null
    is_active?: boolean
} 
 
export interface CreatedUserResponse { 
    user: User 
    generated_password: string 
}
