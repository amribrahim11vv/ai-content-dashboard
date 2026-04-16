import { describe, expect, it } from "vitest";
import { canApplyAdminRoleChange } from "./adminRolePolicy.js";

describe("admin role policy", () => {
  it("allows no-op role updates", () => {
    expect(
      canApplyAdminRoleChange({
        currentAdmins: 1,
        currentIsAdmin: false,
        nextIsAdmin: false,
      })
    ).toEqual({ ok: true });
  });

  it("blocks removing admin from the last admin", () => {
    expect(
      canApplyAdminRoleChange({
        currentAdmins: 1,
        currentIsAdmin: true,
        nextIsAdmin: false,
      })
    ).toEqual({ ok: false, error: "Cannot remove admin role from the last admin." });
  });

  it("allows demoting when multiple admins exist", () => {
    expect(
      canApplyAdminRoleChange({
        currentAdmins: 2,
        currentIsAdmin: true,
        nextIsAdmin: false,
      })
    ).toEqual({ ok: true });
  });
});

