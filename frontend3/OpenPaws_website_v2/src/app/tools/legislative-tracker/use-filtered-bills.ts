import { useMemo } from "react";
import type { Bill } from "./types";
import type { SearchFilterValues } from "./search-filters";

/**
 * Custom hook to filter a list of bills client-side based on the selected search filters.
 *
 * @param bills The array of bills to filter.
 * @param filters The active filter values (subject, chamber, billType, dateFrom, dateTo).
 * @returns The filtered list of bills.
 */
export function useFilteredBills(bills: Bill[], filters: SearchFilterValues): Bill[] {
  return useMemo(() => {
    return bills.filter((bill) => {
      // 1. Subject filter
      if (filters.subject) {
        const subjectLower = filters.subject.toLowerCase();
        const matchesSubject = bill.subjects?.some(
          (s) => s.toLowerCase() === subjectLower
        );
        if (!matchesSubject) return false;
      }

      // 2. Chamber filter
      if (filters.chamber) {
        const chamberLower = filters.chamber.toLowerCase();
        const billChamber = (bill.origin_chamber || "House").toLowerCase();
        if (billChamber !== chamberLower) return false;
      }

      // 3. Bill type filter
      if (filters.billType) {
        const typeLower = filters.billType.toLowerCase();
        const billType = (bill.bill_type || "").toLowerCase();
        if (billType !== typeLower) return false;
      }

      // 4. Congress filter
      if (filters.congress) {
        if (bill.congress?.toString() !== filters.congress) return false;
      }

      // 4. Date range filter
      if (filters.dateFrom) {
        if (!bill.last_action_date || bill.last_action_date < filters.dateFrom) {
          return false;
        }
      }
      if (filters.dateTo) {
        if (!bill.last_action_date || bill.last_action_date > filters.dateTo) {
          return false;
        }
      }

      return true;
    });
  }, [bills, filters]);
}
