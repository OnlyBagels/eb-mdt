import React, { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCrosshairs,
  faSearch,
  faSpinner,
  faChevronLeft,
  faPlus,
  faEdit,
  faUser,
  faEllipsisV,
  faRedo,
} from "@fortawesome/free-solid-svg-icons";
import { fetchNui } from "../../utils/fetchNui";

// Types
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
  { value: "active", label: "Active", color: "bg-green-500/20 text-green-300" },
  {
    value: "expired",
    label: "Expired",
    color: "bg-orange-500/20 text-orange-300",
  },
  { value: "revoked", label: "Revoked", color: "bg-red-500/20 text-red-300" },
  { value: "stolen", label: "Stolen", color: "bg-red-500/20 text-red-300" },
  { value: "lost", label: "Lost", color: "bg-yellow-500/20 text-yellow-300" },
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
        className={`text-xs px-2 py-1 rounded ${
          statusConfig?.color || "bg-gray-500/20 text-gray-300"
        }`}
      >
        {statusConfig?.label || status}
      </span>
    );
  };

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedWeapon(null);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Render detail view
  if (viewMode === "detail") {
    return (
      <div className="p-6 h-full flex flex-col">
        {/* Header */}
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
                Weapon Registration Details
              </h1>
              {selectedWeapon && (
                <p className="text-sm text-white/60 mt-1">
                  Serial: {selectedWeapon.serial_number}
                </p>
              )}
            </div>
          </div>
          {canManage && selectedWeapon && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => openRegistrationForm(selectedWeapon)}
                className="px-4 py-2 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 flex items-center gap-2 transition-colors"
              >
                <FontAwesomeIcon icon={faEdit} />
                Edit
              </button>
              <button
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
                    window.confirm("Delete this weapon registration?")
                  )
                    deleteWeaponRegistration(selectedWeapon.id);
                }}
                className="px-4 py-2 rounded-lg bg-card/90 text-white/80 hover:bg-card flex items-center gap-2 transition-colors border border-border/50"
              >
                Actions
                <FontAwesomeIcon icon={faEllipsisV} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 bg-card/90 rounded-lg border border-border/50 overflow-hidden">
          {weaponLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/50">Loading weapon...</div>
            </div>
          ) : selectedWeapon ? (
            <div className="p-6 h-full overflow-y-auto space-y-6">
              {/* Status Alert */}
              <div className="p-4 bg-background/50 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white/90">
                    Registration Status:
                  </span>
                  {getStatusBadge(selectedWeapon.status)}
                </div>
              </div>

              {/* Weapon Information */}
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <h4 className="text-sm font-medium mb-3 text-white/90">
                  Weapon Information
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60">Serial Number</span>
                    <span className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                      {selectedWeapon.serial_number}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60">Weapon Type</span>
                    <span className="text-sm text-white/90 capitalize">
                      {selectedWeapon.weapon_type}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-white/60">
                      Registration Date
                    </span>
                    <span className="text-sm text-white/90">
                      {formatDate(selectedWeapon.registration_date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Owner Information */}
              <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                <h4 className="text-sm font-medium mb-3 text-white/90">
                  Owner Information
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border/30">
                    <span className="text-sm text-white/60 flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faUser}
                        className="text-blue-400"
                      />
                      Name
                    </span>
                    {selectedWeapon.owner_name ? (
                      onViewProfile ? (
                        <button
                          className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                          onClick={() =>
                            onViewProfile(selectedWeapon.citizen_id)
                          }
                        >
                          {selectedWeapon.owner_name}
                        </button>
                      ) : (
                        <span className="text-sm text-white/90">
                          {selectedWeapon.owner_name}
                        </span>
                      )
                    ) : (
                      <span className="text-sm text-white/40">Unknown</span>
                    )}
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-white/60">Citizen ID</span>
                    <span className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                      {selectedWeapon.citizen_id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedWeapon.notes && (
                <div className="bg-background/50 p-4 rounded-lg border border-border/50">
                  <h4 className="text-sm font-medium mb-3 text-white/90">
                    Notes
                  </h4>
                  <p className="text-sm whitespace-pre-wrap text-white/80">
                    {selectedWeapon.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-white/40">Weapon not found</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render list view
  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white/90">Firearm Registry</h1>
        <p className="text-sm text-white/60 mt-1">
          Search and manage registered firearms
        </p>
      </div>

      {/* Search Section */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
            />
            <input
              type="text"
              placeholder="Search by serial number, owner name, or citizen ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-4 py-3 w-full rounded-lg border border-transparent bg-card/90 text-white/90 placeholder-white/50 focus:outline-none focus:border-blue-500/90 hover:border-blue-500/90"
            />
          </div>
          {canManage && (
            <button
              onClick={() => openRegistrationForm()}
              className="px-4 py-3 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faPlus} />
              Register Weapon
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-3 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            ) : (
              <FontAwesomeIcon icon={faSearch} />
            )}
            Search
          </button>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter(null);
              setWeapons([]);
              setHasSearched(false);
            }}
            className="px-4 py-3 rounded-lg bg-card/90 text-white/80 hover:bg-card flex items-center gap-2 transition-colors border border-border/50"
          >
            <FontAwesomeIcon icon={faRedo} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <select
            className="px-3 py-2 rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80 hover:border-blue-500/80"
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
      <div className="flex-1 bg-card/90 rounded-lg border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/50">Loading weapons...</div>
            </div>
          ) : !hasSearched ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50 p-8">
              <FontAwesomeIcon icon={faSearch} className="text-6xl mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Search for Firearms
              </h3>
              <p className="text-sm text-white/40 text-center max-w-md">
                Enter a serial number, owner name, or select a status filter to
                begin
              </p>
            </div>
          ) : weapons.length > 0 ? (
            <table className="w-full">
              <thead className="bg-background/50 sticky top-0">
                <tr className="border-b border-border/50">
                  <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                    Serial Number
                  </th>
                  <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                    Weapon Type
                  </th>
                  <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                    Owner
                  </th>
                  <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                    Registration Date
                  </th>
                  <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-white/70 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {weapons.map((weapon) => (
                  <tr
                    key={weapon.id}
                    className="border-b border-border/30 hover:bg-background/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                        {weapon.serial_number}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium capitalize text-white/90">
                        {weapon.weapon_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {weapon.owner_name ? (
                        onViewProfile ? (
                          <button
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={() => onViewProfile(weapon.citizen_id)}
                          >
                            {weapon.owner_name}
                          </button>
                        ) : (
                          <span className="text-sm text-white/90">
                            {weapon.owner_name}
                          </span>
                        )
                      ) : (
                        <span className="text-sm text-white/40">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-white/80">
                        {formatDate(weapon.registration_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(weapon.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewWeapon(weapon.id)}
                          className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors text-xs"
                        >
                          <FontAwesomeIcon
                            icon={faCrosshairs}
                            className="mr-1"
                          />
                          View
                        </button>
                        {canManage && (
                          <button
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
                                window.confirm(
                                  "Delete this weapon registration?"
                                )
                              )
                                deleteWeaponRegistration(weapon.id);
                            }}
                            className="px-3 py-1 rounded-lg bg-card/90 text-white/80 hover:bg-card transition-colors text-xs border border-border/50"
                          >
                            <FontAwesomeIcon icon={faEllipsisV} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/50 p-8">
              <FontAwesomeIcon icon={faCrosshairs} className="text-6xl mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No Weapon Registrations Found
              </h3>
              <p className="text-sm text-white/40 text-center max-w-md">
                Try searching with different criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Registration Modal */}
      {registrationModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setRegistrationModalOpen(false)}
        >
          <div
            className="bg-background/95 rounded-xl border border-border/50 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold text-white/90">
                {editMode ? "Edit Weapon Registration" : "Register New Weapon"}
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white/90">
                  Owner
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="px-3 py-2 flex-1 rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
                    placeholder="Search for citizen..."
                    value={formData.owner_name}
                    readOnly
                  />
                  <button
                    className="px-4 py-2 bg-blue-600/50 hover:bg-blue-600/70 rounded-lg text-white transition-colors"
                    onClick={() => setCitizenSearchModalOpen(true)}
                  >
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white/90">
                  Weapon Type
                </label>
                <select
                  className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80"
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
                <label className="block text-sm font-medium mb-2 text-white/90">
                  Serial Number
                </label>
                <input
                  type="text"
                  className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
                  placeholder="Enter serial number"
                  value={formData.serial_number}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number: e.target.value })
                  }
                  disabled={editMode}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white/90">
                  Status
                </label>
                <select
                  className="px-3 py-2 w-full rounded-lg bg-card/90 text-white/90 focus:outline-none border border-transparent focus:border-blue-500/80"
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
                <label className="block text-sm font-medium mb-2 text-white/90">
                  Notes
                </label>
                <textarea
                  className="px-3 py-2 w-full h-20 resize-none rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="p-4 border-t border-border/50 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg text-white/70 hover:bg-card/50 transition-colors"
                onClick={() => setRegistrationModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 transition-colors flex items-center gap-2 ${
                  loading ||
                  !formData.weapon_type ||
                  !formData.serial_number ||
                  !formData.citizen_id
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
                onClick={saveWeaponRegistration}
                disabled={
                  loading ||
                  !formData.weapon_type ||
                  !formData.serial_number ||
                  !formData.citizen_id
                }
              >
                {loading && (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                )}
                {editMode ? "Update" : "Register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Search Modal */}
      {citizenSearchModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setCitizenSearchModalOpen(false);
            setCitizenSearchQuery("");
            setCitizenSearchResults([]);
          }}
        >
          <div
            className="bg-background/95 rounded-xl border border-border/50 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold text-white/90">
                Search Citizen
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div className="relative">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
                />
                <input
                  type="text"
                  className="pl-10 pr-4 py-2 w-full rounded-lg bg-card/90 text-white/90 placeholder-white/50 focus:outline-none border border-transparent focus:border-blue-500/80"
                  placeholder="Search by name or Citizen ID..."
                  value={citizenSearchQuery}
                  onChange={(e) => setCitizenSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && searchCitizens()}
                />
              </div>
              <button
                className={`px-4 py-2 w-full rounded-lg bg-blue-600/50 text-blue-300/90 hover:bg-blue-600/70 flex items-center justify-center gap-2 transition-colors ${
                  citizenSearchLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={searchCitizens}
                disabled={citizenSearchLoading}
              >
                {citizenSearchLoading && (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                )}
                Search
              </button>

              {citizenSearchResults.length > 0 && (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {citizenSearchResults.map((citizen) => (
                    <div
                      key={citizen.citizenid}
                      className="p-3 bg-card/50 rounded cursor-pointer transition-all duration-150 hover:bg-card border border-border/30 hover:border-blue-500/50"
                      onClick={() => selectCitizen(citizen)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white/90">
                            {citizen.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                              {citizen.citizenid}
                            </span>
                            <span className="text-xs text-white/60">
                              Phone: {citizen.phone}
                            </span>
                          </div>
                        </div>
                        <FontAwesomeIcon
                          icon={faPlus}
                          className="text-white/40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border/50 flex justify-end">
              <button
                className="px-4 py-2 rounded-lg text-white/70 hover:bg-card/50 transition-colors"
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
