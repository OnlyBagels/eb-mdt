import React, { useState, useEffect, useCallback } from "react";
import { useNuiEvent } from "../hooks/useNuiEvent";
import { fetchNui } from "../utils/fetchNui";
import { classNames } from "../utils/misc";

// Import all page components
import EvidencePage from "./EvidencePage";
import ProfilesPage from "./ProfilesPage";
import ReportsPage from "./ReportsPage";
import VehiclesPage from "./VehiclesPage";
import PenalCodePage from "./PenalCodePage";
import WeaponsPage from "./WeaponsPage";
import BOLOPage from "./BOLOPage"; // Import the new BOLO page

interface Officer {
  id: number;
  name: string;
  callsign: string;
  department: string;
  rank: string;
}

interface PlayerInfo {
  name: string;
  callsign: string;
  department: string;
  rank: string;
  jobName?: string;
  gradeLevel?: number;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  author: string;
  author_citizenid: string;
  department: string;
  importance: "low" | "medium" | "high" | "critical";
  created_at: string;
  expires_at: string | null;
  canDelete: boolean;
}

// Updated BOLO interface to match your database structure
interface ActiveBolo {
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

const MDTApp: React.FC = () => {
  // Core state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSection, setActiveSection] = useState("dashboard");
  const [onlineOfficers, setOnlineOfficers] = useState<Officer[]>([]);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    name: "Loading...",
    callsign: "...",
    department: "...",
    rank: "...",
  });

  // Navigation state
  const [navigationData, setNavigationData] = useState<any>(null);

  // Announcement states
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [canCreateAnnouncement, setCanCreateAnnouncement] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementFormData, setAnnouncementFormData] = useState({
    title: "",
    content: "",
    importance: "medium" as "low" | "medium" | "high" | "critical",
    duration: 0,
  });

  // BOLO states
  const [activeBolos, setActiveBolos] = useState<ActiveBolo[]>([]);
  const [bolosLoading, setBolosLoading] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
    { id: "profiles", label: "Profiles", icon: "fas fa-user" },
    { id: "reports", label: "Reports", icon: "fas fa-file-alt" },
    { id: "vehicles", label: "Vehicles", icon: "fas fa-car" },
    { id: "bolos", label: "BOLOs", icon: "fas fa-search" }, // Add BOLO menu item
    { id: "penalcode", label: "Penal Code", icon: "fas fa-balance-scale" },
    { id: "weapons", label: "Firearm Registry", icon: "fas fa-crosshairs" },
    { id: "evidence", label: "Evidence", icon: "fas fa-fingerprint" },
  ];

  // Event listeners
  useNuiEvent<PlayerInfo>("updatePlayerInfo", (data) => {
    setPlayerInfo(data);
  });

  useNuiEvent<Officer[]>("updateOnlineOfficers", (data) => {
    setOnlineOfficers(data);
  });

  useNuiEvent("refreshAnnouncements", () => {
    if (activeSection === "dashboard") {
      loadAnnouncements();
    }
  });

  useNuiEvent("newAnnouncement", () => {
    if (activeSection === "dashboard") {
      loadAnnouncements();
    }
  });

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load data when section changes
  useEffect(() => {
    if (activeSection === "dashboard") {
      loadAnnouncements();
      loadActiveBolos();
    }
  }, [activeSection]);

  // Auto-refresh BOLOs
  useEffect(() => {
    if (activeSection === "dashboard" || activeSection === "bolos") {
      const interval = setInterval(() => {
        loadActiveBolos();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [activeSection]);

  // Clear navigation data when changing sections
  useEffect(() => {
    if (activeSection !== "profiles" && activeSection !== "vehicles") {
      setNavigationData(null);
    }
  }, [activeSection]);

  // Data loading functions
  const loadAnnouncements = async () => {
    try {
      const result = await fetchNui<{
        announcements: Announcement[];
        canCreate: boolean;
      }>("getAnnouncements", {});
      if (result) {
        setAnnouncements(result.announcements);
        setCanCreateAnnouncement(result.canCreate);
      }
    } catch (error) {
      console.error("Error loading announcements:", error);
    }
  };

  const loadActiveBolos = async () => {
    setBolosLoading(true);
    try {
      const result = await fetchNui<ActiveBolo[]>("getActiveBolos", {});
      if (result) {
        setActiveBolos(result);
      }
    } catch (error) {
      console.error("Error loading active BOLOs:", error);
      setActiveBolos([]);
    } finally {
      setBolosLoading(false);
    }
  };

  // Announcement functions
  const createAnnouncement = async () => {
    if (
      !announcementFormData.title.trim() ||
      !announcementFormData.content.trim()
    )
      return;

    setAnnouncementLoading(true);
    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        "createAnnouncement",
        announcementFormData
      );

      if (result.success) {
        setAnnouncementModalOpen(false);
        setAnnouncementFormData({
          title: "",
          content: "",
          importance: "medium",
          duration: 0,
        });
        loadAnnouncements();
      }
    } catch (error) {
      console.error("Error creating announcement:", error);
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const deleteAnnouncement = async (id: number) => {
    try {
      const result = await fetchNui<{ success: boolean; message?: string }>(
        "deleteAnnouncement",
        { id }
      );

      if (result.success) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (error) {
      console.error("Error deleting announcement:", error);
    }
  };

  // Navigation functions
  const handleLogout = () => {
    fetchNui("closeMDT", {});
  };

  const navigateToProfile = useCallback((citizenid: string) => {
    setNavigationData({ citizenid });
    setActiveSection("profiles");
  }, []);

  const navigateToVehicle = useCallback((plate: string) => {
    setNavigationData({ searchQuery: plate });
    setActiveSection("vehicles");
  }, []);

  // Utility functions
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAnnouncementDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getImportanceIcon = (importance: string) => {
    switch (importance) {
      case "critical":
        return "fas fa-exclamation-triangle";
      case "high":
        return "fas fa-exclamation-circle";
      case "low":
        return "fas fa-info-circle";
      default:
        return "fas fa-bell";
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "low":
        return "bg-gray-500";
      default:
        return "bg-blue-500";
    }
  };

  const getBoloPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-gray-500";
      default:
        return "bg-blue-500";
    }
  };

  // Dashboard render
  const renderDashboard = () => (
    <div className="h-full flex flex-col gap-4">
      {/* Announcements */}
      <div className="mdt-card flex-1">
        <div className="bg-mdt-accent p-4 border-b border-mdt-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-bell text-lg text-white"></i>
              <h3 className="text-sm font-semibold text-white">
                Announcements
              </h3>
            </div>
            {canCreateAnnouncement && (
              <button
                className="w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white text-sm transition-colors"
                onClick={() => setAnnouncementModalOpen(true)}
              >
                <i className="fas fa-plus"></i>
              </button>
            )}
          </div>
        </div>

        <div className="p-3 h-full overflow-auto custom-scrollbar">
          {announcements.length > 0 ? (
            <div className="space-y-2">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={classNames(
                    "p-3 rounded-lg border transition-all duration-150 hover:border-primary-400 hover:-translate-y-0.5",
                    announcement.importance === "critical"
                      ? "border-red-500 bg-red-500/10"
                      : announcement.importance === "high"
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-mdt-accent bg-mdt-accent"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <i
                        className={`${getImportanceIcon(
                          announcement.importance
                        )} text-white`}
                      ></i>
                      <span className="text-sm font-semibold text-white">
                        {announcement.title}
                      </span>
                      <span
                        className={classNames(
                          "badge text-xs",
                          getImportanceColor(announcement.importance),
                          "text-white"
                        )}
                      >
                        {announcement.importance.toUpperCase()}
                      </span>
                    </div>

                    {announcement.canDelete && (
                      <button
                        className="w-6 h-6 text-red-400 hover:text-red-300 text-sm transition-colors"
                        onClick={() => deleteAnnouncement(announcement.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-primary-200 mt-2">
                    {announcement.content}
                  </p>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-primary-200">
                      By {announcement.author} •{" "}
                      {formatAnnouncementDate(announcement.created_at)}
                    </span>
                    {announcement.expires_at && (
                      <span className="text-xs text-yellow-400">
                        Expires:{" "}
                        {formatAnnouncementDate(announcement.expires_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-primary-200 text-sm">No announcements</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-4 h-80">
        {/* Active Warrants */}
        <div className="mdt-card">
          <div className="bg-mdt-accent p-4 border-b border-mdt-border">
            <div className="flex items-center gap-2">
              <i className="fas fa-exclamation-triangle text-lg text-white"></i>
              <h3 className="text-sm font-semibold text-white">
                Active Warrants
              </h3>
            </div>
          </div>
          <div className="p-3 h-full">
            <div className="flex items-center justify-center h-full">
              <span className="text-primary-200 text-sm">
                No active warrants
              </span>
            </div>
          </div>
        </div>

        {/* Active BOLOs - Updated to use your database structure */}
        <div className="mdt-card">
          <div className="bg-mdt-accent p-4 border-b border-mdt-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-eye text-lg text-white"></i>
                <h3 className="text-sm font-semibold text-white">
                  Active BOLOs
                </h3>
              </div>
              <span className="badge bg-yellow-500 text-black text-xs">
                {activeBolos.length} Active
              </span>
            </div>
          </div>

          <div className="p-3 h-full overflow-auto custom-scrollbar">
            {bolosLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="loading-spinner"></div>
              </div>
            ) : activeBolos.length > 0 ? (
              <div className="space-y-2">
                {activeBolos.slice(0, 8).map((bolo) => (
                  <div
                    key={bolo.id}
                    className="p-3 rounded bg-mdt-accent border-l-4 transition-all duration-150 hover:bg-mdt-border hover:-translate-y-0.5 cursor-pointer"
                    style={{
                      borderLeftColor:
                        bolo.priority === "CRITICAL"
                          ? "#ef4444"
                          : bolo.priority === "HIGH"
                          ? "#f97316"
                          : bolo.priority === "MEDIUM"
                          ? "#eab308"
                          : "#6b7280",
                    }}
                    onClick={() => navigateToVehicle(bolo.plate)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="badge bg-blue-500 text-white text-xs">
                          {bolo.plate}
                        </span>
                        <span className="badge badge-outline text-xs">
                          BOLO
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {bolo.priority === "CRITICAL" && (
                          <i className="fas fa-exclamation-triangle text-red-500 text-xs"></i>
                        )}
                        <span
                          className={`badge text-white text-xs ${getBoloPriorityColor(
                            bolo.priority
                          )}`}
                        >
                          {bolo.priority}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-primary-200 mb-1 line-clamp-2">
                      {bolo.reason || "No description"}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-primary-200">
                        By: {bolo.officer_name}
                      </span>
                      <span className="text-xs text-primary-200">
                        {formatAnnouncementDate(bolo.created_at)}
                      </span>
                    </div>
                  </div>
                ))}

                {activeBolos.length > 8 && (
                  <button
                    className="w-full py-2 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                    onClick={() => setActiveSection("bolos")}
                  >
                    View all {activeBolos.length} BOLOs
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-primary-200 text-sm">
                  No active BOLOs
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Officers On Duty */}
        <div className="mdt-card">
          <div className="bg-mdt-accent p-4 border-b border-mdt-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-user text-lg text-white"></i>
                <h3 className="text-sm font-semibold text-white">
                  Officers On Duty
                </h3>
              </div>
              <span className="badge bg-blue-500 text-white text-xs">
                {onlineOfficers.length} Active
              </span>
            </div>
          </div>

          <div className="p-3 h-full overflow-auto custom-scrollbar">
            {onlineOfficers.length > 0 ? (
              <div className="space-y-2">
                {onlineOfficers.slice(0, 10).map((officer) => (
                  <div key={officer.id} className="p-2 rounded bg-mdt-accent">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {officer.callsign} - {officer.name}
                        </div>
                        <div className="text-xs text-primary-200">
                          {officer.rank} • {officer.department}
                        </div>
                      </div>
                      <span className="badge bg-green-500 text-white text-xs">
                        Active
                      </span>
                    </div>
                  </div>
                ))}

                {onlineOfficers.length > 10 && (
                  <div className="text-xs text-primary-200 text-center">
                    +{onlineOfficers.length - 10} more officers
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-primary-200 text-sm">
                  No officers on duty
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Content renderer
  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return renderDashboard();
      case "profiles":
        return (
          <ProfilesPage
            playerInfo={playerInfo}
            navigationData={navigationData}
          />
        );
      case "reports":
        return (
          <ReportsPage
            playerInfo={playerInfo}
            onlineOfficers={onlineOfficers}
          />
        );
      case "vehicles":
        return (
          <VehiclesPage
            onViewProfile={navigateToProfile}
            navigationData={navigationData}
          />
        );
      case "bolos":
        return <BOLOPage />; // Add the BOLO page here
      case "penalcode":
        return <PenalCodePage />;
      case "weapons":
        return (
          <WeaponsPage
            playerInfo={playerInfo}
            onViewProfile={navigateToProfile}
          />
        );
      case "evidence":
        return <EvidencePage />;
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <span className="text-primary-200 text-lg">
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}{" "}
              section coming soon...
            </span>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-transparent pointer-events-none">
      <div className="w-[90vw] max-w-[1400px] h-[85vh] max-h-[900px] bg-mdt-bg rounded-lg border-2 border-mdt-border overflow-hidden shadow-2xl flex pointer-events-auto">
        {/* Compact Sidebar */}
        <nav className="w-48 bg-mdt-card border-r border-mdt-border p-2 flex flex-col">
          {/* User Info */}
          <div className="bg-mdt-accent p-2 rounded-lg mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs">
                <i className="fas fa-user"></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {playerInfo.name}
                </div>
                <div className="text-xs text-primary-200 truncate">
                  {playerInfo.callsign} • {playerInfo.rank}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={classNames(
                  "w-full px-2 py-2 rounded-lg text-left transition-all duration-150 border border-transparent",
                  activeSection === item.id
                    ? "bg-primary-600 text-white"
                    : "text-primary-200 hover:bg-primary-600/20 hover:text-white hover:border-primary-600/40"
                )}
                onClick={() => setActiveSection(item.id)}
              >
                <div className="flex items-center gap-2">
                  <i className={`${item.icon} text-xs w-3 text-center`}></i>
                  <span className="text-xs truncate">{item.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="border-t border-mdt-border pt-2 space-y-1">
            <button className="w-full px-2 py-2 rounded-lg text-left text-primary-200 hover:bg-primary-600/20 hover:text-white transition-all duration-150">
              <div className="flex items-center gap-2">
                <i className="fas fa-cog text-xs w-3 text-center"></i>
                <span className="text-xs">Settings</span>
              </div>
            </button>
            <button
              className="w-full px-2 py-2 rounded-lg text-left text-primary-200 hover:bg-primary-600/20 hover:text-white transition-all duration-150"
              onClick={handleLogout}
            >
              <div className="flex items-center gap-2">
                <i className="fas fa-sign-out-alt text-xs w-3 text-center"></i>
                <span className="text-xs">Logout</span>
              </div>
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-mdt-card border-b border-mdt-border h-14">
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold text-primary-400">
                  MDT System
                </h1>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-sm text-primary-200">
                  {formatDate(currentTime)}
                </span>
                <span className="text-sm text-primary-200 font-mono">
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 p-4 overflow-auto custom-scrollbar">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Announcement Modal */}
      {announcementModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container max-w-md">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">
                Create Announcement
              </h2>
            </div>

            <div className="modal-content space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Title
                </label>
                <input
                  type="text"
                  className="mdt-input w-full"
                  placeholder="Enter announcement title"
                  value={announcementFormData.title}
                  onChange={(e) =>
                    setAnnouncementFormData({
                      ...announcementFormData,
                      title: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Content
                </label>
                <textarea
                  className="mdt-input w-full h-24 resize-none"
                  placeholder="Enter announcement content"
                  value={announcementFormData.content}
                  onChange={(e) =>
                    setAnnouncementFormData({
                      ...announcementFormData,
                      content: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Importance
                </label>
                <select
                  className="mdt-input w-full"
                  value={announcementFormData.importance}
                  onChange={(e) =>
                    setAnnouncementFormData({
                      ...announcementFormData,
                      importance: e.target.value as
                        | "low"
                        | "medium"
                        | "high"
                        | "critical",
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  className="mdt-input w-full"
                  placeholder="Set to 0 for no expiry"
                  min="0"
                  max="168"
                  value={announcementFormData.duration}
                  onChange={(e) =>
                    setAnnouncementFormData({
                      ...announcementFormData,
                      duration: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="mdt-button mdt-button-secondary"
                onClick={() => setAnnouncementModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={classNames(
                  "mdt-button mdt-button-primary",
                  announcementLoading ||
                    !announcementFormData.title.trim() ||
                    !announcementFormData.content.trim()
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                )}
                onClick={createAnnouncement}
                disabled={
                  announcementLoading ||
                  !announcementFormData.title.trim() ||
                  !announcementFormData.content.trim()
                }
              >
                {announcementLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </div>
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MDTApp;
