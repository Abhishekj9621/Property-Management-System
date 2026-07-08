import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { roomsService } from "./rooms.service";
import { requireHotelId } from "../../utils/requestHotel";

export const roomsController = {
  createRoomType: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const roomType = await roomsService.createRoomType(req.user, requireHotelId(req), req.body);
    res.status(201).json(new ApiResponse("Room type created", roomType));
  }),

  listRoomTypes: catchAsync(async (req: Request, res: Response) => {
    const roomTypes = await roomsService.listRoomTypes(requireHotelId(req), req.query.includeInactive === "true");
    res.status(200).json(new ApiResponse("Room types fetched", roomTypes));
  }),

  updateRoomType: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const roomType = await roomsService.updateRoomType(req.user, requireHotelId(req), req.params.id, req.body);
    res.status(200).json(new ApiResponse("Room type updated", roomType));
  }),

  deleteRoomType: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await roomsService.deleteRoomType(req.user, requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Room type deleted", result));
  }),

  createRoom: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotelId = requireHotelId(req);
    const room = await roomsService.createRoom(req.user, hotelId, req.body);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("room:created", room);
    res.status(201).json(new ApiResponse("Room created", room));
  }),

  bulkCreateRooms: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotelId = requireHotelId(req);
    const result = await roomsService.bulkCreateRooms(req.user, hotelId, req.body);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("room:bulk-created", result);
    res.status(201).json(new ApiResponse("Rooms created", result));
  }),

  updateRoom: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotelId = requireHotelId(req);
    const room = await roomsService.updateRoom(req.user, hotelId, req.params.id, req.body);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("room:updated", room);
    res.status(200).json(new ApiResponse("Room updated", room));
  }),

  deleteRoom: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotelId = requireHotelId(req);
    const result = await roomsService.deleteRoom(req.user, hotelId, req.params.id);
    req.app.get("io")?.to(`hotel:${hotelId}`).emit("room:deleted", result);
    res.status(200).json(new ApiResponse("Room deleted", result));
  }),

  listRooms: catchAsync(async (req: Request, res: Response) => {
    const { status, roomTypeId, floor } = req.query;
    const rooms = await roomsService.listRooms(requireHotelId(req), {
      status: status as any,
      roomTypeId: roomTypeId as string,
      floor: floor ? Number(floor) : undefined,
    });
    res.status(200).json(new ApiResponse("Rooms fetched", rooms));
  }),

  listFloors: catchAsync(async (req: Request, res: Response) => {
    const floors = await roomsService.listFloors(requireHotelId(req));
    res.status(200).json(new ApiResponse("Floors fetched", floors));
  }),

  getRoom: catchAsync(async (req: Request, res: Response) => {
    const room = await roomsService.getRoom(requireHotelId(req), req.params.id);
    res.status(200).json(new ApiResponse("Room fetched", room));
  }),

  updateRoomStatus: catchAsync(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const hotelId = requireHotelId(req);
    const room = await roomsService.updateRoomStatus(req.user, hotelId, req.params.id, req.body.status);
    const io = req.app.get("io");
    io?.to(`hotel:${room.hotelId}`).emit("room:status-changed", room);
    res.status(200).json(new ApiResponse("Room status updated", room));
  }),

  searchAvailability: catchAsync(async (req: Request, res: Response) => {
    const { checkInDate, checkOutDate, adults } = req.query;
    const results = await roomsService.searchAvailability(
      requireHotelId(req),
      new Date(checkInDate as string),
      new Date(checkOutDate as string),
      adults ? Number(adults) : 1
    );
    res.status(200).json(new ApiResponse("Availability fetched", results));
  }),
};
