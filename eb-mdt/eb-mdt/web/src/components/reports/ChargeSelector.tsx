import React, { useState, useMemo } from "react";
import { classNames } from "../../utils/misc";
import {
  penalCodeData,
  PenalCodeStatute,
  PenalCodeCategory,
} from "../../data/penalCodes";

interface Charge {
  code: string;
  title: string;
  class: "Felony" | "Misdemeanor" | "Infraction";
  fine: number;
  months: number;
}

interface ChargeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCharge: (charge: Charge) => void;
  selectedCitizenId?: string;
}

// Extended category type with statuteCount
interface FilteredPenalCodeCategory extends PenalCodeCategory {
  statuteCount: number;
}

const ChargeSelector: React.FC<ChargeSelectorProps> = ({
  isOpen,
  onClose,
  onSelectCharge,
  selectedCitizenId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<number[]>([0]); // First category expanded by default

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Filter charges based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return penalCodeData.map((category) => ({
        ...category,
        statuteCount: Object.keys(category.statutes).length,
      }));
    }

    const query = searchQuery.toLowerCase();

    return penalCodeData
      .map((category: PenalCodeCategory): FilteredPenalCodeCategory => {
        const filteredStatutes = Object.entries(category.statutes).filter(
          ([_, statute]: [string, PenalCodeStatute]) =>
            statute.id.toString().includes(query) ||
            statute.title.toLowerCase().includes(query) ||
            statute.description.toLowerCase().includes(query)
        );

        return {
          ...category,
          statutes: Object.fromEntries(filteredStatutes),
          statuteCount: filteredStatutes.length,
        };
      })
      .filter(
        (category): category is FilteredPenalCodeCategory =>
          category.statuteCount > 0
      );
  }, [searchQuery]);

  const getChargeColor = (chargeClass: string) => {
    switch (chargeClass) {
      case "Felony":
        return "bg-red-500";
      case "Misdemeanor":
        return "bg-orange-500";
      case "Infraction":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleSelectCharge = (statute: PenalCodeStatute) => {
    onSelectCharge({
      code: statute.id.toString(),
      title: statute.title,
      class: statute.class,
      fine: statute.fine,
      months: statute.months,
    });
    onClose();
    setSearchQuery("");
  };

  const handleClose = () => {
    onClose();
    setSearchQuery("");
    setExpandedCategories([0]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-mdt-card rounded-lg border border-mdt-border w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-mdt-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Add Charge</h2>
          <button
            className="w-8 h-8 rounded bg-mdt-accent hover:bg-gray-600 flex items-center justify-center transition-colors"
            onClick={handleClose}
          >
            <i className="fas fa-times text-white"></i>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-mdt-border">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-200"></i>
            <input
              type="text"
              className="mdt-input pl-10 w-full"
              placeholder="Search by code, title, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto custom-scrollbar p-4">
          {filteredCategories.length > 0 ? (
            <div className="space-y-3">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="bg-mdt-accent rounded-lg border border-mdt-border"
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-mdt-border transition-colors rounded-t-lg"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button className="w-5 h-5 flex items-center justify-center text-primary-200">
                          {expandedCategories.includes(category.id) ? (
                            <i className="fas fa-chevron-down"></i>
                          ) : (
                            <i className="fas fa-chevron-right"></i>
                          )}
                        </button>
                        <span className="font-medium text-white">
                          {category.title}
                        </span>
                      </div>
                      <span className="badge badge-outline text-xs">
                        {category.statuteCount} charges
                      </span>
                    </div>
                  </div>

                  {expandedCategories.includes(category.id) && (
                    <div className="border-t border-mdt-border p-3 space-y-2">
                      {Object.values(category.statutes).map(
                        (statute: PenalCodeStatute) => (
                          <div
                            key={statute.id}
                            className="p-3 bg-mdt-bg rounded border border-mdt-border cursor-pointer transition-all duration-150 hover:border-primary-500 hover:-translate-y-0.5"
                            onClick={() => handleSelectCharge(statute)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <i className="fas fa-gavel text-sm text-primary-200"></i>
                                  <span className="text-sm font-medium text-white">
                                    §{statute.id} - {statute.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                  <span
                                    className={classNames(
                                      "badge text-white text-xs",
                                      getChargeColor(statute.class)
                                    )}
                                  >
                                    {statute.class}
                                  </span>
                                  {statute.months > 0 && (
                                    <span className="badge badge-outline text-xs">
                                      {statute.months} months
                                    </span>
                                  )}
                                  <span className="badge bg-green-500 text-white text-xs">
                                    ${statute.fine.toLocaleString()}
                                  </span>
                                </div>

                                <p className="text-xs text-primary-200 leading-relaxed line-clamp-2">
                                  {statute.description}
                                </p>
                              </div>

                              <button className="ml-3 w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded text-white transition-colors">
                                <i className="fas fa-plus text-xs"></i>
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <i className="fas fa-gavel text-4xl text-primary-200 mb-4"></i>
              <h3 className="text-lg font-medium text-white mb-2">
                No charges found
              </h3>
              <p className="text-sm text-primary-200 text-center">
                Try adjusting your search criteria
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-mdt-border flex justify-end">
          <button
            className="mdt-button mdt-button-secondary"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChargeSelector;
