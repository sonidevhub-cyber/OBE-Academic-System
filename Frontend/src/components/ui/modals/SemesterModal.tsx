import React, { useState, useEffect } from 'react';

interface SemesterFormData {
  name: string;
  semester_code: string;
  program: string;
  capacity: number;
  department: number;
}

interface Semester {
  semester_id: number;
  name: string;
  semester_code: string;
  department: number;
  program: string;
  capacity: number;
}

interface SemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: SemesterFormData) => void;
  editingSemester: Semester | null;
  semesterFormData: SemesterFormData;
  setSemesterFormData: React.Dispatch<React.SetStateAction<SemesterFormData>>;
}

const SemesterModal: React.FC<SemesterModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingSemester,
  semesterFormData,
  setSemesterFormData
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSemester) {
      setSemesterFormData({
        name: editingSemester.name,
        semester_code: editingSemester.semester_code,
        program: editingSemester.program,
        capacity: editingSemester.capacity,
        department: editingSemester.department
      });
    }
  }, [editingSemester, setSemesterFormData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSemesterFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!semesterFormData.name.trim()) {
        setError('Semester name is required.');
        setIsLoading(false);
        return;
      }

      if (!semesterFormData.semester_code.trim()) {
        setError('Semester code is required.');
        setIsLoading(false);
        return;
      }

      if (!semesterFormData.program.trim()) {
        setError('Program is required.');
        setIsLoading(false);
        return;
      }

      if (semesterFormData.capacity <= 0) {
        setError('Capacity must be greater than 0.');
        setIsLoading(false);
        return;
      }

      await onSubmit(semesterFormData);
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to save semester');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {editingSemester ? 'Edit Semester' : 'Add New Semester'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  Semester Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={semesterFormData.name}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., Fall 2024"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="semester_code">
                  Semester Code *
                </label>
                <input
                  id="semester_code"
                  name="semester_code"
                  type="text"
                  required
                  value={semesterFormData.semester_code}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., FALL2024"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="program">
                  Program *
                </label>
                <input
                  id="program"
                  name="program"
                  type="text"
                  required
                  value={semesterFormData.program}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="capacity">
                  Capacity *
                </label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  required
                  min="1"
                  value={semesterFormData.capacity}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., 50"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors flex items-center"
              >
                {isLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {editingSemester ? 'Update Semester' : 'Add Semester'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SemesterModal;
