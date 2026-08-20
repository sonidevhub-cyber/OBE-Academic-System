import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { curriculumService, CurriculumVersion, CurriculumCourse } from '../../api/curriculumService';
import { toast } from 'react-toastify';
import { Loader2, PlusCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MasterCurriculumDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const [curriculum, setCurriculum] = useState<CurriculumVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddCourseModal, setShowAddCourseModal] = useState(false);
    
    const [newCourseData, setNewCourseData] = useState({
        name: '',
        code: '',
        credit_hours: 3,
        course_type: 'LECTURE',
        parent_course_id: '',
    });
    const [selectedSemester, setSelectedSemester] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const fetchCurriculumDetails = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const response = await curriculumService.getVersion(id);
            setCurriculum(response.data);
        } catch (error) {
            toast.error("Failed to load curriculum details.");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchCurriculumDetails();
    }, [fetchCurriculumDetails]);

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        if (!newCourseData.name || !newCourseData.code || !newCourseData.credit_hours) {
            toast.error('Please fill all fields for the new course.');
            return;
        }

        setSubmitting(true);
        try {
            const createCourseResponse = await curriculumService.createCourse({
                name: newCourseData.name,
                code: newCourseData.code,
                credit_hours: newCourseData.credit_hours,
                course_type: newCourseData.course_type,
                program_id: curriculum?.program || 0,
                semester_no: selectedSemester,
                parent_course: newCourseData.parent_course_id || undefined,
            });
            const createdCourse = createCourseResponse.data?.data || createCourseResponse.data;
            const courseIdToAdd = createdCourse.id;
            
            await curriculumService.addCourseToVersion(
    id,
    courseIdToAdd,
    selectedSemester
);
            toast.success("Course added successfully!");
            setShowAddCourseModal(false);
            fetchCurriculumDetails(); // Refresh the curriculum details
        } catch (error) {
            toast.error("Failed to add course.");
        } finally {
            setSubmitting(false);
            setNewCourseData({ name: '', code: '', credit_hours: 3, course_type: 'LECTURE', parent_course_id: '' });
            setSelectedSemester(1);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-10 h-10 text-gray-300 animate-spin" />
            </div>
        );
    }

    if (!curriculum) {
        return (
            <div className="text-center p-12">
                <h2 className="text-xl font-semibold">Curriculum Not Found</h2>
                <p className="text-gray-500 mt-2">The requested curriculum could not be found.</p>
                <Link to="/curriculum/master" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Master Curricula
                </Link>
            </div>
        );
    }

    const coursesBySemester = curriculum.courses_by_semester || {};

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <div className="flex justify-between items-end border-b pb-4 border-gray-100">
                <div>
                    <Link to="/curriculum/master" className="text-sm text-indigo-600 hover:underline flex items-center gap-1 mb-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to list
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        {curriculum.program_name} - {curriculum.version_no}
                    </h1>
                    <p className="text-gray-500 mt-1">Manage courses for this master curriculum.</p>
                </div>
                <button
                    onClick={() => {
                        setNewCourseData({ name: '', code: '', credit_hours: 3, course_type: 'LECTURE', parent_course_id: '' });
                        setShowAddCourseModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Course</span>
                </button>
            </div>

            {Object.keys(coursesBySemester).length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(coursesBySemester).map(([semester, courses]) => (
                        <div key={semester}>
                            <h2 className="text-xl font-semibold mb-3 text-gray-700">Semester {semester}</h2>
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Code</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Name</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit Hours</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {(courses as CurriculumCourse[]).map(course => (
                                            <tr key={course.id}>
                                                <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-800">{course.course_code}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{course.course_name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-600">{course.credit_hours}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    {/* Placeholder for edit/delete buttons */}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-medium text-gray-800">No Courses in this Curriculum</h3>
                    <p className="text-gray-500 mt-2">Click the "Add Course" button to get started.</p>
                </div>
            )}

            <AnimatePresence>
                {showAddCourseModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowAddCourseModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: -20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: -20 }}
                            className="bg-white rounded-2xl shadow-xl max-w-lg w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <form onSubmit={handleAddCourse}>
                                <div className="p-8">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-bold text-gray-800">Add Course to Curriculum</h2>
                                        <button type="button" onClick={() => setShowAddCourseModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label htmlFor="course-type-select" className="text-sm font-semibold text-gray-700">Course Type</label>
                                            <select
                                                id="course-type-select"
                                                value={newCourseData.course_type}
                                                onChange={(e) => setNewCourseData({ 
                                                    ...newCourseData, 
                                                    course_type: e.target.value as 'LECTURE' | 'LAB',
                                                    parent_course_id: ''
                                                })}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="LECTURE">Theory (Lecture)</option>
                                                <option value="LAB">Practical (Lab)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="course-name-input" className="text-sm font-semibold text-gray-700">Course Name</label>
                                            <input
                                                id="course-name-input"
                                                type="text"
                                                value={newCourseData.name}
                                                onChange={(e) => setNewCourseData({ ...newCourseData, name: e.target.value })}
                                                required
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g., Data Structures"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="course-code-input" className="text-sm font-semibold text-gray-700">Course Code</label>
                                            <input
                                                id="course-code-input"
                                                type="text"
                                                value={newCourseData.code}
                                                onChange={(e) => setNewCourseData({ ...newCourseData, code: e.target.value })}
                                                required
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="e.g., CS-201"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="credit-hours-input" className="text-sm font-semibold text-gray-700">Credit Hours</label>
                                            <input
                                                id="credit-hours-input"
                                                type="number"
                                                min="1"
                                                max="6"
                                                value={newCourseData.credit_hours}
                                                onChange={(e) => setNewCourseData({ ...newCourseData, credit_hours: parseInt(e.target.value) || 3 })}
                                                required
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="semester-input" className="text-sm font-semibold text-gray-700">Semester</label>
                                            <input
                                                id="semester-input"
                                                type="number"
                                                min="1"
                                                max="12"
                                                value={selectedSemester}
                                                onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10) || 1)}
                                                required
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 px-8 py-4 flex justify-end gap-3 rounded-b-2xl border-t">
                                    <button type="button" onClick={() => setShowAddCourseModal(false)} className="px-6 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100">Cancel</button>
                                    <button type="submit" disabled={submitting || !newCourseData.name || !newCourseData.code || !newCourseData.credit_hours} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        <span>{submitting ? 'Adding...' : 'Add Course'}</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MasterCurriculumDetailPage;