import React, { useState, useEffect, useCallback } from "react";
import { fetchNui } from "../utils/fetchNui";
import { classNames } from "../utils/misc";

// Types
interface Profile {
  id: number;
  citizenid: string;
  firstname: string;
  lastname: string;
  birthdate: string;
  gender: string;
  nationality: string;
  phone: string;
  job: string;
  jobGrade: string;
  gangTags?: string | null;
}

interface DetailedProfile extends Profile {
  fingerprint: string;
  bloodType: string;
  blood: string;
  jobDuty: boolean;
  jobs: Array<{
    name: string;
    label: string;
    grade: number;
    gradeName: string;
    payment: number;
    isboss: boolean;
  }>;
  licenses: Record<string, boolean>;
  vehicles: Array<{
    id: number;
    plate: string;
    vehicle: string;
    garage: string;
    state: number;
  }>;
  properties: Array<{
    id: number;
    label: string;
    price: number;
    type: string;
  }>;
  criminalRecord: {
    arrests: number;
    citations: number;
    warrants: number;
  };
  photoUrl?: string;
  notes?: string;
  registeredWeapons?: Array<{
    id: number;
    weapon_type: string;
    serial_number: string;
    registration_date: string;
    status: string;
  }>;
  canManageLicenses?: boolean;
}

interface GangTag {
  id: number;
  name: string;
  color: string;
}

interface CitizenGang {
  id: number;
  gang_id: number;
  gang_name: string;
  gang_color: string;
  tagged_by: string;
  tagged_at: string;
  notes: string;
}

interface ProfilesPageProps {
  playerInfo?: {
    name: string;
    callsign: string;
    department: string;
    rank: string;
    jobName?: string;
    gradeLevel?: number;
  };
  navigationData?: {
    citizenid?: string;
  };
}

// License configuration
const LICENSE_CONFIG = [
  { value: "id", label: "ID Card", icon: "fas fa-id-card" },
  { value: "driver", label: "Driver's License", icon: "fas fa-credit-card" },
  { value: "weapon", label: "Weapon License", icon: "fas fa-crosshairs" },
  { value: "pilot", label: "Pilot License", icon: "fas fa-plane" },
  { value: "hunting", label: "Hunting License", icon: "fas fa-tree" },
  { value: "fishing", label: "Fishing License", icon: "fas fa-fish" },
];

const ProfilesPage: React.FC<ProfilesPageProps> = ({
  playerInfo,
  navigationData,
}) => {
  // View state - either 'list' or 'detail'
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  // Search and listing states
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Detail view states
  const [selectedProfile, setSelectedProfile] =
    useState<DetailedProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  // Gang management states
  const [gangTags, setGangTags] = useState<GangTag[]>([]);
  const [citizenGangs, setCitizenGangs] = useState<CitizenGang[]>([]);
  const [selectedGangTag, setSelectedGangTag] = useState<string | null>(null);
  const [gangNotes, setGangNotes] = useState("");
  const [addingGang, setAddingGang] = useState(false);

  // License management
  const [canManageLicenses, setCanManageLicenses] = useState(false);

  // Photos and Notes states
  const [profilePhoto, setProfilePhoto] = useState<string>("");
  const [profileNotes, setProfileNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  // License toggle state
  const [togglingLicense, setTogglingLicense] = useState<string | null>(null);

  // Check license management permissions
  useEffect(() => {
    if (!playerInfo) return;

    const requiredRanks: Record<string, number> = {
      lspd: 10,
      bcso: 10,
      usms: 1,
    };

    const jobName = playerInfo.jobName?.toLowerCase() || "";
    const gradeLevel = playerInfo.gradeLevel || 0;

    const hasPermission =
      requiredRanks[jobName] !== undefined &&
      gradeLevel >= requiredRanks[jobName];

    setCanManageLicenses(hasPermission);
  }, [playerInfo]);

  // Initial load
  useEffect(() => {
    loadGangTags();

    if (navigationData?.citizenid) {
      viewProfile(navigationData.citizenid);
    }
  }, [navigationData]);

  // Data loading functions
  const loadGangTags = async () => {
    try {
      const tags = await fetchNui<GangTag[]>("getGangTags", {});
      setGangTags(tags || []);
    } catch (error) {
      console.error("Error loading gang tags:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setProfiles([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await fetchNui<Profile[]>("searchProfiles", {
        query: searchQuery,
      });
      setProfiles(results || []);
    } catch (error) {
      console.error("Error searching profiles:", error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const viewProfile = async (citizenid: string) => {
    setProfileLoading(true);
    setViewMode("detail");
    setActiveTab("personal");
    try {
      const profile = await fetchNui<DetailedProfile>("getProfile", {
        citizenid,
      });

      if (profile) {
        setSelectedProfile(profile);

        if (profile.canManageLicenses !== undefined) {
          setCanManageLicenses(profile.canManageLicenses);
        }

        // Load additional data
        try {
          const gangs = await fetchNui<CitizenGang[]>("getCitizenGangs", {
            citizenid,
          });
          setCitizenGangs(gangs || []);
        } catch (error) {
          console.error("Error loading citizen gangs:", error);
          setCitizenGangs([]);
        }

        try {
          const photo = await fetchNui<string>("getCitizenPhoto", {
            citizenid,
          });
          setProfilePhoto(photo || "");
        } catch (error) {
          console.error("Error loading photo:", error);
          setProfilePhoto("");
        }

        try {
          const notes = await fetchNui<string>("getCitizenNotes", {
            citizenid,
          });
          setProfileNotes(notes || "");
        } catch (error) {
          console.error("Error loading notes:", error);
          setProfileNotes("");
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      setSelectedProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Gang management functions
  const addGangTag = async () => {
    if (!selectedProfile || !selectedGangTag) return;

    setAddingGang(true);
    try {
      const result = await fetchNui<{ success: boolean }>("addGangTag", {
        citizenid: selectedProfile.citizenid,
        gangId: selectedGangTag,
        notes: gangNotes,
      });

      if (result.success) {
        const gangs = await fetchNui<CitizenGang[]>("getCitizenGangs", {
          citizenid: selectedProfile.citizenid,
        });
        setCitizenGangs(gangs || []);
        setSelectedGangTag(null);
        setGangNotes("");
      }
    } catch (error) {
      console.error("Error adding gang tag:", error);
    } finally {
      setAddingGang(false);
    }
  };

  const removeGangTag = async (gangId: number) => {
    if (!selectedProfile) return;

    try {
      const result = await fetchNui<{ success: boolean }>("removeGangTag", {
        id: gangId,
        citizenid: selectedProfile.citizenid,
      });

      if (result.success) {
        setCitizenGangs((prev) => prev.filter((g) => g.id !== gangId));
      }
    } catch (error) {
      console.error("Error removing gang tag:", error);
    }
  };

  // License management
  const toggleLicense = async (license: string, hasLicense: boolean) => {
    if (!selectedProfile || !canManageLicenses || togglingLicense) return;

    setTogglingLicense(license);
    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        hasLicense ? "removeLicense" : "addLicense",
        {
          citizenid: selectedProfile.citizenid,
          license: license,
        }
      );

      if (result.success) {
        setSelectedProfile({
          ...selectedProfile,
          licenses: {
            ...selectedProfile.licenses,
            [license]: !hasLicense,
          },
        });
      }
    } catch (error) {
      console.error("Error toggling license:", error);
    } finally {
      setTogglingLicense(null);
    }
  };

  // Navigation functions
  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedProfile(null);
    setCitizenGangs([]);
    setSelectedGangTag(null);
    setGangNotes("");
    setProfilePhoto("");
    setProfileNotes("");
    setPhotoUrl("");
    setShowUrlInput(false);
  }, []);

  // Photo and notes functions
  const handlePhotoUrlSubmit = async () => {
    if (!selectedProfile || !photoUrl.trim()) return;

    try {
      const result = await fetchNui<{ success: boolean }>(
        "updateCitizenPhoto",
        {
          citizenid: selectedProfile.citizenid,
          url: photoUrl.trim(),
        }
      );

      if (result.success) {
        setProfilePhoto(photoUrl.trim());
        setPhotoUrl("");
        setShowUrlInput(false);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
    }
  };

  const saveNotes = async () => {
    if (!selectedProfile) return;

    setSavingNotes(true);
    try {
      const result = await fetchNui<{ success: boolean }>("saveCitizenNotes", {
        citizenid: selectedProfile.citizenid,
        notes: profileNotes,
      });
    } catch (error) {
      console.error("Error saving notes:", error);
    } finally {
      setSavingNotes(false);
    }
  };

  // Utility functions
  const getWeaponStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "expired":
        return "bg-orange-500";
      case "revoked":
        return "bg-red-500";
      case "stolen":
        return "bg-red-500";
      case "lost":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
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
                placeholder="Search by name or Citizen ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
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
                setProfiles([]);
                setHasSearched(false);
              }}
            >
              <i className="fas fa-redo"></i>
            </button>
          </div>
        </div>

        {/* Profiles Table */}
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
                  Enter a name or Citizen ID to begin
                </p>
              </div>
            ) : profiles.length > 0 ? (
              <table className="mdt-table">
                <thead>
                  <tr>
                    <th>Citizen ID</th>
                    <th>Name</th>
                    <th>Date of Birth</th>
                    <th>Gender</th>
                    <th>Phone</th>
                    <th>Occupation</th>
                    <th>Gang Tags</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        <span className="badge badge-outline">
                          {profile.citizenid}
                        </span>
                      </td>
                      <td>
                        <span className="font-medium text-white">
                          {profile.firstname} {profile.lastname}
                        </span>
                      </td>
                      <td className="text-white">{profile.birthdate}</td>
                      <td className="text-white">{profile.gender}</td>
                      <td className="text-white">{profile.phone}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">
                            {profile.job}
                          </span>
                          {profile.jobGrade && (
                            <span className="badge badge-primary text-xs">
                              {profile.jobGrade}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {profile.gangTags && profile.gangTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {profile.gangTags.split(", ").map((tag, index) => (
                              <span
                                key={index}
                                className="badge bg-purple-500 text-white text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-primary-200">-</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors"
                          onClick={() => viewProfile(profile.citizenid)}
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
                <i className="fas fa-user text-6xl text-primary-400 mb-4"></i>
                <h3 className="text-lg font-medium text-white mb-2">
                  No profiles found
                </h3>
                <p className="text-sm text-primary-200 text-center max-w-md">
                  Try searching with a different name or Citizen ID
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render detail view
  return (
    <div className="h-full flex flex-col">
      {/* Header with back button */}
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
                <i className="fas fa-user"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Citizen Profile
                </h2>
                {selectedProfile && (
                  <p className="text-sm text-primary-200">
                    {selectedProfile.firstname} {selectedProfile.lastname} •{" "}
                    {selectedProfile.citizenid}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="mdt-card flex-1 flex flex-col">
        {profileLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="loading-spinner"></div>
          </div>
        ) : selectedProfile ? (
          <div className="p-6 flex-1 overflow-auto custom-scrollbar">
            {/* Tabs */}
            <div className="flex border-b border-mdt-border mb-6">
              {[
                { id: "personal", label: "Personal", icon: "fas fa-user" },
                {
                  id: "employment",
                  label: "Employment",
                  icon: "fas fa-briefcase",
                },
                { id: "licenses", label: "Licenses", icon: "fas fa-id-card" },
                {
                  id: "gangs",
                  label: "Gang Affiliation",
                  icon: "fas fa-users",
                },
                { id: "vehicles", label: "Vehicles", icon: "fas fa-car" },
                { id: "properties", label: "Properties", icon: "fas fa-home" },
                {
                  id: "firearms",
                  label: "Firearms",
                  icon: "fas fa-crosshairs",
                },
                {
                  id: "criminal",
                  label: "Criminal Record",
                  icon: "fas fa-file-alt",
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={classNames(
                    "px-4 py-2 font-medium text-sm transition-colors border-b-2",
                    activeTab === tab.id
                      ? "text-primary-400 border-primary-400"
                      : "text-primary-200 border-transparent hover:text-white"
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <i className={`${tab.icon} mr-2`}></i>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "personal" && (
              <div className="space-y-6">
                {/* Top Section with Photo and Info */}
                <div className="flex gap-6">
                  {/* Photo Section */}
                  <div className="w-64 flex-shrink-0">
                    <div className="bg-mdt-accent rounded-lg p-0 relative h-80 overflow-hidden">
                      <div className="w-full h-full">
                        {profilePhoto ? (
                          <img
                            src={profilePhoto}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-full flex flex-col items-center justify-center">
                                    <i class="fas fa-camera text-4xl text-primary-200 mb-2"></i>
                                    <span class="text-sm text-primary-200">No photo available</span>
                                  </div>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <i className="fas fa-camera text-4xl text-primary-200 mb-2"></i>
                            <span className="text-sm text-primary-200">
                              No photo available
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        className="absolute top-2 right-2 w-8 h-8 bg-primary-600 rounded text-white hover:bg-primary-700 transition-colors"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                      >
                        <i className="fas fa-camera"></i>
                      </button>
                    </div>

                    {showUrlInput && (
                      <div className="bg-mdt-accent p-3 mt-2 rounded-lg">
                        <div className="space-y-2">
                          <input
                            type="text"
                            className="mdt-input w-full text-xs"
                            placeholder="Enter photo URL..."
                            value={photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              className="mdt-button mdt-button-secondary text-xs py-1 px-2"
                              onClick={() => {
                                setShowUrlInput(false);
                                setPhotoUrl("");
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="mdt-button mdt-button-primary text-xs py-1 px-2"
                              onClick={handlePhotoUrlSubmit}
                            >
                              Upload
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-mdt-accent p-3 mt-4 rounded-lg">
                      <h4 className="text-sm font-medium mb-2 text-white">
                        Biometric Data
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-mdt-bg rounded text-xs">
                          <i className="fas fa-fingerprint text-primary-400"></i>
                          <span className="text-primary-200">Fingerprint:</span>
                          <span className="font-medium text-white">
                            {selectedProfile.fingerprint || "Not on file"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-mdt-bg rounded text-xs">
                          <i className="fas fa-tint text-primary-400"></i>
                          <span className="text-primary-200">Blood Type:</span>
                          <span className="font-medium text-white">
                            {selectedProfile.bloodType || "Unknown"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Sections */}
                  <div className="flex-1 space-y-4">
                    {/* Basic Information */}
                    <div className="bg-mdt-accent p-4 rounded-lg">
                      <h4 className="text-sm font-medium mb-3 text-white">
                        Basic Information
                      </h4>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Full Name",
                            value: `${selectedProfile.firstname} ${selectedProfile.lastname}`,
                          },
                          {
                            label: "Date of Birth",
                            value: selectedProfile.birthdate,
                          },
                          { label: "Gender", value: selectedProfile.gender },
                          {
                            label: "Nationality",
                            value: selectedProfile.nationality,
                          },
                          {
                            label: "Phone Number",
                            value: selectedProfile.phone,
                          },
                        ].map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between py-2 border-b border-mdt-border last:border-b-0"
                          >
                            <span className="text-sm text-primary-200">
                              {item.label}
                            </span>
                            <span className="text-sm font-medium text-white">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className="bg-mdt-accent p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-white">
                          Officer Notes
                        </h4>
                        <button
                          className="mdt-button mdt-button-primary text-xs py-1 px-3"
                          onClick={saveNotes}
                          disabled={savingNotes}
                        >
                          {savingNotes ? (
                            <div className="flex items-center gap-1">
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                              Saving...
                            </div>
                          ) : (
                            "Save Notes"
                          )}
                        </button>
                      </div>
                      <textarea
                        className="mdt-input w-full h-24 resize-none"
                        placeholder="Add notes about this citizen..."
                        value={profileNotes}
                        onChange={(e) => setProfileNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "employment" && (
              <div className="space-y-4">
                {/* Current Employment */}
                <div className="bg-mdt-accent p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-3 text-white">
                    Current Employment
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-mdt-border">
                      <span className="text-sm text-primary-200">Job</span>
                      <span className="text-sm font-medium text-white">
                        {selectedProfile.job}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-primary-200">Grade</span>
                      <span className="text-sm font-medium text-white">
                        {selectedProfile.jobGrade || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* All Jobs in Grid */}
                <div className="bg-mdt-accent p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-4 text-white">
                    Job History
                  </h4>
                  {selectedProfile.jobs && selectedProfile.jobs.length > 0 ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {selectedProfile.jobs.map((job, index) => (
                        <div
                          key={index}
                          className="aspect-square bg-mdt-bg rounded-lg border border-mdt-border p-3 flex flex-col items-center justify-center text-center transition-all duration-150 hover:border-primary-500 hover:-translate-y-1"
                        >
                          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mb-2">
                            <i className="fas fa-briefcase text-white text-sm"></i>
                          </div>
                          <div className="text-xs font-medium text-white mb-1 line-clamp-2">
                            {job.label}
                          </div>
                          <div className="badge bg-blue-500 text-white text-xs">
                            {job.gradeName}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <span className="text-primary-200 text-sm">
                        No job history available
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "licenses" && (
              <div className="bg-mdt-accent p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Licenses & Permits
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {LICENSE_CONFIG.map((license) => {
                    const hasLicense =
                      selectedProfile.licenses[license.value] || false;
                    const isToggling = togglingLicense === license.value;

                    return (
                      <div
                        key={license.value}
                        className={classNames(
                          "p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:-translate-y-1",
                          hasLicense
                            ? "bg-primary-600/20 border-primary-500"
                            : "bg-mdt-bg border-mdt-border",
                          canManageLicenses
                            ? "cursor-pointer"
                            : "cursor-default",
                          isToggling ? "opacity-60" : ""
                        )}
                        onClick={() =>
                          canManageLicenses &&
                          !isToggling &&
                          toggleLicense(license.value, hasLicense)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <i
                              className={`${license.icon} text-primary-400`}
                            ></i>
                            <span className="text-sm text-white">
                              {license.label}
                            </span>
                          </div>
                          {isToggling ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                          ) : hasLicense ? (
                            <span className="badge bg-green-500 text-white text-xs">
                              <i className="fas fa-check"></i>
                            </span>
                          ) : (
                            <span className="badge bg-red-500 text-white text-xs">
                              <i className="fas fa-times"></i>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {canManageLicenses ? (
                  <p className="text-xs text-primary-200 text-center mt-4">
                    Click a license to toggle its status
                  </p>
                ) : (
                  <p className="text-xs text-primary-200 text-center mt-4">
                    You do not have permission to manage licenses
                  </p>
                )}
              </div>
            )}

            {activeTab === "gangs" && (
              <div className="bg-mdt-accent p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Gang Affiliations
                </h4>

                {/* Existing gang tags */}
                {citizenGangs.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {citizenGangs.map((gang) => (
                      <div
                        key={gang.id}
                        className="p-3 bg-mdt-bg rounded border border-mdt-border"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="badge text-white text-xs"
                              style={{ backgroundColor: gang.gang_color }}
                            >
                              {gang.gang_name}
                            </span>
                            <div className="text-xs text-primary-200">
                              <div>Tagged by: {gang.tagged_by}</div>
                              <div>Date: {formatDate(gang.tagged_at)}</div>
                            </div>
                          </div>
                          <button
                            className="w-6 h-6 text-red-400 hover:text-red-300 transition-colors"
                            onClick={() => removeGangTag(gang.id)}
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                        {gang.notes && (
                          <p className="text-xs text-primary-200 mt-2">
                            Notes: {gang.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new gang tag */}
                <div className="p-3 bg-mdt-bg rounded border border-mdt-border">
                  <h5 className="text-sm font-medium mb-3 text-white">
                    Add Gang Tag
                  </h5>
                  <div className="space-y-3">
                    <select
                      className="mdt-input w-full"
                      value={selectedGangTag || ""}
                      onChange={(e) => setSelectedGangTag(e.target.value)}
                    >
                      <option value="">Select gang tag</option>
                      {gangTags.map((tag) => (
                        <option key={tag.id} value={tag.id.toString()}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="mdt-input w-full h-16 resize-none"
                      placeholder="Notes (optional)"
                      value={gangNotes}
                      onChange={(e) => setGangNotes(e.target.value)}
                    />
                    <button
                      className={classNames(
                        "mdt-button mdt-button-primary flex items-center gap-2",
                        !selectedGangTag || addingGang
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      )}
                      onClick={addGangTag}
                      disabled={!selectedGangTag || addingGang}
                    >
                      {addingGang && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      )}
                      <i className="fas fa-plus"></i>
                      Add Gang Tag
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "vehicles" && (
              <div className="bg-mdt-accent p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Registered Vehicles
                </h4>
                {selectedProfile.vehicles &&
                selectedProfile.vehicles.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {selectedProfile.vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="aspect-square bg-mdt-bg rounded-lg border border-mdt-border p-3 flex flex-col items-center justify-center text-center transition-all duration-150 hover:border-primary-500 hover:-translate-y-1"
                      >
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mb-2">
                          <i className="fas fa-car text-white text-sm"></i>
                        </div>
                        <div className="text-xs font-medium text-white mb-1 line-clamp-2">
                          {vehicle.vehicle}
                        </div>
                        <div className="badge badge-outline text-xs">
                          {vehicle.plate}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-primary-200 text-sm">
                      No vehicles registered
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "properties" && (
              <div className="bg-mdt-accent p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Owned Properties
                </h4>
                {selectedProfile.properties &&
                selectedProfile.properties.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProfile.properties.map((property) => (
                      <div
                        key={property.id}
                        className="p-3 bg-mdt-bg rounded border border-mdt-border"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {property.label}
                            </div>
                            <div className="text-xs text-primary-200">
                              {property.type}
                            </div>
                          </div>
                          <span className="badge bg-green-500 text-white text-xs">
                            ${property.price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-primary-200 text-sm">
                      No properties owned
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "firearms" && (
              <div className="bg-mdt-accent p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Registered Firearms
                </h4>
                {selectedProfile.registeredWeapons &&
                selectedProfile.registeredWeapons.length > 0 ? (
                  <div className="space-y-3">
                    {selectedProfile.registeredWeapons.map((weapon) => (
                      <div
                        key={weapon.id}
                        className="p-3 bg-mdt-bg rounded border border-mdt-border"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {weapon.weapon_type}
                            </div>
                            <div className="text-xs text-primary-200">
                              Serial: {weapon.serial_number}
                            </div>
                            <div className="text-xs text-primary-200">
                              Registered: {formatDate(weapon.registration_date)}
                            </div>
                          </div>
                          <span
                            className={classNames(
                              "badge text-white text-xs",
                              getWeaponStatusColor(weapon.status)
                            )}
                          >
                            {weapon.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-primary-200 text-sm">
                      No registered firearms
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "criminal" && (
              <div className="bg-mdt-accent p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-white">
                  Criminal Record Summary
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-mdt-bg rounded text-center">
                    <div className="text-xs text-primary-200">Arrests</div>
                    <div className="text-xl font-bold text-red-400 mt-1">
                      {selectedProfile.criminalRecord.arrests}
                    </div>
                  </div>
                  <div className="p-4 bg-mdt-bg rounded text-center">
                    <div className="text-xs text-primary-200">Citations</div>
                    <div className="text-xl font-bold text-yellow-400 mt-1">
                      {selectedProfile.criminalRecord.citations}
                    </div>
                  </div>
                  <div className="p-4 bg-mdt-bg rounded text-center">
                    <div className="text-xs text-primary-200">Warrants</div>
                    <div className="text-xl font-bold text-orange-400 mt-1">
                      {selectedProfile.criminalRecord.warrants}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-80">
            <span className="text-primary-200 text-lg">
              Failed to load profile
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilesPage;
