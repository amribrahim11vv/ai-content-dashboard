export function canApplyAdminRoleChange(input: {
  currentAdmins: number;
  currentIsAdmin: boolean;
  nextIsAdmin: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.currentIsAdmin === input.nextIsAdmin) return { ok: true };
  if (!input.nextIsAdmin && input.currentIsAdmin && input.currentAdmins <= 1) {
    return { ok: false, error: "Cannot remove admin role from the last admin." };
  }
  return { ok: true };
}

