/**
 * Regression test for a real bug: the engine-level tests in
 * booking-engine.test.ts call createSeatHold() directly and never caught
 * that the seat map UI was sending ShowtimeSeat.id values while the engine
 * expects Seat.id values — a mismatch only visible at the HTTP boundary.
 * This test drives the actual Route Handlers (real Zod validation, real
 * engine, only auth mocked) with exactly the payload shape the browser
 * sends, using the GET seats response's own `seatId` field as the input to
 * POST /api/holds — the same round trip the seat map component performs.
 */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestShowtime, createTestUser } from "../fixtures";

vi.mock("@/lib/auth/cookies", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/cookies";
import { GET as getSeats } from "@/app/api/showtimes/[showtimeId]/seats/route";
import { POST as createHold } from "@/app/api/holds/route";
import { POST as createBooking } from "@/app/api/bookings/route";

async function mockSignedInAs(user: { id: string; email: string; name: string }) {
  vi.mocked(getCurrentUser).mockResolvedValue({ sub: user.id, email: user.email, role: "CUSTOMER", name: user.name });
}

describe("seat map -> POST /api/holds contract", () => {
  it("holds successfully using the seatId values the GET seats endpoint returns", async () => {
    const { showtime } = await createTestShowtime({ seatCount: 4 });
    const user = await createTestUser();
    await mockSignedInAs(user);

    const seatsRes = await getSeats(new NextRequest(`http://localhost/api/showtimes/${showtime.id}/seats`), {
      params: Promise.resolve({ showtimeId: showtime.id }),
    });
    expect(seatsRes.status).toBe(200);
    const { seats } = await seatsRes.json();
    expect(seats.length).toBe(4);

    const chosen = seats.slice(0, 2).map((s: { seatId: string }) => s.seatId);
    const holdRes = await createHold(
      new NextRequest("http://localhost/api/holds", {
        method: "POST",
        body: JSON.stringify({ showtimeId: showtime.id, seatIds: chosen }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const holdData = await holdRes.json();

    expect(holdRes.status).toBe(201);
    expect(holdData.holdId).toBeTruthy();
    expect(holdData.expiresAt).toBeTruthy();
  });

  it("rejects a hold request built from ShowtimeSeat.id values with SEAT_UNAVAILABLE (the exact bug this test guards against)", async () => {
    const { showtime } = await createTestShowtime({ seatCount: 2 });
    const user = await createTestUser();
    await mockSignedInAs(user);

    const seatsRes = await getSeats(new NextRequest(`http://localhost/api/showtimes/${showtime.id}/seats`), {
      params: Promise.resolve({ showtimeId: showtime.id }),
    });
    const { seats } = await seatsRes.json();
    const wrongIds = seats.map((s: { showtimeSeatId: string }) => s.showtimeSeatId);

    const holdRes = await createHold(
      new NextRequest("http://localhost/api/holds", {
        method: "POST",
        body: JSON.stringify({ showtimeId: showtime.id, seatIds: wrongIds }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(holdRes.status).toBe(409);
    const data = await holdRes.json();
    expect(data.code).toBe("SEAT_UNAVAILABLE");
  });

  it("end-to-end: hold then create booking through the real route handlers", async () => {
    const { showtime } = await createTestShowtime({ seatCount: 2 });
    const user = await createTestUser();
    await mockSignedInAs(user);

    const seatsRes = await getSeats(new NextRequest(`http://localhost/api/showtimes/${showtime.id}/seats`), {
      params: Promise.resolve({ showtimeId: showtime.id }),
    });
    const { seats } = await seatsRes.json();

    const holdRes = await createHold(
      new NextRequest("http://localhost/api/holds", {
        method: "POST",
        body: JSON.stringify({ showtimeId: showtime.id, seatIds: seats.map((s: { seatId: string }) => s.seatId) }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { holdId } = await holdRes.json();

    const bookingRes = await createBooking(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        body: JSON.stringify({ holdId }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(bookingRes.status).toBe(201);
    const bookingData = await bookingRes.json();
    expect(bookingData.status).toBe("DRAFT");
    expect(bookingData.totalCents).toBeGreaterThan(0);
  });
});
