// lib/db.ts asks pg for verify-full by name: same behavior as Neon's
// sslmode=require today, without the cold-start warning Vercel logs as an error.

jest.mock("@/app/generated/prisma/client", () => ({ PrismaClient: jest.fn() }));
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: jest.fn() }));

process.env.DATABASE_URL = "postgresql://u:p@ep-x-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

import { PrismaPg } from "@prisma/adapter-pg";
import { withExplicitSslMode } from "@/lib/db";

it("turns sslmode=require into verify-full and leaves everything else alone", () => {
  expect(withExplicitSslMode("postgresql://u:p@h/db?sslmode=require&channel_binding=require")).toBe(
    "postgresql://u:p@h/db?sslmode=verify-full&channel_binding=require"
  );
  expect(withExplicitSslMode("postgresql://u:p@h/db?channel_binding=require&sslmode=require")).toBe(
    "postgresql://u:p@h/db?channel_binding=require&sslmode=verify-full"
  );
  expect(withExplicitSslMode("postgresql://u:p@localhost/db")).toBe("postgresql://u:p@localhost/db");
  expect(withExplicitSslMode("postgresql://u:p@h/db?sslmode=disable")).toBe("postgresql://u:p@h/db?sslmode=disable");
});

it("hands the adapter the explicit mode", () => {
  expect((PrismaPg as unknown as jest.Mock).mock.calls[0][0]).toEqual({
    connectionString: "postgresql://u:p@ep-x-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full",
  });
});
