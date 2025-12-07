import React, { useState, useEffect, useCallback } from "react";
import { fetchNui } from "../utils/fetchNui";
import { classNames } from "../utils/misc";

// Types (keeping the same as original)
interface WeaponRegistration {
  id: number;
  citizen_id: string;
  owner_name?: string;
  weapon_type: string;
  serial_number: string;
  registration_date: string;
  notes: string;
  status: string;
}

interface WeaponRegistryResponse {
  weapons: WeaponRegistration[];
  totalCount: number;
  canManage: boolean;
}

interface CitizenSearchResult {
  citizenid: string;
  name: string;
  phone: string;
}

interface WeaponsPageProps {
  playerInfo?: {
    name: string;
    callsign: string;
    department: string;
    rank: string;
    jobName?: string;
    gradeLevel?: number;
  };
  onViewProfile?: (citizenid: string) => void;
}

const WEAPON_TYPES = [
  { value: "pistol", label: "Pistol" },
  { value: "smg", label: "SMG" },
  { value: "shotgun", label: "Shotgun" },
  { value: "rifle", label: "Rifle" },
  { value: "sniper", label: "Sniper Rifle" },
  { value: "melee", label: "Melee Weapon" },
  { value: "other", label: "Other" },
];

const WEAPON_STATUS = [
  { value: "active", label: "Active", color: "bg-green-500" },
  { value: "expired", label: "Expired", color: "bg-orange-500" },
  { value: "revoked", label: "Revoked", color: "bg-red-500" },
  { value: "stolen", label: "Stolen", color: "bg-red-500" },
  { value: "lost", label: "Lost", color: "bg-yellow-500" },
];

const WeaponsPage: React.FC<WeaponsPageProps> = ({
  playerInfo,
  onViewProfile,
}) => {
  // View state
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  // List view states
  const [weapons, setWeapons] = useState<WeaponRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Detail view states
  const [selectedWeapon, setSelectedWeapon] =
    useState<WeaponRegistration | null>(null);
  const [weaponLoading, setWeaponLoading] = useState(false);

  // Registration form states
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    citizen_id: "",
    owner_name: "",
    weapon_type: "",
    serial_number: "",
    notes: "",
    status: "active",
  });

  // Citizen search modal
  const [citizenSearchModalOpen, setCitizenSearchModalOpen] = useState(false);
  const [citizenSearchQuery, setCitizenSearchQuery] = useState("");
  const [citizenSearchResults, setCitizenSearchResults] = useState<
    CitizenSearchResult[]
  >([]);
  const [citizenSearchLoading, setCitizenSearchLoading] = useState(false);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  // Load weapons only when search changes
  useEffect(() => {
    if (hasSearched) {
      loadWeapons();
    }
  }, [statusFilter]);

  const checkPermissions = async () => {
    try {
      const result = await fetchNui<WeaponRegistryResponse>(
        "getWeaponRegistry",
        {
          search: "",
          status: null,
        }
      );
      if (result) {
        setCanManage(result.canManage);
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const loadWeapons = async () => {
    if (!searchQuery.trim() && !statusFilter) {
      setWeapons([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const result = await fetchNui<WeaponRegistryResponse>(
        "getWeaponRegistry",
        {
          search: searchQuery,
          status: statusFilter,
        }
      );

      if (result) {
        setWeapons(result.weapons || []);
        setCanManage(result.canManage);
      }
    } catch (error) {
      console.error("Error loading weapons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim() && !statusFilter) {
      setWeapons([]);
      setHasSearched(false);
      return;
    }
    loadWeapons();
  };

  const viewWeapon = async (weaponId: number) => {
    setWeaponLoading(true);
    setViewMode("detail");
    try {
      const weapon = await fetchNui<WeaponRegistration>("getWeaponDetails", {
        weaponId,
      });
      if (weapon) {
        setSelectedWeapon(weapon);
      }
    } catch (error) {
      console.error("Error loading weapon details:", error);
    } finally {
      setWeaponLoading(false);
    }
  };

  const openRegistrationForm = (weapon?: WeaponRegistration) => {
    if (weapon) {
      setEditMode(true);
      setFormData({
        citizen_id: weapon.citizen_id,
        owner_name: weapon.owner_name || "",
        weapon_type: weapon.weapon_type,
        serial_number: weapon.serial_number,
        notes: weapon.notes || "",
        status: weapon.status,
      });
    } else {
      setEditMode(false);
      setFormData({
        citizen_id: "",
        owner_name: "",
        weapon_type: "",
        serial_number: "",
        notes: "",
        status: "active",
      });
    }
    setRegistrationModalOpen(true);
  };

  const searchCitizens = async () => {
    if (!citizenSearchQuery.trim()) return;

    setCitizenSearchLoading(true);
    try {
      const results = await fetchNui<CitizenSearchResult[]>(
        "searchCitizensForReport",
        {
          query: citizenSearchQuery,
        }
      );
      setCitizenSearchResults(results || []);
    } catch (error) {
      console.error("Error searching citizens:", error);
    } finally {
      setCitizenSearchLoading(false);
    }
  };

  const selectCitizen = (citizen: CitizenSearchResult) => {
    setFormData({
      ...formData,
      citizen_id: citizen.citizenid,
      owner_name: citizen.name,
    });
    setCitizenSearchModalOpen(false);
    setCitizenSearchQuery("");
    setCitizenSearchResults([]);
  };

  const saveWeaponRegistration = async () => {
    if (
      !formData.weapon_type ||
      !formData.serial_number ||
      !formData.citizen_id
    ) {
      return;
    }

    setLoading(true);
    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        editMode ? "updateWeaponRegistration" : "registerWeapon",
        {
          ...formData,
          weaponId: editMode && selectedWeapon ? selectedWeapon.id : undefined,
        }
      );

      if (result.success) {
        setRegistrationModalOpen(false);
        if (hasSearched) {
          loadWeapons();
        }
        if (viewMode === "detail" && selectedWeapon) {
          viewWeapon(selectedWeapon.id);
        }
      }
    } catch (error) {
      console.error("Error saving weapon registration:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateWeaponStatus = async (weaponId: number, newStatus: string) => {
    try {
      const result = await fetchNui<{ success: boolean }>(
        "updateWeaponStatus",
        {
          weaponId,
          status: newStatus,
        }
      );

      if (result.success) {
        if (hasSearched) {
          loadWeapons();
        }
        if (selectedWeapon && selectedWeapon.id === weaponId) {
          viewWeapon(weaponId);
        }
      }
    } catch (error) {
      console.error("Error updating weapon status:", error);
    }
  };

  const deleteWeaponRegistration = async (weaponId: number) => {
    try {
      const result = await fetchNui<{ success: boolean }>(
        "deleteWeaponRegistration",
        { weaponId }
      );

      if (result.success) {
        setViewMode("list");
        if (hasSearched) {
          loadWeapons();
        }
      }
    } catch (error) {
      console.error("Error deleting weapon registration:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = WEAPON_STATUS.find((s) => s.value === status);
    return (
      <span
        className={classNames(
          "badge text-white text-xs",
          statusConfig?.color || "bg-gray-500"
        )}
      >
        {statusConfig?.label || status}
      </span>
    );
  };

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedWeapon(null);
  }, []);

  // Render detail view
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
                  <i className="fas fa-crosshairs"></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Weapon Registration Details
                  </h2>
                  {selectedWeapon && (
                    <p className="text-sm text-primary-200">
                      Serial: {selectedWeapon.serial_number}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {canManage && selectedWeapon && (
              <div className="flex items-center gap-3">
                <button
                  className="mdt-button mdt-button-secondary flex items-center gap-2"
                  onClick={() => openRegistrationForm(selectedWeapon)}
                >
                  <i className="fas fa-edit"></i>
                  Edit
                </button>
                <button
                  className="mdt-button mdt-button-secondary flex items-center gap-2"
                  onClick={() => {
                    const action = prompt(
                      "Actions:\n1. Mark as Stolen\n2. Mark as Lost\n3. Revoke\n4. Mark as Recovered\n5. Delete\n\nEnter number:"
                    );
                    if (action === "1")
                      updateWeaponStatus(selectedWeapon.id, "stolen");
                    else if (action === "2")
                      updateWeaponStatus(selectedWeapon.id, "lost");
                    else if (action === "3")
                      updateWeaponStatus(selectedWeapon.id, "revoked");
                    else if (action === "4")
                      updateWeaponStatus(selectedWeapon.id, "active");
                    else if (
                      action === "5" &&
                      confirm("Delete this weapon registration?")
                    )
                      deleteWeaponRegistration(selectedWeapon.id);
                  }}
                >
                  Actions
                  <i className="fas fa-ellipsis-v"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mdt-card flex-1 overflow-auto custom-scrollbar">
          {weaponLoading ? (
            <div className="flex items-center justify-center h-80">
              <div className="loading-spinner"></div>
            </div>
          ) : selectedWeapon ? (
            <div className="p-6 space-y-6">
              {/* Status Alert */}
              <div className="p-4 bg-mdt-bg rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    Registration Status:
                  </span>
                  {getStatusBadge(selectedWeapon.status)}
                </div>
              </div>

              {/* Weapon Information */}
              <div className="profile-section">
                <h4>Weapon Information</h4>
                <div className="space-y-3">
                  <div className="profile-row">
                    <span className="profile-label">Serial Number</span>
                    <span className="badge badge-outline">
                      {selectedWeapon.serial_number}
                    </span>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label">Weapon Type</span>
                    <span className="profile-value capitalize">
                      {selectedWeapon.weapon_type}
                    </span>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label">Registration Date</span>
                    <span className="profile-value">
                      {formatDate(selectedWeapon.registration_date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Owner Information */}
              <div className="profile-section">
                <h4>Owner Information</h4>
                <div className="space-y-3">
                  <div className="profile-row">
                    <span className="profile-label flex items-center gap-2">
                      <i className="fas fa-user info-icon"></i>
                      Name
                    </span>
                    {selectedWeapon.owner_name ? (
                      <button
                        className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                        onClick={() =>
                          onViewProfile &&
                          onViewProfile(selectedWeapon.citizen_id)
                        }
                      >
                        {selectedWeapon.owner_name}
                      </button>
                    ) : (
                      <span className="text-sm text-primary-200">Unknown</span>
                    )}
                  </div>
                  <div className="profile-row">
                    <span className="profile-label">Citizen ID</span>
                    <span className="badge badge-outline text-xs">
                      {selectedWeapon.citizen_id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedWeapon.notes && (
                <div className="profile-section">
                  <h4>Notes</h4>
                  <p className="text-sm whitespace-pre-wrap text-white">
                    {selectedWeapon.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-80">
              <span className="text-primary-200">Weapon not found</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render list view
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
              placeholder="Search by serial number, owner name, or citizen ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          {canManage && (
            <button
              className="mdt-button mdt-button-primary flex items-center gap-2"
              onClick={() => openRegistrationForm()}
            >
              <i className="fas fa-plus"></i>
              Register Weapon
            </button>
          )}
          <button
            className="mdt-button mdt-button-primary flex items-center gap-2"
            onClick={handleSearch}
          >
            <i className="fas fa-search"></i>
            Search
          </button>
          <button
            className="mdt-button mdt-button-secondary"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter(null);
              setWeapons([]);
              setHasSearched(false);
            }}
          >
            <i className="fas fa-redo"></i>
          </button>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <select
            className="mdt-input"
            value={statusFilter || ""}
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">All Status</option>
            {WEAPON_STATUS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weapons Table */}
      <div className="mdt-card flex-1 flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-80">
              <div className="loading-spinner"></div>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center h-80">
              <i className="fas fa-search text-6xl text-primary-400 mb-4"></i>
              <h3 className="text-lg font-medium text-white mb-2">
                Search for vehicles
              </h3>
              <p className="text-sm text-primary-200 text-center max-w-md">
                Enter a serial number, owner name, or select a status filter to
                begin
              </p>
            </div>
          ) : weapons.length > 0 ? (
            <table className="mdt-table">
              <thead>
                <tr>
                  <th>Serial Number</th>
                  <th>Weapon Type</th>
                  <th>Owner</th>
                  <th>Registration Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {weapons.map((weapon) => (
                  <tr key={weapon.id}>
                    <td>
                      <span className="badge badge-outline text-xs">
                        {weapon.serial_number}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium capitalize text-white">
                        {weapon.weapon_type}
                      </span>
                    </td>
                    <td>
                      {weapon.owner_name ? (
                        <button
                          className="text-primary-400 hover:text-primary-300 transition-colors"
                          onClick={() =>
                            onViewProfile && onViewProfile(weapon.citizen_id)
                          }
                        >
                          {weapon.owner_name}
                        </button>
                      ) : (
                        <span className="text-sm text-primary-200">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="text-sm text-white">
                        {formatDate(weapon.registration_date)}
                      </span>
                    </td>
                    <td>{getStatusBadge(weapon.status)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors"
                          onClick={() => viewWeapon(weapon.id)}
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        {canManage && (
                          <button
                            className="w-8 h-8 bg-mdt-accent hover:bg-gray-600 rounded text-white transition-colors"
                            onClick={() => {
                              const action = prompt(
                                "Actions:\n1. Edit\n2. Mark as Stolen\n3. Mark as Lost\n4. Revoke\n5. Delete\n\nEnter number:"
                              );
                              if (action === "1") openRegistrationForm(weapon);
                              else if (action === "2")
                                updateWeaponStatus(weapon.id, "stolen");
                              else if (action === "3")
                                updateWeaponStatus(weapon.id, "lost");
                              else if (action === "4")
                                updateWeaponStatus(weapon.id, "revoked");
                              else if (
                                action === "5" &&
                                confirm("Delete this weapon registration?")
                              )
                                deleteWeaponRegistration(weapon.id);
                            }}
                          >
                            <i className="fas fa-ellipsis-v"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-80">
              <i className="fas fa-crosshairs text-6xl text-primary-400 mb-4"></i>
              <h3 className="text-lg font-medium text-white mb-2">
                No weapon registrations found
              </h3>
              <p className="text-sm text-primary-200 text-center max-w-md">
                Try searching with different criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {registrationModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">
                {editMode ? "Edit Weapon Registration" : "Register New Weapon"}
              </h2>
            </div>

            <div className="modal-content space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Owner
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="mdt-input flex-1"
                    placeholder="Search for citizen..."
                    value={formData.owner_name}
                    readOnly
                  />
                  <button
                    className="w-10 h-10 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors"
                    onClick={() => setCitizenSearchModalOpen(true)}
                  >
                    <i className="fas fa-search"></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Weapon Type
                </label>
                <select
                  className="mdt-input w-full"
                  value={formData.weapon_type}
                  onChange={(e) =>
                    setFormData({ ...formData, weapon_type: e.target.value })
                  }
                >
                  <option value="">Select weapon type</option>
                  {WEAPON_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Serial Number
                </label>
                <input
                  type="text"
                  className="mdt-input w-full"
                  placeholder="Enter serial number"
                  value={formData.serial_number}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number: e.target.value })
                  }
                  disabled={editMode}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Status
                </label>
                <select
                  className="mdt-input w-full"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  {WEAPON_STATUS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Notes
                </label>
                <textarea
                  className="mdt-input w-full h-20 resize-none"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="mdt-button mdt-button-secondary"
                onClick={() => setRegistrationModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={classNames(
                  "mdt-button mdt-button-primary flex items-center gap-2",
                  loading ? "opacity-50 cursor-not-allowed" : ""
                )}
                onClick={saveWeaponRegistration}
                disabled={loading}
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {editMode ? "Update" : "Register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Search Modal */}
      {citizenSearchModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-sm">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">
                Search Citizen
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
                      onClick={() => selectCitizen(citizen)}
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
};

export default WeaponsPage;
