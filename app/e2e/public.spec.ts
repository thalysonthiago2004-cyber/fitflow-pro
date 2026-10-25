import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

for (const path of ["/", "/login", "/signup", "/forgot-password", "/auth/error"]) {
  test(`${path} renders without horizontal overflow`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("home links to sign-up and login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Começar agora" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Criar conta de personal" })).toBeVisible();
});

test.describe("guest redirects", () => {
  for (const path of ["/dashboard", "/settings", "/reset-password", "/students", "/students/invite", "/workouts", "/workouts/new", "/exercises", "/training", "/training/history", "/hydration", "/nutrition", "/foods", "/meals", "/progress"]) {
    test(`${path} redirects to login and keeps the destination`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    });
  }

  test("invalid e-mail links land on the error page", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=abc&type=not-a-type&next=//evil.example");
    await expect(page).toHaveURL("/auth/error");
    await expect(page.getByRole("heading", { name: "Link inválido ou expirado" })).toBeVisible();
  });
});

test.describe("form validation", () => {
  test("login reports missing fields next to each input", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar" }).click();

    const email = page.getByLabel("E-mail");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#field-email-error")).toHaveText("Informe seu e-mail.");
    await expect(page.locator("#field-password-error")).toHaveText("Informe sua senha.");
  });

  test("login password can be shown while typing", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Senha", { exact: true });
    await password.fill("Treino2026");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("Treino2026");

    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("sign-up keeps typed values and explains password rules", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Nome completo").fill("Ana Souza");
    await page.getByLabel("E-mail").fill("ana@");
    await page.getByLabel("Senha", { exact: true }).fill("curta");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.locator("#field-email-error")).toHaveText("Informe um e-mail válido.");
    await expect(page.locator("#field-password-error")).toHaveText(
      "A senha precisa ter pelo menos 8 caracteres.",
    );
    await expect(page.getByLabel("Nome completo")).toHaveValue("Ana Souza");
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
      "aria-describedby",
      "field-password-hint field-password-error",
    );
  });
});

test("theme toggle persists across reloads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Alternar tema claro/escuro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("defaults to the dark brand theme, even when the OS prefers light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test.describe("student invitation page", () => {
  for (const token of ["not-a-token", "a".repeat(64)]) {
    test(`unknown token ${token.slice(0, 8)}… shows an invalid-invite message`, async ({ page }) => {
      await page.goto(`/invite/${token}`);
      await expect(page.getByRole("heading", { name: "Convite inválido ou expirado" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ir para o login" })).toBeVisible();
    });
  }
});
