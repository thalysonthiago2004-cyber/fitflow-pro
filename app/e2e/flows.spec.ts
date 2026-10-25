import { type Browser, type Page, expect, test } from "@playwright/test";

// Full trainer/student journeys. They need a Supabase backend with e-mail
// confirmation disabled (a disposable test project, or a local stack), so they
// only run with E2E_SUPABASE=1. Each run uses fresh e-mail addresses.

test.describe.configure({ mode: "serial" });
// Text assertions filter to visible nodes: while React streams a Suspense
// boundary, the resolved content briefly exists twice (once in a hidden
// segment), which strict-mode locators would otherwise count.
// One project is enough: the journey is stateful and the mobile layout is
// exercised through dedicated mobile pages below.
test.skip(({ isMobile }) => isMobile);

const run = Date.now().toString(36);
const trainer = { name: "Ana Souza", email: `ana.${run}@example.com`, password: "treino2026" };
const student = { name: "Carla Dias", email: `carla.${run}@example.com`, password: "aluna2026" };
let inviteUrl = "";
let planUrl = "";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function newPage(browser: Browser, project: string) {
  const context = await browser.newContext(
    project === "mobile" ? { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } },
  );
  return context.newPage();
}

test("@supabase trainer signs up and lands on an empty dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Nome completo").fill(trainer.name);
  await page.getByLabel("E-mail").fill(trainer.email);
  await page.getByLabel("Senha", { exact: true }).fill(trainer.password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
  await expect(page.getByText("Nenhum aluno ainda").filter({ visible: true })).toBeVisible();
});

test("@supabase trainer invites a student", async ({ page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/students/invite");
  await page.getByLabel("Nome do aluno").fill(student.name);
  await page.getByLabel("E-mail do aluno").fill(student.email);
  await page.getByRole("button", { name: "Gerar link de convite" }).click();

  const link = page.getByLabel("Link de convite");
  await expect(link).toBeVisible();
  inviteUrl = await link.inputValue();
  expect(inviteUrl).toMatch(/\/invite\/[0-9a-f]{64}$/);

  await page.goto("/students?view=invites");
  await expect(page.locator("#main").getByText(student.email).filter({ visible: true })).toBeVisible();
});

test("@supabase student accepts the invitation and sees their trainer", async ({ browser }) => {
  const page = await newPage(browser, "mobile");
  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole("heading", { name: "Você recebeu um convite" })).toBeVisible();
  await expect(page.getByText("Ana Souza convidou você").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(student.email);

  await page.getByLabel("Crie uma senha").fill(student.password);
  await page.getByRole("button", { name: "Criar conta e aceitar convite" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Seu plano ainda não foi publicado").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Seu personal" }).getByText("Ana Souza", { exact: true }).filter({ visible: true })).toBeVisible();

  // Students do not get trainer areas.
  await page.goto("/students");
  await expect(page).toHaveURL(/\/dashboard$/);

  // The link only works once.
  await page.context().clearCookies();
  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole("heading", { name: "Convite inválido ou expirado" })).toBeVisible();
  await page.context().close();
});

test("@supabase trainer builds and publishes a workout plan", async ({ page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await page.getByRole("link", { name: "Novo plano de treino" }).click();

  await page.getByLabel("Nome do plano").fill("Hipertrofia — fase 1");
  await page.getByRole("button", { name: "Criar e montar treinos" }).click();
  await expect(page).toHaveURL(/\/workouts\/[0-9a-f-]{36}$/);
  planUrl = new URL(page.url()).pathname;

  // Publishing an empty plan is refused.
  await page.getByRole("button", { name: "Publicar para o aluno" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Adicione pelo menos um exercício antes de publicar o plano.").filter({ visible: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const session = page.getByRole("region", { name: "Treino A" });
  await session.getByRole("button", { name: "Editar Treino A" }).click();
  await session.getByRole("checkbox", { name: "Segunda-feira" }).check({ force: true });
  await session.getByRole("checkbox", { name: "Quarta-feira" }).check({ force: true });
  await session.getByRole("button", { name: "Salvar treino" }).click();
  await expect(session.getByText("Seg, Qua").filter({ visible: true })).toBeVisible();

  for (const [exercise, load] of [["Supino reto com barra", "40"], ["Agachamento livre", "60,5"]] as const) {
    await session.getByRole("button", { name: "Adicionar exercício" }).click();
    await session.getByLabel("Exercício", { exact: true }).selectOption({ label: exercise });
    await session.getByLabel("Séries").last().fill("2");
    await session.getByLabel("Reps mín.").last().fill("8");
    await session.getByLabel("Reps máx.").last().fill("12");
    await session.getByLabel("Carga (kg)").last().fill(load);
    await session.getByRole("button", { name: "Adicionar ao treino" }).click();
    await expect(session.locator("ol").getByText(exercise).filter({ visible: true })).toBeVisible();
    await session.getByRole("button", { name: "Fechar" }).click();
  }
  await expect(session.getByText("2 × 8–12 · 60,5 kg").filter({ visible: true })).toBeVisible();

  // Reorder: move the squat above the bench press.
  await session.getByRole("button", { name: "Mover Agachamento livre para cima" }).click();
  await expect(session.locator("ol > li").first()).toContainText("Agachamento livre");

  await page.getByRole("button", { name: "Publicar para o aluno" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Plano publicado.").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Ativo", { exact: true }).first().filter({ visible: true })).toBeVisible();
});

test("@supabase student records a workout and the trainer sees it", async ({ browser, page }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/training");
  await expect(studentPage.getByRole("heading", { name: "Hipertrofia — fase 1" })).toBeVisible();
  await studentPage.getByRole("link", { name: /Treino A/ }).click();
  await studentPage.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(studentPage).toHaveURL(/\/training\/log\/[0-9a-f-]{36}$/);

  await studentPage.getByLabel("Repetições — Agachamento livre, série 1").fill("10");
  await studentPage.getByRole("button", { name: "Concluir Agachamento livre, série 1" }).click();
  await expect(studentPage.getByRole("button", { name: "Desmarcar Agachamento livre, série 1" })).toBeVisible();
  await expect(studentPage.getByRole("status").filter({ hasText: "Descanso" })).toBeVisible();
  await studentPage.getByRole("button", { name: "Pular" }).click();

  await studentPage.getByLabel("Repetições — Supino reto com barra, série 1").fill("8");
  await studentPage.getByLabel("Carga em kg — Supino reto com barra, série 1").fill("42,5");
  await studentPage.getByRole("button", { name: "Concluir Supino reto com barra, série 1" }).click();
  await expect(studentPage.getByText("2 de 4 séries", { exact: true }).filter({ visible: true })).toBeVisible();
  // The toggle is disabled while its save is in flight.
  await expect(studentPage.getByRole("button", { name: "Desmarcar Supino reto com barra, série 1" })).toBeEnabled();

  // Progress survives a reload: sets are saved as they are completed.
  await studentPage.reload();
  await expect(studentPage.getByText("2 de 4 séries", { exact: true }).filter({ visible: true })).toBeVisible();

  await studentPage.getByLabel("Como foi o treino? (opcional)").fill("Boa sessão.");
  await studentPage.getByRole("button", { name: "Concluir treino" }).click();
  await expect(studentPage.getByText("Concluído em").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText("2 de 4", { exact: true }).filter({ visible: true })).toBeVisible();
  await studentPage.context().close();

  await login(page, trainer.email, trainer.password);
  await expect(page.getByRole("heading", { name: "Treinos concluídos" })).toBeVisible();
  await page.getByRole("link", { name: /Carla Dias/ }).first().click();
  await expect(page.getByRole("heading", { name: "Treino A — Carla Dias" })).toBeVisible();
  await expect(page.getByText("8 reps · 42,5 kg").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Boa sessão.").filter({ visible: true })).toBeVisible();
});

test("@supabase a plan with recorded workouts cannot be deleted", async ({ page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto(planUrl);
  await page.getByRole("button", { name: "Excluir plano" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText(/arquive o plano em vez de excluir/).filter({ visible: true })).toBeVisible();
});

test("@supabase trainer sets a hydration goal and the student logs water", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await page.getByLabel("Meta diária (litros)").fill("2,5");
  await page.getByRole("button", { name: "Salvar meta" }).click();
  await expect(page.getByText("Meta de hidratação salva.").filter({ visible: true })).toBeVisible();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await expect(studentPage.getByRole("heading", { name: "Progresso de hoje" })).toBeVisible();
  await studentPage.getByRole("button", { name: "Adicionar 500 ml" }).click();
  await expect(studentPage.getByRole("img", { name: "Água hoje: 500 ml de 2,5 L" })).toBeVisible();
  await studentPage.getByRole("button", { name: "Desfazer" }).click();
  await expect(studentPage.getByRole("img", { name: "Água hoje: 0 ml de 2,5 L" })).toBeVisible();

  await studentPage.goto("/hydration");
  await studentPage.getByLabel("Outra quantidade (ml)").fill("750");
  await studentPage.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(studentPage.getByText("de 2,5 L · 30%").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByRole("progressbar", { name: "Hidratação de hoje" })).toHaveAttribute("aria-valuenow", "750");
  await studentPage.context().close();

  await page.reload();
  await page.getByText("Ver em tabela").click();
  await expect(page.getByRole("cell", { name: "750 ml" })).toBeVisible();
});

test("@supabase trainer builds a meal plan and the student sees estimates", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);
  for (const food of [
    { name: "Ovo cozido", basis: "Sólido (por 100 g)", kcal: "146", protein: "13,3", carbs: "0,6", fat: "9,5", unitLabel: "unidade", unitAmount: "50" },
    { name: "Leite desnatado", basis: "Líquido (por 100 ml)", kcal: "35", protein: "3,4", carbs: "5", fat: "0,1", unitLabel: "", unitAmount: "" },
  ]) {
    await page.goto("/foods/new");
    await page.getByLabel("Nome", { exact: true }).fill(food.name);
    await page.getByLabel("Tipo").selectOption({ label: food.basis });
    await page.getByLabel("Calorias (kcal)").fill(food.kcal);
    await page.getByLabel("Proteínas (g)").fill(food.protein);
    await page.getByLabel("Carboidratos (g)").fill(food.carbs);
    await page.getByLabel("Gorduras (g)").fill(food.fat);
    await page.getByLabel("Nome da medida").fill(food.unitLabel);
    await page.getByLabel(/Quanto pesa/).fill(food.unitAmount);
    await page.getByLabel("Fonte dos valores").fill("Rótulo do produto");
    await page.getByRole("button", { name: "Cadastrar alimento" }).click();
    await expect(page).toHaveURL(/\/foods$/);
    await expect(page.getByText(food.name).filter({ visible: true })).toBeVisible();
  }

  await page.goto("/nutrition/new");
  await page.getByLabel("Aluno").selectOption({ label: student.name });
  await page.getByLabel("Nome do plano").fill("Plano de novembro");
  await page.getByRole("button", { name: "Criar e montar refeições" }).click();
  await expect(page).toHaveURL(/\/nutrition\/[0-9a-f-]{36}$/);

  const breakfast = page.getByRole("region", { name: "Café da manhã" });
  await breakfast.getByRole("button", { name: "Adicionar alimento" }).click();
  await breakfast.getByLabel("Alimento", { exact: true }).selectOption({ label: "Ovo cozido" });
  await breakfast.getByLabel("Quantidade").fill("2");
  await breakfast.getByLabel("Unidade").selectOption({ label: "unidade (50 g)" });
  await breakfast.getByRole("button", { name: "Adicionar à refeição" }).click();
  await expect(breakfast.getByText("2 × unidade (100 g) · ≈ 146 kcal").filter({ visible: true })).toBeVisible();
  await breakfast.getByLabel("Alimento", { exact: true }).selectOption({ label: "Leite desnatado" });
  await breakfast.getByLabel("Quantidade").fill("200");
  await breakfast.getByRole("button", { name: "Adicionar à refeição" }).click();
  await expect(breakfast.getByText("200 ml · ≈ 70 kcal").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("≈ 216 kcal").first().filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Publicar para o aluno" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Plano publicado.").filter({ visible: true })).toBeVisible();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/meals");
  await expect(studentPage.getByRole("heading", { name: "Plano de novembro" })).toBeVisible();
  await expect(studentPage.getByText("≈ 216 kcal").first().filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText("2 × unidade (100 g)").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText("Fontes: Rótulo do produto.").filter({ visible: true })).toBeVisible();
  // Empty default meals are hidden from the student.
  await expect(studentPage.getByRole("heading", { name: /Jantar/ })).toHaveCount(0);
  await studentPage.context().close();
});

test("@supabase measurements, personal records and honest estimates", async ({ browser, page }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/progress");
  await studentPage.getByLabel("Data da medição").fill("2026-10-01");
  await studentPage.getByLabel("Peso (kg)").fill("72,4");
  await studentPage.getByRole("button", { name: "Registrar medição" }).click();
  await expect(studentPage.getByText("Medição registrada.").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByLabel("Peso (kg)")).toHaveValue("");

  // Future dates are refused.
  await studentPage.getByLabel("Data da medição").fill("2099-01-01");
  await studentPage.getByLabel("Peso (kg)").fill("70");
  await studentPage.getByRole("button", { name: "Registrar medição" }).click();
  await expect(studentPage.getByText("A data não pode ser no futuro.").filter({ visible: true })).toBeVisible();

  // The trainer's own recent workout set is the record.
  await expect(studentPage.getByText(/Supino reto com barra/).filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText(/42,5 kg × 8/).filter({ visible: true })).toBeVisible();

  // The workout lasted seconds in this test, so no calorie estimate is shown.
  await studentPage.goto("/training/history");
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
  await expect(studentPage.getByText(/Gasto calórico estimado indisponível/).filter({ visible: true })).toBeVisible();
  await studentPage.context().close();

  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await page.getByRole("link", { name: "Evolução" }).click();
  await page.getByLabel("Peso (kg)").fill("71,8");
  await page.getByLabel("Cintura (cm)").fill("78");
  await page.getByRole("button", { name: "Registrar medição" }).click();
  await expect(page.getByText("Medição registrada.").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/−0,6 kg desde a anterior/).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Registrado por você").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(`Registrado por ${student.name}`).filter({ visible: true })).toBeVisible();
  // Only the recorder can delete: one delete button (the trainer's own entry).
  await expect(page.getByRole("button", { name: /Excluir medição/ })).toHaveCount(1);
});

// A real JPEG made by the browser, so the app's own resize path runs on it.
async function jpeg(page: Page, color: string): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const base64 = await page.evaluate((fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const context = canvas.getContext("2d")!;
    context.fillStyle = fill;
    context.fillRect(0, 0, 600, 800);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, color);
  return { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

test("@supabase the trainer's photo is shown to the student", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/settings");
  await page.getByLabel("Foto de perfil").setInputFiles(await jpeg(page, "#3a4a3c"));
  await expect(page.getByText("Foto atualizada.").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Sua foto de perfil" })).toBeVisible();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  const card = studentPage.getByRole("region", { name: "Seu personal" });
  await expect(card.getByText(trainer.name, { exact: true })).toBeVisible();
  await expect(card.locator("img")).toHaveAttribute("src", /\/storage\/v1\/object\/public\/avatars\//);
  await studentPage.context().close();
});

test("@supabase quick body assessment uses the student record and tape measures", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await page.getByLabel("Sexo").selectOption("female");
  await page.getByLabel("Data de nascimento").fill("1996-03-10");
  await page.getByLabel("Altura (cm)").fill("165");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect(page.getByText("Dados do aluno salvos.").filter({ visible: true })).toBeVisible();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/progress");
  const assessment = studentPage.locator("[data-slot=card]").filter({ has: studentPage.getByRole("heading", { name: "Avaliação corporal rápida" }) });
  await expect(assessment.getByText(/registre pescoço, cintura e quadril/)).toBeVisible();

  await studentPage.getByLabel("Peso (kg)").fill("60");
  await studentPage.getByLabel("Pescoço (cm)").fill("32");
  await studentPage.getByLabel("Cintura (cm)").fill("72");
  await studentPage.getByLabel("Quadril (cm)").fill("98");
  await studentPage.getByRole("button", { name: "Registrar medição" }).click();
  await expect(studentPage.getByText("Medição registrada.").filter({ visible: true })).toBeVisible();
  // Navy method, female, 165 cm: 27,4 %. Fat mass 60 × 27,4 % = 16,4 kg.
  await expect(assessment.getByText("27,4%")).toBeVisible();
  await expect(assessment.getByText("16,4 kg")).toBeVisible();

  await studentPage.getByRole("tab", { name: "Balança de bioimpedância" }).click();
  await studentPage.getByLabel("Massa muscular (kg)").fill("41,2");
  await studentPage.getByLabel("Gordura visceral (nível)").fill("4");
  await studentPage.getByRole("button", { name: "Registrar bioimpedância" }).click();
  await expect(studentPage.getByText("Medição registrada.").filter({ visible: true })).toBeVisible();
  await expect(assessment.getByText(/Massa muscular: 41,2 kg · Visceral: nível 4/)).toBeVisible();
  await studentPage.context().close();
});

test("@supabase before and after photos are private to the student and trainer", async ({ browser, page }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/progress");
  await studentPage.getByLabel("Data da foto").fill("2026-09-01");
  await studentPage.getByLabel("Foto de evolução").setInputFiles(await jpeg(studentPage, "#2b2f2c"));
  await expect(studentPage.getByText("Foto adicionada.").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText("Com uma segunda foto nesta posição, a comparação aparece aqui.")).toBeVisible();

  await studentPage.getByLabel("Data da foto").fill("2026-10-01");
  await studentPage.getByLabel("Foto de evolução").setInputFiles(await jpeg(studentPage, "#4c5a4e"));
  await expect(studentPage.getByText("Foto adicionada.").filter({ visible: true }).first()).toBeVisible();
  await expect(studentPage.getByText("30 dias entre as fotos.")).toBeVisible();
  await expect(studentPage.getByRole("img", { name: /^Antes: frente em 01\/09\/2026$/ })).toBeVisible();
  await expect(studentPage.getByRole("img", { name: /^Depois: frente em 01\/10\/2026$/ })).toBeVisible();
  await studentPage.context().close();

  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await page.getByRole("link", { name: "Evolução" }).click();
  await expect(page.getByRole("img", { name: /^Depois: frente em 01\/10\/2026$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar foto" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Excluir foto/ })).toHaveCount(0);
});
