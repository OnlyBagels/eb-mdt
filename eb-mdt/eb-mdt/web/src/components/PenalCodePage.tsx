import React, { useState, useMemo } from "react";
import { classNames } from "../utils/misc";
import {
  penalCodeData,
  PenalCodeStatute,
  PenalCodeCategory,
} from "../data/penalCodes";

type PenalCodeClass = "Felony" | "Misdemeanor" | "Infraction";

const PenalCodePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, "gi");
    return text.split(regex).map((part, index) =>
      regex.test(part) ? (
        <span
          key={index}
          className="bg-primary-200 text-primary-800 px-1 rounded"
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const getClassColor = (penalClass: PenalCodeClass) => {
    switch (penalClass) {
      case "Felony":
        return "text-red-400";
      case "Misdemeanor":
        return "text-orange-400";
      case "Infraction":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const getClassBadgeColor = (penalClass: PenalCodeClass) => {
    switch (penalClass) {
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

  const getClassIcon = (penalClass: PenalCodeClass) => {
    switch (penalClass) {
      case "Felony":
        return "fas fa-exclamation-triangle";
      case "Misdemeanor":
        return "fas fa-gavel";
      case "Infraction":
        return "fas fa-file-alt";
      default:
        return "fas fa-balance-scale";
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  // Filter penal codes based on search and class filter
  const filteredCategories = useMemo(() => {
    return penalCodeData
      .map((category) => {
        const filteredStatutes = Object.entries(category.statutes).filter(
          ([_, statute]) => {
            const matchesSearch =
              !searchQuery ||
              statute.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              statute.description
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              statute.id.toString().includes(searchQuery);

            const matchesClass =
              !selectedClass || statute.class === selectedClass;

            return matchesSearch && matchesClass;
          }
        );

        return {
          ...category,
          statutes: Object.fromEntries(filteredStatutes),
          statuteCount: filteredStatutes.length,
        };
      })
      .filter((category) => category.statuteCount > 0);
  }, [searchQuery, selectedClass]);

  // Calculate totals
  const totals = useMemo(() => {
    let felonies = 0;
    let misdemeanors = 0;
    let infractions = 0;

    penalCodeData.forEach((category) => {
      Object.values(category.statutes).forEach((statute) => {
        switch (statute.class) {
          case "Felony":
            felonies++;
            break;
          case "Misdemeanor":
            misdemeanors++;
            break;
          case "Infraction":
            infractions++;
            break;
        }
      });
    });

    return { felonies, misdemeanors, infractions };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter Section */}
      <div className="mdt-card p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-200"></i>
              <input
                type="text"
                className="mdt-input pl-10 w-full"
                placeholder="Search by code, title, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="mdt-input"
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value || null)}
            >
              <option value="">All Classes</option>
              <option value="Felony">Felonies</option>
              <option value="Misdemeanor">Misdemeanors</option>
              <option value="Infraction">Infractions</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-red-500 text-white text-xs">
              {totals.felonies} Felonies
            </span>
            <span className="badge bg-orange-500 text-white text-xs">
              {totals.misdemeanors} Misdemeanors
            </span>
            <span className="badge bg-yellow-500 text-white text-xs">
              {totals.infractions} Infractions
            </span>
          </div>
        </div>
      </div>

      {/* Penal Code Categories */}
      <div className="mdt-card flex-1 overflow-auto custom-scrollbar">
        {filteredCategories.length > 0 ? (
          <div className="p-4 space-y-3">
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                className="bg-mdt-accent rounded-lg border border-mdt-border"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-mdt-border transition-colors rounded-t-lg"
                  onClick={() => toggleCategory(category.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button className="w-6 h-6 flex items-center justify-center text-primary-200">
                        {expandedCategories.includes(category.id) ? (
                          <i className="fas fa-chevron-down"></i>
                        ) : (
                          <i className="fas fa-chevron-right"></i>
                        )}
                      </button>
                      <h3 className="text-base font-semibold text-white">
                        {highlightText(category.title)}
                      </h3>
                    </div>
                    <span className="badge badge-outline text-xs">
                      {category.statuteCount} statutes
                    </span>
                  </div>
                </div>

                {expandedCategories.includes(category.id) && (
                  <div className="border-t border-mdt-border p-4 space-y-3">
                    {Object.entries(category.statutes).map(([key, statute]) => (
                      <div
                        key={statute.id}
                        className="bg-mdt-bg p-4 rounded-lg border border-mdt-border hover:border-primary-500 hover:-translate-y-0.5 transition-all duration-150"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <i
                                className={classNames(
                                  getClassIcon(statute.class),
                                  getClassColor(statute.class)
                                )}
                              ></i>
                              <span className="text-sm font-semibold text-white">
                                §{statute.id} - {highlightText(statute.title)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className={classNames(
                                  "badge text-white text-xs",
                                  getClassBadgeColor(statute.class)
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

                            <p className="text-xs text-primary-200 leading-relaxed">
                              {highlightText(statute.description)}
                            </p>
                          </div>

                          <button
                            className={classNames(
                              "w-8 h-8 rounded flex items-center justify-center text-xs transition-colors ml-4",
                              copiedCode === `§${statute.id}`
                                ? "bg-green-500 text-white"
                                : "bg-mdt-accent hover:bg-gray-600 text-white"
                            )}
                            onClick={() => copyToClipboard(`§${statute.id}`)}
                            title={
                              copiedCode === `§${statute.id}`
                                ? "Copied!"
                                : "Copy code"
                            }
                          >
                            {copiedCode === `§${statute.id}` ? (
                              <i className="fas fa-check"></i>
                            ) : (
                              <i className="fas fa-copy"></i>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <i className="fas fa-search text-6xl text-primary-400 mb-4"></i>
            <h3 className="text-lg font-medium text-white mb-2">
              No penal codes found
            </h3>
            <p className="text-sm text-primary-200 text-center max-w-md">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PenalCodePage;
