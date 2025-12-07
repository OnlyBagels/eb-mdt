import React, { useState, useEffect, useCallback } from "react";
import { fetchNui } from "../utils/fetchNui";
import { useNuiEvent } from "../hooks/useNuiEvent";
import { classNames } from "../utils/misc";

// Types (keeping the same as original)
interface EvidenceInventory {
  id: string;
  evidenceNumber: string;
  owner: string;
  itemCount: number;
  lastUpdated: string;
}

interface InventoryItem {
  slot: number;
  name: string;
  label: string;
  count: number;
  weight: number;
  metadata: Record<string, any>;
  description?: string;
  image: string;
}

interface EvidenceDetails {
  id: string;
  evidenceNumber: string;
  owner: string;
  items: InventoryItem[];
  lastUpdated: string;
  incidentInfo?: {
    description: string;
  };
}

const EvidencePage: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");

  // List view states
  const [searchQuery, setSearchQuery] = useState("");
  const [evidenceList, setEvidenceList] = useState<EvidenceInventory[]>([]);
  const [filteredList, setFilteredList] = useState<EvidenceInventory[]>([]);
  const [loading, setLoading] = useState(false);

  // Detail view states
  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Item detail modal
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Listen for refresh events
  useNuiEvent("refreshEvidence", () => {
    if (viewMode === "list") {
      loadEvidenceList();
    } else if (selectedEvidence) {
      viewEvidence(selectedEvidence.id);
    }
  });

  // Load evidence list on mount
  useEffect(() => {
    loadEvidenceList();
  }, []);

  // Filter evidence based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredList(evidenceList);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = evidenceList.filter(
        (evidence) =>
          evidence.evidenceNumber.toLowerCase().includes(query) ||
          evidence.owner.toLowerCase().includes(query) ||
          evidence.id.toLowerCase().includes(query)
      );
      setFilteredList(filtered);
    }
  }, [searchQuery, evidenceList]);

  const loadEvidenceList = async () => {
    setLoading(true);
    try {
      const result = await fetchNui<EvidenceInventory[]>(
        "getEvidenceInventories",
        {}
      );
      setEvidenceList(result || []);
    } catch (error) {
      console.error("Error loading evidence:", error);
      setEvidenceList([]);
    } finally {
      setLoading(false);
    }
  };

  const viewEvidence = async (evidenceId: string) => {
    setDetailLoading(true);
    setViewMode("detail");
    try {
      const details = await fetchNui<EvidenceDetails>("getEvidenceDetails", {
        evidenceId,
      });
      if (details) {
        setSelectedEvidence(details);
      }
    } catch (error) {
      console.error("Error loading evidence details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToList = useCallback(() => {
    setViewMode("list");
    setSelectedEvidence(null);
    setSelectedItem(null);
  }, []);

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

  // Construct image URL for inventory items
  const getItemImageUrl = (itemName: string) => {
    // This assumes your inventory images are served at this path
    return `https://cfx-nui-ox_inventory/web/images/${itemName}.png`;
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
                placeholder="Search by evidence number or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="mdt-button mdt-button-secondary"
              onClick={loadEvidenceList}
            >
              <i className="fas fa-redo"></i>
            </button>
          </div>
        </div>

        {/* Evidence List */}
        <div className="mdt-card flex-1 flex flex-col">
          <div className="flex-1 overflow-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-80">
                <div className="loading-spinner"></div>
              </div>
            ) : filteredList.length > 0 ? (
              <table className="mdt-table">
                <thead>
                  <tr>
                    <th>Evidence #</th>
                    <th>Description</th>
                    <th>Items</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((evidence) => (
                    <tr key={evidence.id}>
                      <td>
                        <span className="badge badge-outline text-xs">
                          #{evidence.evidenceNumber}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-medium text-white">
                          {evidence.owner}
                        </span>
                      </td>
                      <td>
                        <span
                          className={classNames(
                            "badge text-xs",
                            evidence.itemCount > 0
                              ? "bg-primary-600 text-white"
                              : "bg-gray-500 text-white"
                          )}
                        >
                          {evidence.itemCount} items
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-primary-200">
                          {formatDate(evidence.lastUpdated)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors"
                          onClick={() => viewEvidence(evidence.id)}
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
                  Search for vehicles
                </h3>
                <p className="text-sm text-primary-200 text-center max-w-md">
                  Enter an evidence number or description to begin
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
      {/* Header */}
      <div className="mdt-card p-4 mb-4">
        <div className="flex items-center gap-4">
          <button
            className="w-10 h-10 rounded-lg bg-mdt-accent hover:bg-gray-600 flex items-center justify-center transition-colors"
            onClick={handleBackToList}
          >
            <i className="fas fa-chevron-left text-white"></i>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white">
              <i className="fas fa-fingerprint"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Evidence Details
              </h2>
              {selectedEvidence && (
                <p className="text-sm text-primary-200">
                  Evidence #{selectedEvidence.evidenceNumber} • Last updated:{" "}
                  {formatDate(selectedEvidence.lastUpdated)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Content */}
      <div className="mdt-card flex-1 flex flex-col">
        {detailLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="loading-spinner"></div>
          </div>
        ) : selectedEvidence ? (
          <div className="h-full flex flex-col">
            {/* Incident Info */}
            {selectedEvidence.incidentInfo && (
              <div className="profile-section border-b border-mdt-border">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-file-alt text-primary-400"></i>
                  <h4 className="text-sm font-medium text-white">
                    Incident Information
                  </h4>
                </div>
                <p className="text-sm text-white">
                  {selectedEvidence.incidentInfo.description}
                </p>
              </div>
            )}

            {/* Items Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white">
                  Evidence Items ({selectedEvidence.items.length})
                </h4>
                <p className="text-xs text-primary-200">
                  Click an item for details
                </p>
              </div>

              <div className="data-grid data-grid-6 gap-3">
                {selectedEvidence.items.map((item) => (
                  <div
                    key={item.slot}
                    className="item-card relative"
                    onClick={() => setSelectedItem(item)}
                    title={item.description || item.label}
                  >
                    {item.count > 1 && (
                      <div className="absolute top-1 right-1 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                        x{item.count}
                      </div>
                    )}
                    <div className="w-16 h-16 mx-auto mb-2 bg-mdt-bg rounded flex items-center justify-center overflow-hidden">
                      <img
                        src={getItemImageUrl(item.name)}
                        alt={item.label}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML =
                              '<i class="fas fa-box text-2xl text-primary-200"></i>';
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs font-medium line-clamp-2 text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-primary-200">{item.weight}g</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-80">
            <span className="text-primary-200">Evidence not found</span>
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay">
          <div className="modal-container max-w-sm">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">
                {selectedItem.label}
              </h2>
            </div>

            <div className="modal-content space-y-4">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-mdt-accent rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={getItemImageUrl(selectedItem.name)}
                    alt={selectedItem.label}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML =
                          '<i class="fas fa-box text-3xl text-primary-200"></i>';
                      }
                    }}
                  />
                </div>
              </div>

              <div className="profile-section">
                <div className="space-y-2">
                  <div className="profile-row">
                    <span className="profile-label">Item</span>
                    <span className="profile-value">{selectedItem.label}</span>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label">Quantity</span>
                    <span className="profile-value">{selectedItem.count}</span>
                  </div>
                  <div className="profile-row">
                    <span className="profile-label">Weight</span>
                    <span className="profile-value">
                      {selectedItem.weight * selectedItem.count}g
                    </span>
                  </div>
                </div>
              </div>

              {selectedItem.description && (
                <div className="profile-section">
                  <p className="text-xs text-primary-200 mb-1">Description</p>
                  <p className="text-sm text-white">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {Object.keys(selectedItem.metadata).length > 0 && (
                <div className="profile-section">
                  <p className="text-xs text-primary-200 mb-2">Metadata</p>
                  <div className="space-y-1">
                    {Object.entries(selectedItem.metadata).map(
                      ([key, value]) => (
                        <div key={key} className="profile-row">
                          <span className="text-xs text-primary-200">
                            {key}
                          </span>
                          <span className="text-xs text-white">
                            {String(value)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="mdt-button mdt-button-secondary"
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidencePage;
