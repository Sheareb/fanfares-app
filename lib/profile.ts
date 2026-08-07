type ProfileRow = {
  full_name?: string | null;
  is_organiser?: boolean | null;
  Is_organiser?: boolean | null;
};

export function getIsOrganiser(profile: ProfileRow | null | undefined) {
  return Boolean(profile?.is_organiser ?? profile?.Is_organiser);
}

export function getFullName(
  profile: ProfileRow | null | undefined,
  fallback = "Organiser",
) {
  const value = profile?.full_name;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

export function shouldRetryProfileInsertWithLegacyColumn(
  message: string | null | undefined,
) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("profiles") && normalized.includes("is_organiser");
}

export function getProfileOrganiserPayload(
  isOrganiser: boolean,
  useLegacyColumn: boolean,
) {
  return useLegacyColumn
    ? { Is_organiser: isOrganiser }
    : { is_organiser: isOrganiser };
}
