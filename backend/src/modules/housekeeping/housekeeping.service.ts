import { prisma } from "../../config/database";
import { ApiError } from "../../utils/ApiError";
import { Prisma } from "@prisma/client";

export const housekeepingService = {
  /** Creates a task for a room, verifying the room actually belongs to the
   * requesting hotel — otherwise staff at one property could create tasks
   * against another property's rooms simply by guessing a room id. */
  async createTask(hotelId: string, data: any) {
    const room = await prisma.room.findFirst({ where: { id: data.roomId, hotelId } });
    if (!room) throw ApiError.notFound("Room not found for this hotel");
    return prisma.housekeepingTask.create({ data, include: { room: true } });
  },

  async listTasks(hotelId: string, filters: { status?: string; assigneeId?: string }) {
    return prisma.housekeepingTask.findMany({
      where: {
        room: { hotelId },
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      },
      include: { room: true, assignee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      // Safety cap: housekeeping tasks accumulate forever and this endpoint
      // has no pagination UI — without a limit, a property with years of
      // history would return an ever-growing unbounded payload. Filter by
      // status/assignee to narrow further; a paginated endpoint is the
      // follow-up if the active-task list itself ever exceeds this.
      take: 500,
    });
  },

  /** hotelId is required so a staff member scoped to one hotel can't update
   * or peek at another hotel's housekeeping task by guessing its id. */
  async updateTask(hotelId: string, id: string, data: any) {
    const task = await prisma.housekeepingTask.findFirst({ where: { id, room: { hotelId } } });
    if (!task) throw ApiError.notFound("Task not found");

    const updateData: any = { ...data };
    if (data.status === "IN_PROGRESS" && !task.startedAt) updateData.startedAt = new Date();
    if (data.status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    // Task status and the room status it drives must move together — if
    // the process died between the two writes, the room could be left
    // stuck (e.g. "CLEANING" forever after a task was actually verified).
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.housekeepingTask.update({ where: { id }, data: updateData, include: { room: true } });

      // Once verified, the room becomes AVAILABLE again. Note: `updated.room`
      // above was fetched *before* this update runs, so if we changed the
      // room's status we must reflect that in what we return — otherwise
      // callers (and the real-time event the controller emits from this
      // result) would carry the room's stale pre-update status.
      if (data.status === "VERIFIED") {
        const room = await tx.room.update({ where: { id: updated.roomId }, data: { status: "AVAILABLE" } });
        updated.room = room;
      } else if (data.status === "COMPLETED") {
        const room = await tx.room.update({ where: { id: updated.roomId }, data: { status: "CLEANING" } });
        updated.room = room;
      }

      return updated;
    });
  },

  async deleteTask(hotelId: string, id: string) {
    const task = await prisma.housekeepingTask.findFirst({ where: { id, room: { hotelId } } });
    if (!task) throw ApiError.notFound("Task not found");
    await prisma.housekeepingTask.delete({ where: { id } });
    return { id, hotelId };
  },
};
