"use client";
import React, { useEffect, useState } from "react";
import { Card } from "../ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ChartDataPoint {
  date: string;
  [buzzword: string]: number | string;
}

interface TeacherAnalyticsProps {
  teacherId: string;
  period?: "7d" | "30d" | "90d" | "all";
}

export const TeacherAnalytics: React.FC<TeacherAnalyticsProps> = ({ teacherId, period = "all" }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [topBuzzwords, setTopBuzzwords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/teacher/${teacherId}?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.chartData || []);
        setTopBuzzwords(json.topBuzzwords || []);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load analytics");
        setLoading(false);
      });
  }, [teacherId, period]);

  if (loading) return <Card>Loading analytics...</Card>;
  if (error) return <Card>{error}</Card>;
  if (!data.length) return <Card>No analytics data available.</Card>;
    const colors = [
      "#22d3ee",
      "#f97316",
      "#a78bfa",
      "#f43f5e",
      "#facc15",
    ];

    return (
      <Card>
        <h2 className="text-lg font-bold mb-2">Session Buzzword Trends</h2>
        <div style={{ width: "100%", height: 350 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {topBuzzwords.map((buzzword, idx) => (
                <Line
                  key={buzzword}
                  type="linear"
                  dataKey={buzzword}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
};
