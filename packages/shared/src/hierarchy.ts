/**
 * Hierarchy & Reporting Line Validation Utilities
 */

/**
 * Checks if assigning proposedManagerId as manager of userId would create a circular reporting chain.
 *
 * Algorithm:
 * Traverses upwards from proposedManagerId following managerId pointers.
 * If userId is encountered anywhere in the ancestor chain, then setting
 * proposedManagerId as userId's manager would create a cycle (A -> B -> ... -> A).
 */
export async function wouldCreateReportingCycle(
  userId: string,
  proposedManagerId: string | null | undefined,
  getManagerOfUser: (id: string) => Promise<string | null | undefined> | string | null | undefined
): Promise<boolean> {
  // If removing manager, no cycle is possible
  if (!proposedManagerId) {
    return false;
  }

  // A user cannot report to themselves
  if (userId === proposedManagerId) {
    return true;
  }

  const visited = new Set<string>([userId]);
  let currentId: string | null | undefined = proposedManagerId;

  // Traverse ancestor chain
  while (currentId) {
    if (visited.has(currentId)) {
      return true; // Cycle detected!
    }
    visited.add(currentId);
    currentId = await getManagerOfUser(currentId);
  }

  return false;
}

/**
 * Synchronous version for in-memory graph traversal
 */
export function wouldCreateReportingCycleSync(
  userId: string,
  proposedManagerId: string | null | undefined,
  getManagerOfUser: (id: string) => string | null | undefined
): boolean {
  if (!proposedManagerId) {
    return false;
  }

  if (userId === proposedManagerId) {
    return true;
  }

  const visited = new Set<string>([userId]);
  let currentId: string | null | undefined = proposedManagerId;

  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);
    currentId = getManagerOfUser(currentId);
  }

  return false;
}

/**
 * Validates whether a target user is eligible to act as a manager for other team members.
 */
export function isManagerEligible(role: string, status: string, isArchived = false): boolean {
  if (isArchived || status !== 'ACTIVE') {
    return false;
  }
  return role === 'MANAGER' || role === 'ADMIN';
}
