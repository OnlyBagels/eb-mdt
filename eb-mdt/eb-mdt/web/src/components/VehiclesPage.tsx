import React, { useState, useEffect, useCallback } from "react";
import { fetchNui } from "../utils/fetchNui";
import { classNames } from "../utils/misc";

// Types (keeping the same as original)
interface Vehicle {
  id: number;
  plate: string;
  model: string;
  owner: string;
  citizenid: string;
  state: number;
  inGarage: boolean;
  isJobVehicle: boolean;
  isGangVehicle: boolean;
  flags?: VehicleFlag[];
}

interface VehicleFlag {
  id: number;
  vehicle_id: number;
  flag_type: string;
  description: string;
  reported_by: string;
  created_at: string;
  is_active?: boolean;
  priority?: string;
}

interface DetailedVehicle extends Vehicle {
  fakePlate?: string;
  modelHash: string;
  ownerPhone: string;
  ownerBirthdate: string;
  ownerGender: string;
  garage: string;
  fuel: number;
  engine: number;
  body: number;
  depotPrice: number;
  drivingDistance: number;
  status: string;
  jobVehicleRank: number;
  gangVehicleRank: number;
  mods: Record<string, any>;
  damage: Record<string, any>;
  glovebox: any[];
  trunk: any[];
  flags: VehicleFlag[];
}

interface VehiclesPageProps {
  onViewProfile?: (citizenid: string) => void;
  navigationData?: any;
}

const VehiclesPage: React.FC<VehiclesPageProps> = ({
  onViewProfile,
  navigationData,
}) => {
  // View state - either 'list' or 'detail'
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  const [searchQuery, setSearchQuery] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] =
    useState<DetailedVehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // BOLO Management State
  const [boloModalOpen, setBoloModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<VehicleFlag | null>(null);
  const [boloForm, setBoloForm] = useState({
    flagType: "bolo",
    description: "",
    priority: "medium",
  });

  // Handle navigation data for plate search from dashboard
  useEffect(() => {
    if (navigationData && navigationData.searchQuery) {
      setSearchQuery(navigationData.searchQuery);
      handleSearchWithQuery(navigationData.searchQuery);
    }
  }, [navigationData]);

  const handleSearchWithQuery = async (query: string) => {
    if (!query.trim()) {
      setVehicles([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await fetchNui<Vehicle[]>("searchVehicles", {
        query: query,
      });
      setVehicles(results || []);
    } catch (error) {
      console.error("Error searching vehicles:", error);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setVehicles([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await fetchNui<Vehicle[]>("searchVehicles", {
        query: searchQuery,
      });
      setVehicles(results || []);
    } catch (error) {
      console.error("Error searching vehicles:", error);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const viewVehicle = async (vehicleId: number) => {
    setVehicleLoading(true);
    setViewMode("detail");
    try {
      const vehicle = await fetchNui<DetailedVehicle>("getVehicle", {
        vehicleId,
      });
      if (vehicle) {
        setSelectedVehicle(vehicle);
      }
    } catch (error) {
      console.error("Error loading vehicle:", error);
    } finally {
      setVehicleLoading(false);
    }
  };

  const handleViewProfile = (citizenid: string) => {
    if (onViewProfile) {
      onViewProfile(citizenid);
    }
  };

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedVehicle(null);
  }, []);

  const getVehicleStatus = (vehicle: DetailedVehicle | Vehicle) => {
    if (vehicle.flags && vehicle.flags.length > 0) {
      const stolenFlag = vehicle.flags.find(
        (f) => f.flag_type === "stolen" && f.is_active !== false
      );
      if (stolenFlag) return { text: "STOLEN", color: "bg-red-500" };

      const warrantFlag = vehicle.flags.find(
        (f) => f.flag_type === "warrant" && f.is_active !== false
      );
      if (warrantFlag) return { text: "WARRANT", color: "bg-orange-500" };

      const boloFlag = vehicle.flags.find(
        (f) =>
          (f.flag_type === "bolo" || f.flag_type === "wanted") &&
          f.is_active !== false
      );
      if (boloFlag) return { text: "BOLO", color: "bg-yellow-500" };

      const suspiciousFlag = vehicle.flags.find(
        (f) => f.flag_type === "suspicious" && f.is_active !== false
      );
      if (suspiciousFlag) return { text: "SUSPICIOUS", color: "bg-blue-500" };
    }

    return { text: "CLEAN", color: "bg-green-500" };
  };

  const getFlagColor = (flagType: string) => {
    switch (flagType) {
      case "stolen":
        return "#ef4444";
      case "warrant":
        return "#f97316";
      case "bolo":
      case "wanted":
        return "#eab308";
      case "suspicious":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // BOLO Management Functions
  const openBoloModal = (flag?: VehicleFlag) => {
    if (flag) {
      setEditingFlag(flag);
      setBoloForm({
        flagType: flag.flag_type,
        description: flag.description,
        priority: flag.priority || "medium",
      });
    } else {
      setEditingFlag(null);
      setBoloForm({
        flagType: "bolo",
        description: "",
        priority: "medium",
      });
    }
    setBoloModalOpen(true);
  };

  const closeBoloModal = () => {
    setBoloModalOpen(false);
    setEditingFlag(null);
    setBoloForm({
      flagType: "bolo",
      description: "",
      priority: "medium",
    });
  };

  const handleBoloSubmit = async () => {
    if (!selectedVehicle || !boloForm.description.trim()) return;

    try {
      if (editingFlag) {
        await fetchNui("updateVehicleBolo", {
          vehicleId: selectedVehicle.id,
          flagId: editingFlag.id,
          description: boloForm.description,
          priority: boloForm.priority,
        });
      } else {
        await fetchNui("addVehicleBolo", {
          vehicleId: selectedVehicle.id,
          flagType: boloForm.flagType,
          description: boloForm.description,
          priority: boloForm.priority,
        });
      }

      await viewVehicle(selectedVehicle.id);
      closeBoloModal();
    } catch (error) {
      console.error("Error managing BOLO:", error);
    }
  };

  const handleRemoveFlag = async (flag: VehicleFlag) => {
    if (!selectedVehicle) return;

    try {
      await fetchNui("removeVehicleBolo", {
        vehicleId: selectedVehicle.id,
        flagId: flag.id,
        reason: "Removed via MDT",
      });

      await viewVehicle(selectedVehicle.id);
    } catch (error) {
      console.error("Error removing flag:", error);
    }
  };

  if (viewMode === "detail") {
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
                  <i className="fas fa-car"></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Vehicle Details
                  </h2>
                  <p className="text-sm text-primary-200">
                    {selectedVehicle?.plate || "Unknown"}
                  </p>
                </div>
              </div>
            </div>
            <button
              className="mdt-button mdt-button-primary flex items-center gap-2"
              onClick={() => openBoloModal()}
            >
              <i className="fas fa-flag"></i>
              Add BOLO
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mdt-card flex-1 overflow-hidden">
          {vehicleLoading ? (
            <div className="flex items-center justify-center h-80">
              <div className="loading-spinner"></div>
            </div>
          ) : selectedVehicle ? (
            <div className="p-6 h-full overflow-auto custom-scrollbar space-y-6">
              {/* Vehicle Status Alert */}
              {(() => {
                const status = getVehicleStatus(selectedVehicle);
                return (
                  <div
                    className="p-4 rounded-lg border-l-4"
                    style={{
                      borderLeftColor:
                        status.color.replace("bg-", "") === "red-500"
                          ? "#ef4444"
                          : status.color.replace("bg-", "") === "orange-500"
                          ? "#f97316"
                          : status.color.replace("bg-", "") === "yellow-500"
                          ? "#eab308"
                          : status.color.replace("bg-", "") === "blue-500"
                          ? "#3b82f6"
                          : "#22c55e",
                      backgroundColor: "rgba(55, 65, 81, 0.5)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        BOLO Status:
                      </span>
                      <span
                        className={classNames("badge text-white", status.color)}
                      >
                        {status.text}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Basic Vehicle Info */}
              <div className="profile-section">
                <h4>Vehicle Details</h4>
                <div className="space-y-3">
                  <div className="profile-row">
                    <span className="profile-label">License Plate</span>
                    <span className="badge badge-outline">
                      {selectedVehicle.plate}
                    </span>
                  </div>
                  {selectedVehicle.fakePlate && (
                    <div className="profile-row">
                      <span className="profile-label">Fake Plate</span>
                      <span className="badge bg-red-500 text-white">
                        {selectedVehicle.fakePlate}
                      </span>
                    </div>
                  )}
                  <div className="profile-row">
                    <span className="profile-label">Model</span>
                    <span className="profile-value">
                      {selectedVehicle.model}
                    </span>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label">Vehicle Type</span>
                    <div className="flex gap-2">
                      {selectedVehicle.isJobVehicle && (
                        <span className="badge bg-blue-500 text-white text-xs">
                          Job Vehicle
                        </span>
                      )}
                      {selectedVehicle.isGangVehicle && (
                        <span className="badge bg-purple-500 text-white text-xs">
                          Gang Vehicle
                        </span>
                      )}
                      {!selectedVehicle.isJobVehicle &&
                        !selectedVehicle.isGangVehicle && (
                          <span className="badge bg-gray-500 text-white text-xs">
                            Personal
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner Info */}
              <div className="profile-section">
                <h4>Registered Owner</h4>
                <div className="space-y-3">
                  <div className="profile-row">
                    <span className="profile-label flex items-center gap-2">
                      <i className="fas fa-user info-icon"></i>
                      Name
                    </span>
                    <button
                      className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                      onClick={() =>
                        handleViewProfile(selectedVehicle.citizenid)
                      }
                    >
                      {selectedVehicle.owner}
                    </button>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label flex items-center gap-2">
                      <i className="fas fa-phone info-icon"></i>
                      Phone
                    </span>
                    <span className="profile-value">
                      {selectedVehicle.ownerPhone}
                    </span>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label flex items-center gap-2">
                      <i className="fas fa-id-card info-icon"></i>
                      Citizen ID
                    </span>
                    <span className="profile-value font-mono">
                      {selectedVehicle.citizenid}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Flags */}
              <div className="profile-section">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-red-400">
                    <i className="fas fa-exclamation-triangle"></i>
                    Active Flags (
                    {selectedVehicle.flags?.filter((f) => f.is_active !== false)
                      .length || 0}
                    )
                  </h4>
                  <button
                    className="mdt-button mdt-button-primary text-xs py-1 px-3 flex items-center gap-2"
                    onClick={() => openBoloModal()}
                  >
                    <i className="fas fa-plus"></i>
                    Add Flag
                  </button>
                </div>

                {selectedVehicle.flags &&
                selectedVehicle.flags.filter((f) => f.is_active !== false)
                  .length > 0 ? (
                  <div className="space-y-3">
                    {selectedVehicle.flags
                      .filter((f) => f.is_active !== false)
                      .map((flag) => (
                        <div
                          key={flag.id}
                          className="p-3 rounded-lg border-l-4 bg-mdt-bg"
                          style={{
                            borderLeftColor: getFlagColor(flag.flag_type),
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="badge text-white text-xs"
                                style={{
                                  backgroundColor: getFlagColor(flag.flag_type),
                                }}
                              >
                                {flag.flag_type.toUpperCase()}
                              </span>
                              {flag.priority && (
                                <span
                                  className={classNames(
                                    "badge text-white text-xs",
                                    flag.priority === "critical"
                                      ? "bg-red-500"
                                      : flag.priority === "high"
                                      ? "bg-orange-500"
                                      : "bg-gray-500"
                                  )}
                                >
                                  {flag.priority.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-primary-200">
                                {formatDate(flag.created_at)}
                              </span>
                              <button
                                className="w-6 h-6 text-primary-200 hover:text-white transition-colors"
                                onClick={() => {
                                  if (confirm("Remove this flag?")) {
                                    handleRemoveFlag(flag);
                                  }
                                }}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          </div>
                          {flag.description && (
                            <p className="text-xs text-primary-200 mb-2">
                              {flag.description}
                            </p>
                          )}
                          <p className="text-xs text-primary-200">
                            Reported by: {flag.reported_by}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-primary-200 text-sm">
                      No active flags on this vehicle
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-80">
              <span className="text-primary-200">Vehicle not found</span>
            </div>
          )}
        </div>

        {/* BOLO Management Modal */}
        {boloModalOpen && (
          <div className="modal-overlay">
            <div className="modal-container max-w-md">
              <div className="modal-header">
                <h2 className="text-lg font-semibold text-white">
                  {editingFlag ? "Edit Vehicle Flag" : "Add Vehicle Flag"}
                </h2>
              </div>

              <div className="modal-content space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Flag Type
                  </label>
                  <select
                    className="mdt-input w-full"
                    value={boloForm.flagType}
                    onChange={(e) =>
                      setBoloForm({ ...boloForm, flagType: e.target.value })
                    }
                    disabled={!!editingFlag}
                  >
                    <option value="bolo">BOLO (Be On Lookout)</option>
                    <option value="wanted">Wanted</option>
                    <option value="stolen">Stolen Vehicle</option>
                    <option value="warrant">Active Warrant</option>
                    <option value="suspicious">Suspicious Activity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Priority
                  </label>
                  <select
                    className="mdt-input w-full"
                    value={boloForm.priority}
                    onChange={(e) =>
                      setBoloForm({ ...boloForm, priority: e.target.value })
                    }
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Description
                  </label>
                  <textarea
                    className="mdt-input w-full h-24 resize-none"
                    placeholder="Enter detailed description of the flag..."
                    value={boloForm.description}
                    onChange={(e) =>
                      setBoloForm({ ...boloForm, description: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="mdt-button mdt-button-secondary"
                  onClick={closeBoloModal}
                >
                  Cancel
                </button>
                <button
                  className={classNames(
                    "mdt-button mdt-button-primary",
                    !boloForm.description.trim()
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  )}
                  onClick={handleBoloSubmit}
                  disabled={!boloForm.description.trim()}
                >
                  {editingFlag ? "Update Flag" : "Add Flag"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
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
              placeholder="Search by plate, model, owner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button
            className="mdt-button mdt-button-primary flex items-center gap-2"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <i className="fas fa-search"></i>
            )}
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="mdt-card flex-1 flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="loading-spinner"></div>
            </div>
          ) : vehicles.length > 0 ? (
            <table className="mdt-table">
              <thead>
                <tr>
                  <th>Plate</th>
                  <th>Model</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => {
                  const status = getVehicleStatus(vehicle);
                  return (
                    <tr key={vehicle.id}>
                      <td>
                        <span className="badge badge-outline">
                          {vehicle.plate}
                        </span>
                      </td>
                      <td className="text-white">{vehicle.model}</td>
                      <td>
                        <button
                          className="text-primary-400 hover:text-primary-300 transition-colors"
                          onClick={() => handleViewProfile(vehicle.citizenid)}
                        >
                          {vehicle.owner}
                        </button>
                      </td>
                      <td>
                        <span
                          className={classNames(
                            "badge text-white",
                            status.color
                          )}
                        >
                          {status.text}
                        </span>
                      </td>
                      <td>
                        <button
                          className="w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors"
                          onClick={() => viewVehicle(vehicle.id)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : hasSearched ? (
            <div className="empty-state h-80">
              <i className="fas fa-car empty-state-icon"></i>
              <h3 className="empty-state-title">No vehicles found</h3>
              <p className="empty-state-description">
                Try adjusting your search criteria
              </p>
            </div>
          ) : (
            <div className="empty-state h-80">
              <i className="fas fa-search empty-state-icon"></i>
              <h3 className="empty-state-title">Search for vehicles</h3>
              <p className="empty-state-description">
                Enter a plate number, model, or owner name to begin
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehiclesPage;
