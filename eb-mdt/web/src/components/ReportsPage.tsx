import React, { useState, useEffect, useCallback } from "react";
import { fetchNui } from "../utils/fetchNui";
import { classNames } from "../utils/misc";

// Types (keeping the same as original)
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
  involved_count: number;
  charge_count: number;
  evidence_count: number;
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
    created_by_citizenid: string;
    created_at: string;
    updated_at: string;
    updated_by: string;
  };
  involved: Array<{
    id: number;
    citizenid: string;
    role: string;
    notes: string;
    name: string;
    firstname: string;
    lastname: string;
    phone: string;
  }>;
  charges: Array<{
    id: number;
    citizenid: string;
    charge_code: string;
    charge_title: string;
    charge_class: string;
    fine: number;
    months: number;
    guilty_plea: boolean;
  }>;
  evidence: Array<{
    id: number;
    evidence_id: string;
    description: string;
  }>;
  officers: Array<{
    id: number;
    officer_name: string;
    officer_citizenid: string;
    officer_callsign: string;
  }>;
}

interface CitizenSearchResult {
  citizenid: string;
  name: string;
  phone: string;
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
    rank: string;
  }>;
}

const REPORT_TYPES = [
  {
    value: "incident",
    label: "Incident Report",
    icon: "fas fa-file-alt",
    color: "blue",
  },
  {
    value: "ois",
    label: "Officer Involved Shooting (OIS)",
    icon: "fas fa-crosshairs",
    color: "red",
  },
  {
    value: "citation",
    label: "Citation",
    icon: "fas fa-gavel",
    color: "yellow",
  },
];

const REPORT_STATUS = [
  { value: "open", label: "Open", color: "bg-blue-500" },
  { value: "pending", label: "Pending", color: "bg-yellow-500" },
  { value: "closed", label: "Closed", color: "bg-green-500" },
  { value: "rejected", label: "Rejected", color: "bg-red-500" },
];

const REPORT_PRIORITY = [
  { value: "low", label: "Low", color: "bg-gray-500" },
  { value: "normal", label: "Normal", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "bg-red-500" },
];

const INVOLVEMENT_ROLES = [
  { value: "suspect", label: "Suspect" },
  { value: "victim", label: "Victim" },
  { value: "witness", label: "Witness" },
  { value: "reporting_party", label: "Reporting Party" },
  { value: "other", label: "Other" },
];

const ReportsPage: React.FC<ReportsPageProps> = ({
  playerInfo,
  onlineOfficers = [],
}) => {
  // View state
  const [viewMode, setViewMode] = useState<"list" | "detail" | "create">(
    "list"
  );

  // List view states
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all",
    priority: "all",
    dateFrom: "",
    dateTo: "",
  });

  // Detail view states
  const [selectedReport, setSelectedReport] = useState<DetailedReport | null>(
    null
  );
  const [reportLoading, setReportLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Create/Edit form states
  const [formData, setFormData] = useState({
    title: "",
    type: "incident",
    status: "open",
    priority: "normal",
    content: "",
    location: "",
    officers: [] as string[],
    involved: [] as Array<{
      citizenid: string;
      name: string;
      role: string;
      notes: string;
    }>,
    charges: [] as Array<{
      citizenid: string;
      code: string;
      title: string;
      class: string;
      fine: number;
      months: number;
      guiltyPlea: boolean;
    }>,
    evidence: [] as Array<{
      evidenceId: string;
      description: string;
    }>,
  });

  // Modal states
  const [reportTypeModalOpen, setReportTypeModalOpen] = useState(false);
  const [citizenSearchModalOpen, setCitizenSearchModalOpen] = useState(false);
  const [citizenRoleModalOpen, setCitizenRoleModalOpen] = useState(false);
  const [citizenSearchQuery, setCitizenSearchQuery] = useState("");
  const [citizenSearchResults, setCitizenSearchResults] = useState<
    CitizenSearchResult[]
  >([]);
  const [citizenSearchLoading, setCitizenSearchLoading] = useState(false);
  const [addingRole, setAddingRole] = useState<string>("");

  // Permissions
  const [canDelete, setCanDelete] = useState(false);

  // Check delete permissions
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

  // Load reports on mount and filter change
  useEffect(() => {
    if (viewMode === "list") {
      loadReports();
    }
  }, [filters, viewMode]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const result = await fetchNui<Report[]>("getReports", { filters });
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
      const result = await fetchNui<DetailedReport>("getReport", { reportId });
      if (result) {
        setSelectedReport(result);
      }
    } catch (error) {
      console.error("Error loading report:", error);
    } finally {
      setReportLoading(false);
    }
  };

  const createReport = (type: string) => {
    setFormData({
      title: "",
      type: type,
      status: type === "citation" ? "closed" : "open",
      priority:
        type === "ois" ? "critical" : type === "citation" ? "low" : "normal",
      content: "",
      location: "",
      officers: playerInfo
        ? [
            `${playerInfo.name}|${playerInfo.callsign}|${
              playerInfo.department || ""
            }`,
          ]
        : [],
      involved: [],
      charges: [],
      evidence: [],
    });

    setReportTypeModalOpen(false);
    setViewMode("create");
    setEditMode(false);
  };

  const saveReport = async () => {
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      const officers = formData.officers.map((officerStr) => {
        const [name, callsign, citizenid] = officerStr.split("|");
        return { name, callsign, citizenid };
      });

      const reportData = {
        ...formData,
        officers,
        reportId:
          editMode && selectedReport ? selectedReport.report.id : undefined,
      };

      const result = await fetchNui<{ success: boolean; reportId?: number }>(
        editMode ? "updateReport" : "createReport",
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
      const result = await fetchNui<{ success: boolean }>("deleteReport", {
        reportId,
      });
      if (result.success) {
        setViewMode("list");
        loadReports();
      }
    } catch (error) {
      console.error("Error deleting report:", error);
    }
  };

  const searchCitizens = async () => {
    if (!citizenSearchQuery.trim()) return;

    setCitizenSearchLoading(true);
    try {
      const results = await fetchNui<CitizenSearchResult[]>(
        "searchCitizensForReport",
        { query: citizenSearchQuery }
      );
      setCitizenSearchResults(results || []);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setCitizenSearchLoading(false);
    }
  };

  const addInvolvedPerson = (citizen: CitizenSearchResult) => {
    setFormData((prev) => ({
      ...prev,
      involved: [
        ...prev.involved,
        {
          citizenid: citizen.citizenid,
          name: citizen.name,
          role: addingRole,
          notes: "",
        },
      ],
    }));
    setCitizenSearchModalOpen(false);
    setCitizenSearchQuery("");
    setCitizenSearchResults([]);
    setAddingRole("");
  };

  const removeInvolvedPerson = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      involved: prev.involved.filter((_, i) => i !== index),
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const statusObj = REPORT_STATUS.find((s) => s.value === status);
    return statusObj?.color || "bg-gray-500";
  };

  const getPriorityColor = (priority: string) => {
    const priorityObj = REPORT_PRIORITY.find((p) => p.value === priority);
    return priorityObj?.color || "bg-gray-500";
  };

  const getTypeLabel = (type: string) => {
    const typeObj = REPORT_TYPES.find((t) => t.value === type);
    return typeObj?.label || type;
  };

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedReport(null);
  }, []);

  // Render list view
  if (viewMode === "list") {
    return (
      <div className="h-full flex flex-col gap-4">
        {/* Search Section */}
        <div className="mdt-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-200"></i>
              <input
                type="text"
                className="mdt-input pl-10 w-full"
                placeholder="Search by report number, title, or content..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </div>
            <button
              className="mdt-button mdt-button-primary flex items-center gap-2"
              onClick={() => setReportTypeModalOpen(true)}
            >
              <i className="fas fa-plus"></i>
              New Report
            </button>
            <button
              className="mdt-button mdt-button-secondary"
              onClick={loadReports}
            >
              <i className="fas fa-redo"></i>
            </button>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <select
              className="mdt-input"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="all">All Types</option>
              {REPORT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              className="mdt-input"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="all">All Status</option>
              {REPORT_STATUS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              className="mdt-input"
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
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

        {/* Reports Table */}
        <div className="mdt-card flex-1 flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-80">
                <div className="loading-spinner"></div>
              </div>
            ) : reports.length > 0 ? (
              <table className="mdt-table">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th>Involved</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <span className="badge badge-outline text-xs">
                          {report.report_number}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-medium line-clamp-1 text-white">
                          {report.title}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-white">
                          {getTypeLabel(report.type)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={classNames(
                            "badge text-white text-xs",
                            getStatusColor(report.status)
                          )}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className={classNames(
                            "badge text-white text-xs",
                            getPriorityColor(report.priority)
                          )}
                        >
                          {report.priority}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-white">
                          {report.created_by}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-primary-200">
                          {formatDate(report.created_at)}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <span className="badge badge-outline text-xs">
                            {report.involved_count} people
                          </span>
                          {report.charge_count > 0 && (
                            <span className="badge bg-orange-500 text-white text-xs">
                              {report.charge_count} charges
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors"
                          onClick={() => viewReport(report.id)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center h-80">
                <i className="fas fa-search text-6xl text-primary-400 mb-4"></i>
                <h3 className="text-lg font-medium text-white mb-2">
                  No reports found
                </h3>
                <p className="text-sm text-primary-200 text-center max-w-md">
                  Try adjusting your search criteria or filters
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Report Type Selection Modal */}
        {reportTypeModalOpen && (
          <div className="modal-overlay">
            <div className="modal-container max-w-lg">
              <div className="modal-header">
                <h2 className="text-lg font-semibold text-white">
                  Select Report Type
                </h2>
              </div>

              <div className="modal-content space-y-4">
                <p className="text-sm text-primary-200">
                  Choose the type of report you want to create:
                </p>
                {REPORT_TYPES.map((type) => (
                  <div
                    key={type.value}
                    className="p-4 bg-mdt-accent rounded-lg cursor-pointer transition-all duration-150 hover:bg-mdt-border border border-mdt-border hover:border-primary-600"
                    onClick={() => createReport(type.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={classNames(
                            "w-12 h-12 rounded-lg flex items-center justify-center",
                            type.color === "blue"
                              ? "bg-blue-500"
                              : type.color === "red"
                              ? "bg-red-500"
                              : type.color === "yellow"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                          )}
                        >
                          <i className={`${type.icon} text-white`}></i>
                        </div>
                        <div>
                          <h3 className="text-md font-semibold text-white">
                            {type.label}
                          </h3>
                          <p className="text-xs text-primary-200 mt-1">
                            {type.value === "incident" &&
                              "General incident or crime report"}
                            {type.value === "ois" &&
                              "Officer involved shooting documentation"}
                            {type.value === "citation" &&
                              "Traffic or municipal violations"}
                          </p>
                        </div>
                      </div>
                      <i className="fas fa-chevron-right text-primary-200"></i>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button
                  className="mdt-button mdt-button-secondary"
                  onClick={() => setReportTypeModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render create/edit view
  if (viewMode === "create") {
    const reportType = REPORT_TYPES.find((t) => t.value === formData.type);

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="mdt-card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="w-10 h-10 rounded-lg bg-mdt-accent hover:bg-gray-600 flex items-center justify-center transition-colors"
                onClick={() =>
                  setViewMode(editMode && selectedReport ? "detail" : "list")
                }
              >
                <i className="fas fa-chevron-left text-white"></i>
              </button>
              <div className="flex items-center gap-3">
                <div
                  className={classNames(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-white",
                    reportType?.color === "blue"
                      ? "bg-blue-500"
                      : reportType?.color === "red"
                      ? "bg-red-500"
                      : reportType?.color === "yellow"
                      ? "bg-yellow-500"
                      : "bg-primary-600"
                  )}
                >
                  <i className={reportType?.icon || "fas fa-file-alt"}></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {editMode
                      ? "Edit Report"
                      : `New ${reportType?.label || "Report"}`}
                  </h2>
                  {editMode && selectedReport && (
                    <p className="text-sm text-primary-200">
                      Report #{selectedReport.report.report_number}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="mdt-button mdt-button-secondary"
                onClick={() => setViewMode("list")}
              >
                Cancel
              </button>
              <button
                className={classNames(
                  "mdt-button mdt-button-primary flex items-center gap-2",
                  loading ? "opacity-50 cursor-not-allowed" : ""
                )}
                onClick={saveReport}
                disabled={loading}
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {editMode ? "Update Report" : "Create Report"}
              </button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="mdt-card flex-1 overflow-auto custom-scrollbar">
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="profile-section">
              <h4>Basic Information</h4>
              <div className="space-y-3">
                <div className="profile-row">
                  <span className="profile-label">Report Title</span>
                  <div className="flex-1 ml-4">
                    <input
                      type="text"
                      className="mdt-input w-full"
                      placeholder={`Enter ${
                        reportType?.label || "report"
                      } title...`}
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>
                </div>
                {formData.type !== "ois" && (
                  <div className="profile-row">
                    <span className="profile-label">Priority</span>
                    <div className="flex-1 ml-4">
                      <select
                        className="mdt-input w-full"
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({ ...formData, priority: e.target.value })
                        }
                      >
                        {REPORT_PRIORITY.map((priority) => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {formData.type !== "citation" && (
                  <div className="profile-row">
                    <span className="profile-label">Status</span>
                    <div className="flex-1 ml-4">
                      <select
                        className="mdt-input w-full"
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                      >
                        {REPORT_STATUS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="profile-row">
                  <span className="profile-label flex items-center gap-2">
                    <i className="fas fa-map-marker-alt info-icon"></i>
                    Location
                  </span>
                  <div className="flex-1 ml-4">
                    <input
                      type="text"
                      className="mdt-input w-full"
                      placeholder="Enter incident location..."
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Officers */}
            <div className="profile-section">
              <div className="flex items-center justify-between mb-3">
                <h4>Officers Involved</h4>
                <button
                  className="mdt-button mdt-button-primary text-xs py-1 px-3 flex items-center gap-2"
                  onClick={() => {
                    setAddingRole("officer");
                    setCitizenSearchModalOpen(true);
                  }}
                >
                  <i className="fas fa-user-plus"></i>
                  Add Officer
                </button>
              </div>
              <div className="space-y-2">
                {formData.officers.map((officer, index) => {
                  const [name, callsign] = officer.split("|");
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-mdt-bg rounded"
                    >
                      <div className="flex items-center gap-2">
                        <i className="fas fa-badge info-icon"></i>
                        <span className="text-sm text-white">
                          {callsign} - {name}
                        </span>
                      </div>
                      <button
                        className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded text-white text-xs transition-colors"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            officers: formData.officers.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Involved Parties */}
            <div className="profile-section">
              <div className="flex items-center justify-between mb-3">
                <h4>Involved Parties</h4>
                <button
                  className="mdt-button mdt-button-primary text-xs py-1 px-3 flex items-center gap-2"
                  onClick={() => setCitizenRoleModalOpen(true)}
                >
                  <i className="fas fa-user-plus"></i>
                  Add Person
                </button>
              </div>

              <div className="space-y-3">
                {formData.involved.map((person, index) => (
                  <div
                    key={index}
                    className="p-3 bg-mdt-bg rounded border border-mdt-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="badge bg-blue-500 text-white text-xs">
                            {
                              INVOLVEMENT_ROLES.find(
                                (r) => r.value === person.role
                              )?.label
                            }
                          </span>
                          <span className="text-sm font-medium text-white">
                            {person.name}
                          </span>
                          <span className="badge badge-outline text-xs">
                            {person.citizenid}
                          </span>
                        </div>
                        {person.notes && (
                          <p className="text-xs text-primary-200 mt-1">
                            {person.notes}
                          </p>
                        )}
                      </div>
                      <button
                        className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded text-white text-xs transition-colors"
                        onClick={() => removeInvolvedPerson(index)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Content */}
            <div className="profile-section">
              <h4>Report Content</h4>
              <textarea
                className="mdt-input w-full h-32 resize-none"
                placeholder="Enter detailed report content..."
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Role Selection Modal */}
        {citizenRoleModalOpen && (
          <div className="modal-overlay">
            <div className="modal-container max-w-sm">
              <div className="modal-header">
                <h2 className="text-lg font-semibold text-white">
                  Select Role
                </h2>
              </div>

              <div className="modal-content space-y-2">
                {INVOLVEMENT_ROLES.map((role) => (
                  <button
                    key={role.value}
                    className="w-full p-3 bg-mdt-accent hover:bg-mdt-border rounded transition-colors text-left text-white"
                    onClick={() => {
                      setAddingRole(role.value);
                      setCitizenRoleModalOpen(false);
                      setCitizenSearchModalOpen(true);
                    }}
                  >
                    {role.label}
                  </button>
                ))}
              </div>

              <div className="modal-footer">
                <button
                  className="mdt-button mdt-button-secondary"
                  onClick={() => setCitizenRoleModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Citizen Search Modal */}
        {citizenSearchModalOpen && (
          <div className="modal-overlay">
            <div className="modal-container max-w-md">
              <div className="modal-header">
                <h2 className="text-lg font-semibold text-white">
                  Add{" "}
                  {INVOLVEMENT_ROLES.find((r) => r.value === addingRole)
                    ?.label || "Person"}
                </h2>
              </div>

              <div className="modal-content space-y-4">
                <div className="relative">
                  <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-200"></i>
                  <input
                    type="text"
                    className="mdt-input pl-10 w-full"
                    placeholder="Search by name or Citizen ID..."
                    value={citizenSearchQuery}
                    onChange={(e) => setCitizenSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && searchCitizens()}
                  />
                </div>
                <button
                  className={classNames(
                    "mdt-button mdt-button-primary w-full flex items-center justify-center gap-2",
                    citizenSearchLoading ? "opacity-50 cursor-not-allowed" : ""
                  )}
                  onClick={searchCitizens}
                  disabled={citizenSearchLoading}
                >
                  {citizenSearchLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  Search
                </button>

                {citizenSearchResults.length > 0 && (
                  <div className="space-y-2">
                    {citizenSearchResults.map((citizen) => (
                      <div
                        key={citizen.citizenid}
                        className="p-3 bg-mdt-accent rounded cursor-pointer transition-all duration-150 hover:bg-mdt-border"
                        onClick={() => addInvolvedPerson(citizen)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {citizen.name}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="badge badge-outline text-xs">
                                {citizen.citizenid}
                              </span>
                              <span className="text-xs text-primary-200">
                                Phone: {citizen.phone}
                              </span>
                            </div>
                          </div>
                          <i className="fas fa-plus text-primary-200"></i>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="mdt-button mdt-button-secondary"
                  onClick={() => {
                    setCitizenSearchModalOpen(false);
                    setCitizenSearchQuery("");
                    setCitizenSearchResults([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render detail view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mdt-card p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="w-10 h-10 rounded-lg bg-mdt-accent hover:bg-gray-600 flex items-center justify-center transition-colors"
              onClick={handleBackToList}
            >
              <i className="fas fa-chevron-left text-white"></i>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white">
                <i className="fas fa-file-alt"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Report Details
                </h2>
                {selectedReport && (
                  <p className="text-sm text-primary-200">
                    Report #{selectedReport.report.report_number} • Created{" "}
                    {formatDate(selectedReport.report.created_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="mdt-button mdt-button-secondary flex items-center gap-2">
              <i className="fas fa-edit"></i>
              Edit
            </button>
            {canDelete && (
              <button
                className="mdt-button bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                onClick={() =>
                  selectedReport && deleteReport(selectedReport.report.id)
                }
              >
                <i className="fas fa-trash"></i>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="mdt-card flex-1 overflow-auto custom-scrollbar">
        {reportLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="loading-spinner"></div>
          </div>
        ) : selectedReport ? (
          <div className="p-6 space-y-6">
            {/* Status Bar */}
            <div className="p-4 bg-mdt-accent rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span
                    className={classNames(
                      "badge text-white",
                      getStatusColor(selectedReport.report.status)
                    )}
                  >
                    {selectedReport.report.status.toUpperCase()}
                  </span>
                  <span
                    className={classNames(
                      "badge text-white",
                      getPriorityColor(selectedReport.report.priority)
                    )}
                  >
                    {selectedReport.report.priority.toUpperCase()} PRIORITY
                  </span>
                  <span className="badge badge-outline">
                    {getTypeLabel(selectedReport.report.type)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-primary-200">
                  <i className="fas fa-clock"></i>
                  Last updated: {formatDate(selectedReport.report.updated_at)}
                </div>
              </div>
            </div>

            {/* Report Info */}
            <div className="profile-section">
              <h3 className="text-lg font-semibold mb-4 text-white">
                {selectedReport.report.title}
              </h3>
              <div className="space-y-3">
                <div className="profile-row">
                  <span className="profile-label flex items-center gap-2">
                    <i className="fas fa-user info-icon"></i>
                    Created by
                  </span>
                  <span className="profile-value">
                    {selectedReport.report.created_by}
                  </span>
                </div>
                <div className="profile-row">
                  <span className="profile-label flex items-center gap-2">
                    <i className="fas fa-map-marker-alt info-icon"></i>
                    Location
                  </span>
                  <span className="profile-value">
                    {selectedReport.report.location || "Not specified"}
                  </span>
                </div>
              </div>
            </div>

            {/* Officers */}
            {selectedReport.officers.length > 0 && (
              <div className="profile-section">
                <h4>Officers Involved</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedReport.officers.map((officer) => (
                    <div key={officer.id} className="info-card">
                      <i className="fas fa-badge info-icon"></i>
                      <span className="text-sm text-white">
                        {officer.officer_callsign} - {officer.officer_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report Content */}
            <div className="profile-section">
              <h4>Report Details</h4>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-white">
                {selectedReport.report.content}
              </p>
            </div>

            {/* Involved Parties */}
            {selectedReport.involved.length > 0 && (
              <div className="profile-section">
                <h4>Involved Parties ({selectedReport.involved.length})</h4>
                <div className="space-y-3">
                  {selectedReport.involved.map((person) => (
                    <div
                      key={person.id}
                      className="p-3 bg-mdt-bg rounded border border-mdt-border"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="badge bg-blue-500 text-white text-xs">
                              {
                                INVOLVEMENT_ROLES.find(
                                  (r) => r.value === person.role
                                )?.label
                              }
                            </span>
                            <span className="text-sm font-medium text-white">
                              {person.firstname} {person.lastname}
                            </span>
                            <span className="badge badge-outline text-xs">
                              {person.citizenid}
                            </span>
                            <span className="text-xs text-primary-200">
                              Phone: {person.phone}
                            </span>
                          </div>
                          {person.notes && (
                            <p className="text-xs text-primary-200 mt-1">
                              Notes: {person.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charges */}
            {selectedReport.charges.length > 0 && (
              <div className="profile-section">
                <h4>Charges Filed ({selectedReport.charges.length})</h4>
                <div className="space-y-3">
                  {selectedReport.charges.map((charge) => (
                    <div
                      key={charge.id}
                      className="p-3 bg-mdt-bg rounded border border-mdt-border"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-gavel info-icon"></i>
                            <span className="text-sm font-medium text-white">
                              §{charge.charge_code} - {charge.charge_title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={classNames(
                                "badge text-white text-xs",
                                charge.charge_class === "Felony"
                                  ? "bg-red-500"
                                  : charge.charge_class === "Misdemeanor"
                                  ? "bg-orange-500"
                                  : "bg-yellow-500"
                              )}
                            >
                              {charge.charge_class}
                            </span>
                            <span className="text-xs text-primary-200">
                              Against: {charge.citizenid}
                            </span>
                            {charge.months > 0 && (
                              <span className="badge badge-outline text-xs">
                                {charge.months} months
                              </span>
                            )}
                            <span className="badge bg-green-500 text-white text-xs">
                              ${charge.fine}
                            </span>
                            {charge.guilty_plea && (
                              <span className="badge bg-green-500 text-white text-xs">
                                Guilty Plea
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            {selectedReport.evidence.length > 0 && (
              <div className="profile-section">
                <h4>Evidence ({selectedReport.evidence.length})</h4>
                <div className="space-y-2">
                  {selectedReport.evidence.map((evidence) => (
                    <div key={evidence.id} className="info-card">
                      <i className="fas fa-fingerprint info-icon"></i>
                      <span className="text-sm font-medium text-white">
                        Evidence #{evidence.evidence_id}
                      </span>
                      {evidence.description && (
                        <span className="text-xs text-primary-200">
                          - {evidence.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-80">
            <span className="text-primary-200">Report not found</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
