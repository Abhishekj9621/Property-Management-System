import { api } from "./axios";

export const uploadsApi = {
  // folder is "hotels" or "room-types" — see backend uploads.routes.ts.
  // Content-Type is explicitly unset so axios/the browser can attach the
  // correct multipart boundary; the api instance's default JSON header
  // would otherwise override it and break the upload.
  uploadImages: (folder: "hotels" | "room-types", files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    return api
      .post(`/uploads/${folder}`, formData, { headers: { "Content-Type": undefined } })
      .then((r) => r.data.data.urls);
  },
};
