import React, { useEffect, useState } from "react";
import { feedbackService } from "../../api/FeedbackServices";
import { api } from "../../api/api";

const CoordinatorFeedbackView = () => {

const [activeTab, setActiveTab] = useState("indirect");

const [indirectData, setIndirectData] = useState<any[]>([]);
const [comparisonData, setComparisonData] = useState<any[]>([]);

const [batches, setBatches] = useState<any[]>([]);
const [selectedBatch, setSelectedBatch] = useState("");
const [rootCause, setRootCause] = useState("");
const [remedialAction, setRemedialAction] = useState("");
const [nextBatch, setNextBatch] = useState("");
const [expandedCard, setExpandedCard] = useState<string | null>(null);
useEffect(() => {
fetchBatches();
fetchComparisonData();
}, []);
const createCQI = async (item: any) => {
  try {

    await api.post("/feedback/create-cqi/", {
      course: item.course_id,
      clo: item.clo_id,
      batch: item.batch_id,
      semester: item.semester_id,
      root_cause: rootCause,
      remedial_action: remedialAction,
    });

    alert("CQI Created Successfully");

    fetchComparisonData();

  } catch (err) {
    console.error(err);
  }
};
const applyCQI = async (cqiId: string) => {

  try {

    await api.post("/feedback/apply-cqi/", {

      cqi_id: cqiId,

      next_batch: nextBatch

    });

    alert("CQI Applied Successfully");

    fetchComparisonData();

  } catch (err) {

    console.error(err);

  }

};
useEffect(() => {
  if (selectedBatch) {
    fetchIndirectData();
    fetchComparisonData();
  }
}, [selectedBatch]);

const fetchBatches = async () => {
try {
const res = await api.get(
"/feedback/coordinator-batches/"
);

  setBatches(res.data || []);

} catch (err) {
  console.error(err);
}

};

const fetchIndirectData = async () => {
try {

  const res =
    await feedbackService.getIndirectReport(
      selectedBatch
    );

  console.log(
    "INDIRECT REPORT:",
    res
  );

  setIndirectData(
    Array.isArray(res)
      ? res
      : res?.results || []
  );

} catch (err) {
  console.error(err);
}

};

const fetchComparisonData = async () => {
  if (!selectedBatch) return;

  try {
    const res = await feedbackService.compare(selectedBatch);

    console.log("COMPARE RESPONSE:", res);

    setComparisonData(
      Array.isArray(res)
        ? res
        : res?.results || []
    );

  } catch (err) {
    console.error(err);
    setComparisonData([]);
  }
};
return (
<div className="p-6">

  <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-6 shadow-sm">

  <div className="flex items-center justify-between">

    <div>
      <h2 className="text-3xl font-bold text-gray-800">
        Feedback & CQI Dashboard
      </h2>

      <p className="text-gray-500 mt-2">
        Compare Direct & Indirect Assessment and manage Continuous Quality Improvement.
      </p>
    </div>

    <div className="bg-indigo-100 text-indigo-700 rounded-2xl p-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-10 w-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17v-6m4 6V7m4 10v-3M5 21h14"
        />
      </svg>
    </div>

  </div>

</div>

  <div className="bg-white rounded-xl shadow p-5 mb-6 border">

<label className="block text-sm font-semibold mb-2">
Select Batch
</label>

<select
value={selectedBatch}
onChange={(e)=>setSelectedBatch(e.target.value)}
className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-indigo-500"
>

<option value="">Choose Batch</option>

{batches.map(batch=>(
<option key={batch.id} value={batch.id}>
{batch.name}
</option>
))}

</select>

</div>

  <div className="flex bg-white rounded-xl shadow-lg p-2 mb-6 w-fit border">

  <button
    onClick={() => setActiveTab("indirect")}
    className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
      activeTab === "indirect"
        ? "bg-indigo-600 text-white shadow-lg"
        : "text-gray-700 hover:bg-gray-100"
    }`}
  >
    📋 Indirect Assessment
  </button>

  <button
    onClick={() => setActiveTab("comparison")}
    className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
      activeTab === "comparison"
        ? "bg-indigo-600 text-white shadow-lg"
        : "text-gray-700 hover:bg-gray-100"
    }`}
  >
     Direct vs Indirect
  </button>

</div>

  {activeTab === "indirect" && (
    <div>

      {!selectedBatch ? (
        <div className="bg-blue-100 border border-blue-300 p-4 rounded-lg">
          Please select a batch first.
        </div>
      ) : indirectData.length === 0 ? (
        <p>
          No indirect assessment
          data found.
        </p>
      ) : (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

{indirectData.map((item, index) => (

<div
key={index}
className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300"
>

<div className="flex justify-between items-center mb-4">

<div>
<h3 className="text-xl font-bold text-indigo-700">
{item.course}
</h3>

<p className="text-sm text-gray-500">
{item.batch}
</p>
</div>

<span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
{item.semester}
</span>

</div>

<div className="space-y-4">

<div>
<p className="text-gray-500 text-sm">
Course Learning Outcome
</p>

<p className="font-semibold text-gray-800">
{item.clo}
</p>
</div>

<div>

<div className="flex justify-between mb-2">

<span className="font-medium">
Indirect Attainment
</span>

<span className="font-bold">
{item.indirect_percentage}%
</span>

</div>

<div className="w-full bg-gray-200 rounded-full h-3">

<div
className={`h-3 rounded-full ${
item.indirect_percentage >= 80
? "bg-green-500"
: item.indirect_percentage >= 60
? "bg-yellow-500"
: "bg-red-500"
}`}
style={{
width: `${item.indirect_percentage}%`
}}
>

</div>

</div>

</div>

</div>

</div>

))}

</div>
      )}
      
    </div>
  )}

  {activeTab === "comparison" && (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">

<div className="bg-white shadow rounded-xl p-5">
<p className="text-gray-500">Total Records</p>
<h2 className="text-3xl font-bold">
{comparisonData.length}
</h2>
</div>

<div className="bg-green-50 shadow rounded-xl p-5">
<p className="text-green-600">Matched</p>
<h2 className="text-3xl font-bold">
{comparisonData.filter(x=>x.status==="MATCHED").length}
</h2>
</div>

<div className="bg-yellow-50 shadow rounded-xl p-5">
<p className="text-yellow-600">Red Flags</p>
<h2 className="text-3xl font-bold">
{comparisonData.filter(x=>x.status==="RED_FLAG").length}
</h2>
</div>

<div className="bg-red-50 shadow rounded-xl p-5">
<p className="text-red-600">CQI Required</p>
<h2 className="text-3xl font-bold">
{comparisonData.filter(x=>x.status==="CQI_REQUIRED").length}
</h2>
</div>

</div>
       
      {!selectedBatch ? (

<div className="bg-blue-100 border border-blue-300 p-4 rounded-lg">
Please select a batch first.
</div>

) : comparisonData.length === 0 ? (
        <div className="bg-yellow-100 border border-yellow-300 p-4 rounded-lg">
          ⚠ Direct
          assessment data
          not available yet.
        </div>
      ) : (
        comparisonData.map(
  (item) => (
    <div
      key={item.clo}
      onClick={() =>
        setExpandedCard(
          expandedCard === item.clo ? null : item.clo
        )
      }
      className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6 cursor-pointer hover:shadow-xl transition-all duration-300"
    >
    <div className="flex justify-between items-start mb-5">
      <div>
        <h2 className="text-xl font-bold text-indigo-700">
          {item.course}
        </h2>

        <p className="text-gray-500">
          {item.course_code}
        </p>

        <p className="font-medium mt-2">
          {item.clo}
        </p>
        <div className="grid grid-cols-3 gap-4 mt-4">

<div className="bg-blue-50 rounded-xl p-4 text-center">
<h3 className="text-sm">Direct</h3>
<p className="text-2xl font-bold text-blue-700">
{item.direct}%
</p>
</div>

<div className="bg-green-50 rounded-xl p-4 text-center">
<h3 className="text-sm">Indirect</h3>
<p className="text-2xl font-bold text-green-700">
{item.indirect}%
</p>
</div>

<div className="bg-red-50 rounded-xl p-4 text-center">
<h3 className="text-sm">Gap</h3>
<p className="text-2xl font-bold text-red-700">
{item.gap}%
</p>
</div>

</div>
      </div>

      <span
        className={`px-4 py-2 rounded-full text-sm font-bold ${
          item.status === "MATCHED"
            ? "bg-green-100 text-green-700"
            : item.status === "RED_FLAG"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        {item.status.replace("_", " ")}
      </span>
      <button
onClick={(e)=>{
e.stopPropagation();
setExpandedCard(
expandedCard===item.clo ? null : item.clo
);
}}
className="text-indigo-600 font-semibold"
>
{expandedCard===item.clo ? "Hide Details ▲" : "View Details ▼"}
</button>
    </div>

{expandedCard === item.clo &&(item.status === "CQI_REQUIRED" || item.status === "RED_FLAG") &&
 !item.cqi_exists && (

<div className="mt-5 bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">

  <h3 className="text-xl font-bold text-red-700 mb-5">
    Create Continuous Quality Improvement (CQI)
  </h3>

  <div className="mb-4">
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      Root Cause
    </label>

    <textarea
      placeholder="Enter root cause..."
      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-400 outline-none"
      rows={3}
      onChange={(e) => setRootCause(e.target.value)}
    />
  </div>

  <div className="mb-4">
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      Remedial Action
    </label>

    <textarea
      placeholder="Enter remedial action..."
      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-400 outline-none"
      rows={3}
      onChange={(e) => setRemedialAction(e.target.value)}
    />
  </div>

  <button
    onClick={() => createCQI(item)}
    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200"
  >
    Save CQI
  </button>

  <select
    className="w-full border border-gray-300 rounded-lg p-3 mt-5"
    value={nextBatch}
    onChange={(e) => setNextBatch(e.target.value)}
  >
    <option value="">Select Next Batch</option>

    {batches.map((batch) => (
      <option key={batch.id} value={batch.id}>
        {batch.name}
      </option>
    ))}
  </select>

</div>

)}
{expandedCard === item.clo && item.cqi_exists && (

<div className="mt-5 bg-green-50 border border-green-300 rounded-xl p-6 shadow-sm">

  <h3 className="text-xl font-bold text-green-700 mb-2">
    ✅ CQI Successfully Created
  </h3>

  <p className="text-gray-600 mb-4">
    Select the next batch to apply this CQI.
  </p>

  <label className="block text-sm font-semibold text-gray-700 mb-2">
    Next Batch
  </label>

  <select
    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
    value={nextBatch}
    onChange={(e) => setNextBatch(e.target.value)}
  >
    <option value="">Select Next Batch</option>

    {batches.map((b) => (
      <option key={b.id} value={b.id}>
        {b.name}
      </option>
    ))}
  </select>

  <button
    onClick={() => applyCQI(item.cqi_id)}
    className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition duration-200"
  >
    Apply CQI to Next Batch
  </button>

</div>

)}
            </div>
          )
        )
      )}

    </div>
  )}

</div>

);
};

export default CoordinatorFeedbackView;