import React, { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileAlt,
  faPlus,
  faSearch,
  faChevronLeft,
  faEdit,
  faTrash,
  faRedo,
} from "@fortawesome/free-solid-svg-icons";
import { fetchNui } from "../../utils/fetchNui";

// Types for General Reports
interface Report {
  id: number;
  report_number: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DetailedReport {
  report: {
    id: number;
    report_number: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    content: string;
    location: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  officers: Array<{
    id: number;
    officer_name: string;
    officer_callsign: string;
  }>;
}

interface ReportsPageProps {
  playerInfo?: {
    name: string;
    callsign: string;
    department: string;
    rank: string;
    jobName?: string;
    gradeLevel?: number;
  };
  onlineOfficers?: Array<{
    id: number;
    name: string;
    callsign: string;
    department: string;
  }>;
}

const REPORT_TYPES = [
  { value: "investigation", label: "Investigation", color: "blue" },
  { value: "surveillance", label: "Surveillance", color: "purple" },
  { value: "intelligence", label: "Intelligence Report", color: "indigo" },
  { value: "briefing", label: "Briefing", color: "green" },
  { value: "general", label: "General Report", color: "gray" },
];

const REPORT_STATUS = [
  { value: "draft", label: "Draft", color: "bg-gray-500/20 text-gray-300" },
  { value: "active", label: "Active", color: "bg-blue-500/20 text-blue-300" },
  {
    value: "pending",
    label: "Pending",
    color: "bg-yellow-500/20 text-yellow-300",
  },
  {
    value: "completed",
    label: "Completed",
    color: "bg-green-500/20 text-green-300",
  },
  {
    value: "archived",
    label: "Archived",
    color: "bg-gray-500/20 text-gray-300",
  },
];

const REPORT_PRIORITY = [
  { value: "low", label: "Low", color: "bg-gray-500/20 text-gray-300" },
  { value: "normal", label: "Normal", color: "bg-blue-500/20 text-blue-300" },
  { value: "high", label: "High", color: "bg-orange-500/20 text-orange-300" },
  { value: "urgent", label: "Urgent", color: "bg-red-500/20 text-red-300" },
];

const ReportsPage: React.FC<ReportsPageProps> = ({
  playerInfo,
  onlineOfficers = [],
}) => {
  const [viewMode, setViewMode] = useState<"list" | "detail" | "create">(
    "list"
  );
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DetailedReport | null>(
    null
  );
  const [reportLoading, setReportLoading] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all",
    priority: "all",
  });

  const [formData, setFormData] = useState({
    title: "",
    type: "general",
    status: "draft",
    priority: "normal",
    content: "",
    location: "",
    officers: [] as string[],
  });

  const [editMode, setEditMode] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    if (!playerInfo) return;
    const requiredRanks: Record<string, number> = {
      lspd: 5,
      bcso: 7,
      sasp: 3,
      usms: 1,
    };
    const jobName = playerInfo.jobName?.toLowerCase() || "";
    const gradeLevel = playerInfo.gradeLevel || 0;
    setCanDelete(
      requiredRanks[jobName] !== undefined &&
        gradeLevel >= requiredRanks[jobName]
    );
  }, [playerInfo]);

  useEffect(() => {
    if (viewMode === "list") {
      loadReports();
    }
  }, [filters, viewMode]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const result = await fetchNui<Report[]>("getGeneralReports", { filters });
      setReports(result || []);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const viewReport = async (reportId: number) => {
    setReportLoading(true);
    setViewMode("detail");
    try {
      const result = await fetchNui<DetailedReport>("getGeneralReport", {
        reportId,
      });
      if (result) {
        setSelectedReport(result);
      }
    } catch (error) {
      console.error("Error loading report:", error);
    } finally {
      setReportLoading(false);
    }
  };

  const createNewReport = () => {
    setFormData({
      title: "",
      type: "general",
      status: "draft",
      priority: "normal",
      content: "",
      location: "",
      officers: playerInfo
        ? [
            `${playerInfo.name}|${playerInfo.callsign}|${
              playerInfo.department || ""
            }`,
          ]
        : [],
    });
    setEditMode(false);
    setViewMode("create");
  };

  const editReport = () => {
    if (!selectedReport) return;
    const officers = selectedReport.officers.map(
      (o) => `${o.officer_name}|${o.officer_callsign}|${o.officer_callsign}`
    );
    setFormData({
      title: selectedReport.report.title,
      type: selectedReport.report.type,
      status: selectedReport.report.status,
      priority: selectedReport.report.priority,
      content: selectedReport.report.content,
      location: selectedReport.report.location,
      officers,
    });
    setEditMode(true);
    setViewMode("create");
  };

  const saveReport = async () => {
    if (!formData.title.trim()) return;
    setLoading(true);
    try {
      const officers = formData.officers.map((officerStr) => {
        const [name, callsign, department] = officerStr.split("|");
        return { name, callsign, department };
      });
      const reportData = {
        ...formData,
        officers,
        reportId:
          editMode && selectedReport ? selectedReport.report.id : undefined,
      };
      const result = await fetchNui<{ success: boolean; reportId?: number }>(
        editMode ? "updateGeneralReport" : "createGeneralReport",
        reportData
      );
      if (result.success) {
        if (!editMode && result.reportId) {
          viewReport(result.reportId);
        } else {
          setViewMode("list");
          loadReports();
        }
      }
    } catch (error) {
      console.error("Error saving report:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId: number) => {
    if (!canDelete) return;
    try {
      const result = await fetchNui<{ success: boolean }>(
        "deleteGeneralReport",
        { reportId }
      );
      if (result.success) {
        setViewMode("list");
        loadReports();
      }
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const statusObj = REPORT_STATUS.find((s) => s.value === status);
    return statusObj?.color || "bg-gray-500/20 text-gray-300";
  };

  const getPriorityColor = (priority: string) => {
    const priorityObj = REPORT_PRIORITY.find((p) => p.value === priority);
    return priorityObj?.color || "bg-gray-500/20 text-gray-300";
  };

  const getTypeLabel = (type: string) => {
    const typeObj = REPORT_TYPES.find((t) => t.value === type);
    return typeObj?.label || type;
  };

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedReport(null);
  }, []);

  // List View
  if (viewMode === "list") {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white/90">General Reports</h1>
          <p className="text-sm text-white/60 mt-1">
            Manage investigations, briefings, and general reports
          </p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
              />
              <input
                type="text"
                placeholder="Search by report number, title, or content..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="pl-10 pr-4 py-3 w-full rounded-lg border border-transparent bg-card/90 text-white/90 placeholder-white/50 focus:outline-none focus:border-blue-500/90 hover:border-blue-500/90"
              />
            </div>
            <button
              onClick={createNewReport}
              className="px-4 py-3 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faPlus} />
              New Report
            </button>
            <button
              onClick={loadReports}
              className="px-4 py-3 rounded-lg bg-card/90 text-white/80 hover:bg-card flex items-center gap-2 transition-colors border border-border/50"
            >
              <FontAwesomeIcon icon={faRedo} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-3 py-2 rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80 hover:border-blue-500/80"
            >
              <option value="all">All Types</option>
              {REPORT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="px-3 py-2 rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80 hover:border-blue-500/80"
            >
              <option value="all">All Status</option>
              {REPORT_STATUS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
              className="px-3 py-2 rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80 hover:border-blue-500/80"
            >
              <option value="all">All Priority</option>
              {REPORT_PRIORITY.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 bg-card/90 rounded-lg border border-border/50 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-white/50">Loading reports...</div>
              </div>
            ) : reports.length > 0 ? (
              <table className="w-full">
                <thead className="bg-background/50 sticky top-0">
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Report #
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Title
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Type
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Priority
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Created By
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      Created
                    </th>
                    <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-border/30 hover:bg-background/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                          {report.report_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white/90">
                          {report.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-white/70">
                          {getTypeLabel(report.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded ${getStatusColor(
                            report.status
                          )}`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded ${getPriorityColor(
                            report.priority
                          )}`}
                        >
                          {report.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white/80">
                          {report.created_by}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white/60">
                          {formatDate(report.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewReport(report.id)}
                          className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors text-xs"
                        >
                          <FontAwesomeIcon icon={faFileAlt} className="mr-1" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/50 p-8">
                <FontAwesomeIcon icon={faSearch} className="text-6xl mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
                <p className="text-sm text-white/40 text-center max-w-md">
                  Try adjusting your search criteria or filters
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Detail View
  if (viewMode === "detail") {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="w-10 h-10 rounded-lg bg-card/90 hover:bg-card flex items-center justify-center transition-colors border border-border/50"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-white/80" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white/90">
                Report Details
              </h1>
              {selectedReport && (
                <p className="text-sm text-white/60 mt-1">
                  Report #{selectedReport.report.report_number} • Created{" "}
                  {formatDate(selectedReport.report.created_at)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={editReport}
              className="px-4 py-2 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faEdit} />
              Edit
            </button>
            {canDelete && selectedReport && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to delete this report?"
                    )
                  ) {
                    deleteReport(selectedReport.report.id);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-600/50 text-red-300 hover:bg-red-600/70 flex items-center gap-2 transition-colors"
              >
                <FontAwesomeIcon icon={faTrash} />
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 bg-card/90 rounded-lg border border-border/50 overflow-hidden">
          {reportLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/50">Loading report...</div>
            </div>
          ) : selectedReport ? (
            <div className="p-6 h-full overflow-y-auto space-y-6">
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <h4 className="text-sm font-medium mb-3 text-white/90">
                  Report Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60">Report Number</span>
                    <span className="font-mono text-sm text-blue-400">
                      {selectedReport.report.report_number}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60">Type</span>
                    <span className="text-sm text-white/90">
                      {getTypeLabel(selectedReport.report.type)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60">Status</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getStatusColor(
                        selectedReport.report.status
                      )}`}
                    >
                      {selectedReport.report.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60">Priority</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getPriorityColor(
                        selectedReport.report.priority
                      )}`}
                    >
                      {selectedReport.report.priority}
                    </span>
                  </div>
                  {selectedReport.report.location && (
                    <div className="col-span-2 flex justify-between py-2">
                      <span className="text-sm text-white/60">Location</span>
                      <span className="text-sm text-white/90">
                        {selectedReport.report.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <h4 className="text-sm font-medium mb-3 text-white/90">
                  Report Content
                </h4>
                <div className="p-4 bg-card/50 rounded border border-border/30">
                  <p className="text-white/90 whitespace-pre-wrap">
                    {selectedReport.report.content}
                  </p>
                </div>
              </div>

              {selectedReport.officers.length > 0 && (
                <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                  <h4 className="text-sm font-medium mb-3 text-white/90">
                    Officers ({selectedReport.officers.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedReport.officers.map((officer) => (
                      <div
                        key={officer.id}
                        className="flex items-center gap-2 p-2 bg-card/50 rounded"
                      >
                        <span className="text-sm font-medium text-white/90">
                          {officer.officer_callsign} - {officer.officer_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-white/40">Report not found</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Create/Edit View
  if (viewMode === "create") {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setViewMode(editMode && selectedReport ? "detail" : "list")
              }
              className="w-10 h-10 rounded-lg bg-card/90 hover:bg-card flex items-center justify-center transition-colors border border-border/50"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-white/80" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white/90">
                {editMode ? "Edit Report" : "New General Report"}
              </h1>
              {editMode && selectedReport && (
                <p className="text-sm text-white/60 mt-1">
                  Report #{selectedReport.report.report_number}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode(editMode ? "detail" : "list")}
              className="px-4 py-2 rounded-lg text-white/70 hover:bg-card/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveReport}
              disabled={loading || !formData.title.trim()}
              className={`px-4 py-2 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 transition-colors ${
                loading || !formData.title.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {loading
                ? "Saving..."
                : editMode
                ? "Update Report"
                : "Create Report"}
            </button>
          </div>
        </div>

        <div className="flex-1 bg-card/90 rounded-lg border border-border/50 overflow-hidden">
          <div className="p-6 h-full overflow-y-auto space-y-6">
            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <h4 className="text-sm font-medium mb-4 text-white/90">
                Basic Information
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    placeholder="Enter report title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                      className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80"
                    >
                      {REPORT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80"
                    >
                      {REPORT_STATUS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value })
                      }
                      className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80"
                    >
                      {REPORT_PRIORITY.map((priority) => (
                        <option key={priority.value} value={priority.value}>
                          {priority.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/90 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="Enter location"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-background/50 p-4 rounded-lg border border-border/50">
              <h4 className="text-sm font-medium mb-4 text-white/90">
                Report Content
              </h4>
              <textarea
                placeholder="Enter detailed report content..."
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="px-3 py-2 w-full h-96 resize-none rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ReportsPage;
