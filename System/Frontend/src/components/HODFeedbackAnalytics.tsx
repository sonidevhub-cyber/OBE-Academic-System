import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface Props {
  feedbacks: any[];
}

const HODFeedbackAnalytics: React.FC<Props> = ({ feedbacks }) => {
  const barRef = useRef<HTMLCanvasElement | null>(null);
  const pieRef = useRef<HTMLCanvasElement | null>(null);
  const lineRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!feedbacks || feedbacks.length === 0) return;

    const typeCounts: any = {
      teaching: 0,
      communication: 0,
      support: 0,
      management: 0,
      general: 0,
    };

    feedbacks.forEach((f) => {
      typeCounts[f.feedback_type] = (typeCounts[f.feedback_type] || 0) + 1;
    });

    const days: any = {};
    feedbacks.forEach((f) => {
      const d = new Date(f.created_at).toLocaleDateString();
      days[d] = (days[d] || 0) + 1;
    });

    const barCtx = barRef.current?.getContext("2d");
    const pieCtx = pieRef.current?.getContext("2d");
    const lineCtx = lineRef.current?.getContext("2d");

    // Destroy charts before re-render
    Chart.getChart(barRef.current!)?.destroy();
    Chart.getChart(pieRef.current!)?.destroy();
    Chart.getChart(lineRef.current!)?.destroy();

    // Bar Chart
    new Chart(barCtx!, {
      type: "bar",
      data: {
        labels: Object.keys(typeCounts),
        datasets: [
          {
            label: "Feedback Count",
            data: Object.values(typeCounts),
          },
        ],
      },
    });

    // Pie Chart
    new Chart(pieCtx!, {
      type: "pie",
      data: {
        labels: Object.keys(typeCounts),
        datasets: [
          {
            data: Object.values(typeCounts),
          },
        ],
      },
    });

    // Line Chart
    new Chart(lineCtx!, {
      type: "line",
      data: {
        labels: Object.keys(days),
        datasets: [
          {
            label: "Feedback Per Day",
            data: Object.values(days),
            tension: 0.4,
          },
        ],
      },
    });
  }, [feedbacks]);

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl shadow">
        <h4 className="text-sm font-semibold mb-2">Feedback Types</h4>
        <canvas ref={barRef} height={120}></canvas>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl shadow">
        <h4 className="text-sm font-semibold mb-2">Type Distribution</h4>
        <canvas ref={pieRef} height={120}></canvas>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl shadow">
        <h4 className="text-sm font-semibold mb-2">Feedback Activity</h4>
        <canvas ref={lineRef} height={120}></canvas>
      </div>
    </div>
  );
};

export default HODFeedbackAnalytics;