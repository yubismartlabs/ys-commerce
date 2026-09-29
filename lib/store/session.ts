import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "buyer" | "seller";

type SessionState = {
  name: string;
  roles: Role[];
  isSeller: boolean;
  becomeSeller: (storeName: string) => void;
  storeName: string | null;
};

// TODO(API): replace mock session with real auth (JWT/session) from custom backend
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      name: "Guest Buyer",
      roles: ["buyer"],
      isSeller: false,
      storeName: null,
      becomeSeller: (storeName: string) =>
        set({ roles: ["buyer", "seller"], isSeller: true, storeName }),
    }),
    { name: "ys-session" }
  )
);
