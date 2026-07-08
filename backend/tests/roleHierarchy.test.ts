import { canManageRole, isHotelScoped, ROLE_HIERARCHY } from "../src/lib/roleHierarchy";

describe("roleHierarchy", () => {
  it("SUPER_ADMIN can manage every subordinate role", () => {
    expect(canManageRole("SUPER_ADMIN", "HOTEL_ADMIN")).toBe(true);
    expect(canManageRole("SUPER_ADMIN", "MANAGER")).toBe(true);
    expect(canManageRole("SUPER_ADMIN", "RECEPTIONIST")).toBe(true);
    expect(canManageRole("SUPER_ADMIN", "HOUSEKEEPING")).toBe(true);
  });

  it("SUPER_ADMIN cannot 'manage' another SUPER_ADMIN via the hierarchy table", () => {
    // Creating another SUPER_ADMIN is handled by an explicit special-case
    // in the service layer, not the hierarchy table.
    expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("HOTEL_ADMIN can manage MANAGER/RECEPTIONIST/HOUSEKEEPING but not HOTEL_ADMIN or SUPER_ADMIN", () => {
    expect(canManageRole("HOTEL_ADMIN", "MANAGER")).toBe(true);
    expect(canManageRole("HOTEL_ADMIN", "RECEPTIONIST")).toBe(true);
    expect(canManageRole("HOTEL_ADMIN", "HOUSEKEEPING")).toBe(true);
    expect(canManageRole("HOTEL_ADMIN", "HOTEL_ADMIN")).toBe(false);
    expect(canManageRole("HOTEL_ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("MANAGER can only manage RECEPTIONIST and HOUSEKEEPING", () => {
    expect(canManageRole("MANAGER", "RECEPTIONIST")).toBe(true);
    expect(canManageRole("MANAGER", "HOUSEKEEPING")).toBe(true);
    expect(canManageRole("MANAGER", "MANAGER")).toBe(false);
    expect(canManageRole("MANAGER", "HOTEL_ADMIN")).toBe(false);
  });

  it("RECEPTIONIST, HOUSEKEEPING, and GUEST cannot manage anyone", () => {
    expect(ROLE_HIERARCHY.RECEPTIONIST).toHaveLength(0);
    expect(ROLE_HIERARCHY.HOUSEKEEPING).toHaveLength(0);
    expect(ROLE_HIERARCHY.GUEST).toHaveLength(0);
  });

  it("isHotelScoped is true for every role except SUPER_ADMIN and GUEST", () => {
    expect(isHotelScoped("HOTEL_ADMIN")).toBe(true);
    expect(isHotelScoped("MANAGER")).toBe(true);
    expect(isHotelScoped("RECEPTIONIST")).toBe(true);
    expect(isHotelScoped("HOUSEKEEPING")).toBe(true);
    expect(isHotelScoped("SUPER_ADMIN")).toBe(false);
    expect(isHotelScoped("GUEST")).toBe(false);
  });
});
