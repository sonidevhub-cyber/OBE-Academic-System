import React, { useState, useEffect } from "react";
import { api } from "../../api/api";
import { motion } from "framer-motion";
import { instructorCourseService } from "../../api/instructorCourseService";
import ManageClass from "views/pages/ManageClass";
import OBEReport from "views/pages/OBEReport";
import AttainmentAnalysis from "views/pages/AttainmentAnalysis";
interface Props {
  departmentId: number;
}

const OBEModule: React.FC<Props> = ({ departmentId }) => {

  const [activeTab, setActiveTab] = useState("assessment"); // ✅ FIX
  const [selectedAllocation, setSelectedAllocation] = useState<any | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // FETCH COURSES
  useEffect(() => {
    setLoading(true);
    instructorCourseService.getMyCourses()
      .then(res => {
        const data = res.data?.courses || res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setCourses(data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { id: "assessment", label: "Assessment" },
    { id: "reports", label: "OBE Reports" },
    { id: "attainment", label: "Attainment Analysis" }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">OBE Management</h2>

       <select
    className="px-3 py-2 border rounded-md min-w-[250px]"
    value={selectedAllocation?.id ? String(selectedAllocation.id) : ""}
    onChange={(e) => {
      const val = e.target.value;
      console.log('Selected Value:', val);
      if (!val) {
        setSelectedAllocation(null);
        return;
      }
      const alloc = courses.find(c => String(c.id) == String(val));
      console.log('Found Allocation:', alloc);
      setSelectedAllocation(alloc || null);
    }}
    disabled={loading}
  >
    <option value="">{loading ? "Loading courses..." : "Select Course"}</option>

    {Array.isArray(courses) && courses.length > 0 ? courses.map((c) => (
      <option key={String(c.id)} value={String(c.id)}>
        {c.course_code} - {c.course_name} ({c.batch_name})
      </option>
    )) : !loading && (
      <option disabled>No courses allocated</option>
    )}
  </select>
</div>

      {/* TABS */}
      <div className="border-b mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`mr-6 pb-2 ${
              activeTab === tab.id ? "border-b-2 border-blue-500 text-blue-600" : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ✅ ASSESSMENT TAB */}
      {activeTab === "assessment" && selectedAllocation && (
        <ManageClass 
          courseId={selectedAllocation.course_id} 
          versionId={selectedAllocation.curriculum_version_id} 
          batchId={selectedAllocation.batch_id}
        />
      )}

      {/* OBEReport */}
      {activeTab === "reports" && selectedAllocation && (
      <OBEReport courseId={selectedAllocation.course_id} />
      )}
      {activeTab === "attainment" && selectedAllocation && (
      <AttainmentAnalysis courseId={selectedAllocation.course_id} />
      )}
    </div>
  );
};

export default OBEModule;