import { test as setup } from "@playwright/test";
import { signIn, BUYER } from "./helpers/auth";

setup("sign in as a buyer", async ({ page }) => {
  await signIn(page, BUYER, "buyer");
});
