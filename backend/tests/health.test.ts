import request from "supertest";
import { createApp } from "../src/app";

describe("GET /api/v1/health", () => {
  it("returns 200 and a healthy status payload", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
