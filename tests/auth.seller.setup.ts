import { test as setup } from "@playwright/test";
import { signIn, SELLER } from "./helpers/auth";

setup("sign in as a seller", async ({ page }) => {
  await signIn(page, SELLER, "seller");
});
