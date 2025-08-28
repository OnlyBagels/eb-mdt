import React, { useState, useEffect } from "react";
import { fetchNui } from "../utils/fetchNui";
import { classNames } from "../utils/misc";

interface BOLO {
  id: number;
  plate: string;
  reason: string;
  officer_name: string;
  officer_identifier: string;
  created_at: string;
  updated_at: string;
  is_active: number;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  notes: string;
}

interface BOLOFormData {
  plate: string;
  reason: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  notes: string;
}

const BOLOPage: React.FC = () => {
  const [bolos, setBOLOs] = useState<BOLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBOLO, setSelectedBOLO] = useState<BOLO | null>(null);
  const [formData, setFormData] = useState<BOLOFormData>({
    plate: "",
    reason: "",
    priority: "MEDIUM",
    notes: "",
  });
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    loadBOLOs();
  }, []);

  const loadBOLOs = async () => {
    setLoading(true);
    try {
      const result = await fetchNui<BOLO[]>("getActiveBolos", {});
      setBOLOs(result || []);
    } catch (error) {
      console.error("Error loading BOLOs:", error);
      setBOLOs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBOLO = async () => {
    if (!formData.plate.trim() || !formData.reason.trim()) {
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        "createBolo",
        formData
      );
      if (result.success) {
        setModalOpen(false);
        setFormData({ plate: "", reason: "", priority: "MEDIUM", notes: "" });
        loadBOLOs();
      }
    } catch (error) {
      console.error("Error creating BOLO:", error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditBOLO = async () => {
    if (!selectedBOLO || !formData.reason.trim()) {
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        "updateBolo",
        {
          id: selectedBOLO.id,
          reason: formData.reason,
          priority: formData.priority,
          notes: formData.notes,
        }
      );
      if (result.success) {
        setEditModalOpen(false);
        setSelectedBOLO(null);
        setFormData({ plate: "", reason: "", priority: "MEDIUM", notes: "" });
        loadBOLOs();
      }
    } catch (error) {
      console.error("Error updating BOLO:", error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeactivateBOLO = async (boloId: number) => {
    if (!window.confirm("Are you sure you want to deactivate this BOLO?")) {
      return;
    }

    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        "deactivateBolo",
        { id: boloId }
      );
      if (result.success) {
        loadBOLOs();
      }
    } catch (error) {
      console.error("Error deactivating BOLO:", error);
    }
  };

  const openEditModal = (bolo: BOLO) => {
    setSelectedBOLO(bolo);
    setFormData({
      plate: bolo.plate,
      reason: bolo.reason,
      priority: bolo.priority,
      notes: bolo.notes,
    });
    setEditModalOpen(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "badge-danger";
      case "HIGH":
        return "badge-warning";
      case "MEDIUM":
        return "bg-yellow-500 text-black";
      case "LOW":
        return "badge-secondary";
      default:
        return "badge-secondary";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "fas fa-exclamation-triangle";
      case "HIGH":
        return "fas fa-exclamation-circle";
      case "MEDIUM":
        return "fas fa-exclamation";
      case "LOW":
        return "fas fa-info-circle";
      default:
        return "fas fa-info";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mdt-card mb-4">
        <div className="p-4 border-b border-mdt-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white">
                <i className="fas fa-search"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  BOLO Management
                </h2>
                <p className="text-sm text-primary-200">
                  Manage active Be On The Lookout alerts
                </p>
              </div>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="mdt-button mdt-button-primary flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              <span>Create BOLO</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="info-card">
              <div className="p-2 bg-red-500 rounded-lg">
                <i className="fas fa-exclamation-triangle text-white"></i>
              </div>
              <div>
                <p className="info-label">Critical</p>
                <p className="info-value text-lg font-bold">
                  {bolos.filter((b) => b.priority === "CRITICAL").length}
                </p>
              </div>
            </div>
            <div className="info-card">
              <div className="p-2 bg-orange-500 rounded-lg">
                <i className="fas fa-exclamation-circle text-white"></i>
              </div>
              <div>
                <p className="info-label">High</p>
                <p className="info-value text-lg font-bold">
                  {bolos.filter((b) => b.priority === "HIGH").length}
                </p>
              </div>
            </div>
            <div className="info-card">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <i className="fas fa-exclamation text-white"></i>
              </div>
              <div>
                <p className="info-label">Medium</p>
                <p className="info-value text-lg font-bold">
                  {bolos.filter((b) => b.priority === "MEDIUM").length}
                </p>
              </div>
            </div>
            <div className="info-card">
              <div className="p-2 bg-primary-600 rounded-lg">
                <i className="fas fa-list text-white"></i>
              </div>
              <div>
                <p className="info-label">Total Active</p>
                <p className="info-value text-lg font-bold">{bolos.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOLO List */}
      <div className="mdt-card flex-1 flex flex-col">
        <div className="p-4 border-b border-mdt-border">
          <div className="flex items-center gap-2">
            <i className="fas fa-list text-primary-400"></i>
            <h3 className="text-sm font-semibold text-white">
              Active BOLOs ({bolos.length})
            </h3>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="loading-spinner"></div>
            </div>
          ) : bolos.length === 0 ? (
            <div className="empty-state h-80">
              <i className="empty-state-icon fas fa-search"></i>
              <h3 className="empty-state-title">No Active BOLOs</h3>
              <p className="empty-state-description">
                All clear for now. Create a new BOLO to get started.
              </p>
            </div>
          ) : (
            <table className="mdt-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Plate</th>
                  <th>Reason</th>
                  <th>Officer</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bolos.map((bolo) => (
                  <tr key={bolo.id}>
                    <td>
                      <span
                        className={`badge ${getPriorityColor(
                          bolo.priority
                        )} flex items-center w-fit`}
                      >
                        <i
                          className={`${getPriorityIcon(bolo.priority)} mr-1`}
                        ></i>
                        {bolo.priority}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-primary-400 bg-mdt-accent px-2 py-1 rounded">
                        {bolo.plate}
                      </span>
                    </td>
                    <td>
                      <div className="max-w-xs">
                        <p className="line-clamp-2 text-white">{bolo.reason}</p>
                        {bolo.notes && (
                          <p className="text-xs text-primary-200 mt-1 line-clamp-1">
                            Notes: {bolo.notes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-white">{bolo.officer_name}</span>
                    </td>
                    <td>
                      <span className="text-primary-200 text-sm">
                        {formatDate(bolo.created_at)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(bolo)}
                          className="mdt-button mdt-button-secondary text-xs px-3 py-1"
                          title="Edit BOLO"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDeactivateBOLO(bolo.id)}
                          className="mdt-button bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1"
                          title="Deactivate BOLO"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create BOLO Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Create New BOLO
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-primary-200 hover:text-white transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Plate Number *
                  </label>
                  <input
                    type="text"
                    value={formData.plate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        plate: e.target.value.toUpperCase(),
                      })
                    }
                    className="mdt-input w-full"
                    placeholder="Enter plate number"
                    maxLength={8}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as any,
                      })
                    }
                    className="mdt-input w-full"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Reason *
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="mdt-input w-full"
                    placeholder="Describe the reason for this BOLO"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="mdt-input w-full"
                    placeholder="Additional notes or details"
                    rows={2}
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setModalOpen(false)}
                className="mdt-button mdt-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBOLO}
                disabled={
                  submitLoading ||
                  !formData.plate.trim() ||
                  !formData.reason.trim()
                }
                className={classNames(
                  "mdt-button mdt-button-primary",
                  submitLoading ||
                    !formData.plate.trim() ||
                    !formData.reason.trim()
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                )}
              >
                {submitLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </div>
                ) : (
                  "Create BOLO"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit BOLO Modal */}
      {editModalOpen && selectedBOLO && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Edit BOLO - {selectedBOLO.plate}
                </h3>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="text-primary-200 hover:text-white transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    value={formData.plate}
                    disabled
                    className="mdt-input w-full opacity-50 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as any,
                      })
                    }
                    className="mdt-input w-full"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Reason *
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="mdt-input w-full"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="mdt-input w-full"
                    rows={2}
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setEditModalOpen(false)}
                className="mdt-button mdt-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleEditBOLO}
                disabled={submitLoading || !formData.reason.trim()}
                className={classNames(
                  "mdt-button mdt-button-primary",
                  submitLoading || !formData.reason.trim()
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                )}
              >
                {submitLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </div>
                ) : (
                  "Update BOLO"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BOLOPage;
