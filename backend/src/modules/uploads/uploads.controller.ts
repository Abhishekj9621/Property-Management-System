import { Request, Response } from "express";
import multer from "multer";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { r2 } from "../../utils/r2";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }, // 8MB per file, up to 10 files
}).array("images", 10);

function runMulter(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (!err) return resolve();
      if (err instanceof multer.MulterError) {
        return reject(
          ApiError.badRequest(err.code === "LIMIT_FILE_SIZE" ? "One or more images are too large (max 8MB each)." : err.message)
        );
      }
      reject(ApiError.badRequest(err.message));
    });
  });
}

export const uploadsController = {
  // POST /uploads/:folder(hotels|room-types) — multipart/form-data, field "images"
  uploadImages: catchAsync(async (req: Request, res: Response) => {
    const folder = req.params.folder;
    if (folder !== "hotels" && folder !== "room-types") {
      throw ApiError.badRequest('folder must be "hotels" or "room-types"');
    }

    await runMulter(req, res);

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      throw ApiError.badRequest("No image files were provided.");
    }

    const urls = await Promise.all(files.map((file) => r2.uploadImageToR2(file, folder)));
    res.status(201).json(new ApiResponse("Images uploaded", { urls }));
  }),
};
