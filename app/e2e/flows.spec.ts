import AxeBuilder from "@axe-core/playwright";
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
  // Consent is required.
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Para continuar, aceite os termos de uso e a política de privacidade.").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill(trainer.password);
  await page.getByLabel(/Li e aceito os termos de uso/).check();
  if (process.env.E2E_BETA_CODE) {
    // Closed beta: a wrong code is refused by the database, then the right one works.
    await page.getByLabel("Código de acesso do beta").fill("CODIGO-ERRADO");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Código de acesso inválido.").filter({ visible: true })).toBeVisible();
    await page.getByLabel("Senha", { exact: true }).fill(trainer.password);
    await page.getByLabel(/Li e aceito os termos de uso/).check();
    await page.getByLabel("Código de acesso do beta").fill(process.env.E2E_BETA_CODE);
  }
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
  await page.getByLabel(/Li e aceito os termos de uso/).check();
  await page.getByLabel(/Autorizo o uso dos meus dados de saúde/).check();
  await page.getByRole("button", { name: "Criar conta e aceitar convite" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // New students are asked for the health questionnaire.
  await expect(page.getByRole("link", { name: /Responda a anamnese/ })).toBeVisible();
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
    await session.getByLabel("Séries", { exact: true }).last().selectOption("2");
    await session.getByLabel("Reps mín.").last().selectOption("8");
    await session.getByLabel("Reps máx.").last().selectOption("12");
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
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
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
  // The trainer finds it from the menu.
  await page.getByRole("link", { name: "Avaliação" }).first().click();
  await page.getByRole("link", { name: new RegExp(student.name) }).click();
  await expect(page.getByRole("heading", { name: "Avaliação corporal rápida" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Balança de bioimpedância" })).toBeVisible();

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

test("@supabase trainer prescribes cardio and the student records it", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto(planUrl);
  const session = page.getByRole("region", { name: "Treino A" });

  await session.getByRole("button", { name: "Adicionar cardio" }).click();
  await session.getByLabel("Atividade de cardio").selectOption({ label: "Esteira" });
  await session.getByLabel("Duração (min)").fill("20");
  await session.getByLabel("Intensidade").selectOption("moderate");
  await session.getByLabel("FC mín. (bpm)").fill("120");
  await session.getByLabel("FC máx. (bpm)").fill("140");
  await session.getByRole("button", { name: "Adicionar ao treino" }).click();
  await expect(session.getByText("20 min · moderada · FC 120–140 bpm").filter({ visible: true })).toBeVisible();

  // Intervals swap the duration for rounds of work and rest.
  await session.getByLabel("Atividade de cardio").selectOption({ label: "Air bike" });
  await session.getByText("Intervalado", { exact: true }).click();
  await session.getByLabel("Séries", { exact: true }).fill("6");
  await session.getByLabel("Estímulo (s)").fill("30");
  await session.getByLabel("Descanso (s)").fill("60");
  await session.getByLabel("Intensidade").selectOption("vigorous");
  await session.getByRole("button", { name: "Adicionar ao treino" }).click();
  await expect(session.getByText("6 × 30 s, descanso 1 min · intensa").filter({ visible: true })).toBeVisible();
  await session.getByRole("button", { name: "Fechar" }).click();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/training");
  // The plan's session link comes before the history entries.
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
  await expect(studentPage.getByText("20 min · moderada · FC 120–140 bpm").filter({ visible: true })).toBeVisible();
  await studentPage.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(studentPage).toHaveURL(/\/training\/log\/[0-9a-f-]{36}$/);

  await studentPage.getByLabel("Duração em minutos — Esteira").fill("22");
  await studentPage.getByLabel("Esforço percebido de 1 a 10 — Esteira").selectOption("6");
  await studentPage.getByRole("button", { name: "Concluir cardio — Esteira" }).click();
  await expect(studentPage.getByRole("button", { name: "Cardio concluído — Esteira" })).toBeEnabled();
  await expect(studentPage.getByText("1 de 6 etapas", { exact: true }).filter({ visible: true })).toBeVisible();

  await studentPage.reload();
  await expect(studentPage.getByText("1 de 6 etapas", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByLabel("Duração em minutos — Esteira")).toHaveValue("22");
  await studentPage.getByRole("button", { name: "Concluir treino" }).click();
  await expect(studentPage.getByText("Concluído em").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText("Realizado: 22 min · esforço 6/10").filter({ visible: true })).toBeVisible();
  await expect(studentPage.getByText("Cardio não registrado.").filter({ visible: true })).toBeVisible();
  await studentPage.context().close();

  // Cardio with history cannot be removed from the plan.
  await page.reload();
  await page.getByRole("region", { name: "Treino A" }).getByRole("button", { name: "Remover Esteira" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remover" }).click();
  await expect(page.getByText(/Já existem treinos registrados aqui/).filter({ visible: true })).toBeVisible();
});

// A short real WebM recorded from a canvas, so storage receives a playable file.
async function webm(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    for (let frame = 0; frame < 10; frame++) {
      context.fillStyle = `hsl(${frame * 36}, 60%, 40%)`;
      context.fillRect(0, 0, 160, 120);
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    recorder.stop();
    await stopped;
    const bytes = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  return { name: "demo.webm", mimeType: "video/webm", buffer: Buffer.from(base64, "base64") };
}

test("@supabase bi-set with per-set reps and the trainer's own video", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);

  // The trainer's version of a catalog exercise: own instructions and an uploaded video.
  await page.goto("/exercises");
  await page.getByRole("link", { name: /Tríceps francês com halter/ }).first().click();
  await page.getByLabel("Instruções de execução").fill("Cotovelos fixos apontando para o teto.");
  await page.getByRole("button", { name: "Salvar para meus alunos" }).click();
  await expect(page.getByText("Personalização salva. Seus alunos já veem esta versão.").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Vídeo de demonstração").setInputFiles(await webm(page));
  // Upload + attach crosses the network twice; allow for a slow first storage call.
  await expect(page.getByText("Vídeo enviado. Seus alunos já podem assistir.").filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("video")).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/exercise-videos\//);

  // Bi-set: French press with a 12/10/8 pyramid, then bench dips.
  await page.goto(planUrl);
  const session = page.getByRole("region", { name: "Treino A" });
  await session.getByRole("button", { name: "Adicionar exercício" }).click();
  await session.getByLabel("Exercício", { exact: true }).selectOption({ label: "Tríceps francês com halter" });
  await session.getByLabel("Séries", { exact: true }).last().selectOption("3");
  await session.getByText("Diferentes por série", { exact: true }).click();
  await session.getByLabel("Série 1", { exact: true }).selectOption("12");
  await session.getByLabel("Série 2", { exact: true }).selectOption("10");
  await session.getByLabel("Série 3", { exact: true }).selectOption("8");
  await session.getByRole("button", { name: "Adicionar ao treino" }).click();
  await expect(session.getByText("3 × 12/10/8").filter({ visible: true })).toBeVisible();

  await session.getByLabel("Exercício", { exact: true }).selectOption({ label: "Mergulho no banco" });
  await session.getByLabel("Séries", { exact: true }).last().selectOption("3");
  await session.getByLabel("Reps mín.").last().selectOption("15");
  await session.getByLabel("Descanso (s)").last().fill("45");
  await session.getByRole("button", { name: "Adicionar ao treino" }).click();
  await expect(session.locator("ol").getByText("Mergulho no banco").filter({ visible: true })).toBeVisible();
  await session.getByRole("button", { name: "Fechar" }).click();

  await session.getByRole("button", { name: "Juntar Mergulho no banco ao exercício anterior (bi-set)" }).click();
  await expect(session.getByText("Bi-set", { exact: true })).toBeVisible();
  await expect(session.getByText("Em sequência, sem pausa · descanso 45 s ao fim da volta")).toBeVisible();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/training");
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
  await expect(studentPage.getByText("Bi-set: Tríceps francês com halter + Mergulho no banco")).toBeVisible();
  // The exercise's own card (the innermost list item) inside the bi-set.
  const frenchCard = studentPage.getByRole("listitem").filter({ has: studentPage.getByRole("heading", { name: "Tríceps francês com halter" }) }).last();
  await frenchCard.getByText("Como executar").click();
  await expect(studentPage.getByText("Cotovelos fixos apontando para o teto.").first()).toBeVisible();
  await expect(studentPage.locator("video").first()).toHaveAttribute("src", /exercise-videos/);

  await studentPage.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(studentPage.getByText("Volta 1", { exact: true })).toBeVisible();
  await expect(studentPage.getByLabel("Repetições — Tríceps francês com halter, série 2")).toHaveAttribute("placeholder", "10");

  // Inside the round there is no rest; it starts after the last exercise.
  await studentPage.getByRole("button", { name: "Concluir Tríceps francês com halter, série 1" }).click();
  await expect(studentPage.getByRole("button", { name: "Desmarcar Tríceps francês com halter, série 1" })).toBeEnabled();
  await expect(studentPage.getByRole("status").filter({ hasText: "Descanso" })).toHaveCount(0);
  await studentPage.getByRole("button", { name: "Concluir Mergulho no banco, série 1" }).click();
  await expect(studentPage.getByRole("status").filter({ hasText: "Descanso" })).toBeVisible();
  await studentPage.getByRole("button", { name: "Descartar treino" }).click();
  await studentPage.getByRole("alertdialog").getByRole("button", { name: /Descartar/ }).click();
  await studentPage.context().close();
});

test("@supabase anamnesis flags medical clearance for the trainer", async ({ browser, page }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.getByRole("link", { name: /Responda a anamnese/ }).click();
  for (let i = 1; i <= 7; i++) {
    const group = studentPage.getByRole("group", { name: `Pergunta ${i}` });
    await group.getByText(i === 5 ? "Sim" : "Não", { exact: true }).click();
  }
  await studentPage.getByLabel("Lesões, dores ou cirurgias (opcional)").fill("Cirurgia no joelho direito em 2023");
  await studentPage.getByRole("button", { name: "Enviar para meu personal" }).click();
  await expect(studentPage.getByRole("heading", { name: "Respostas enviadas" })).toBeVisible();
  await expect(studentPage.getByText(/recomendada liberação médica/)).toBeVisible();
  await studentPage.goto("/dashboard");
  await expect(studentPage.getByRole("link", { name: /Responda a anamnese/ })).toHaveCount(0);
  await studentPage.context().close();

  await login(page, trainer.email, trainer.password);
  const attention = page.getByRole("region", { name: /Precisa de atenção/ });
  await expect(attention.getByText("Anamnese indica liberação médica antes de treinar")).toBeVisible();
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await expect(page.getByText("Cirurgia no joelho direito em 2023")).toBeVisible();
});

test("@supabase templates: save a plan as a template and reuse it", async ({ page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto(planUrl);
  await page.getByLabel("Destino").selectOption({ label: "Salvar como modelo" });
  await page.getByLabel("Nome da cópia").fill("Modelo hipertrofia");
  await page.getByRole("button", { name: "Duplicar plano" }).click();
  await expect(page.getByRole("heading", { name: "Modelo hipertrofia" })).toBeVisible();
  await expect(page.getByText("Modelo", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar para o aluno" })).toHaveCount(0);
  // Sessions, exercises and the bi-set came along.
  await expect(page.getByText("Bi-set", { exact: true }).filter({ visible: true })).toHaveCount(1);

  await page.goto("/workouts?status=templates");
  await page.getByRole("link", { name: /Modelo hipertrofia/ }).click();
  await page.getByLabel("Destino").selectOption({ label: `Para ${student.name}` });
  await page.getByLabel("Nome da cópia").fill("Hipertrofia — fase 2");
  await page.getByRole("button", { name: "Criar plano a partir do modelo" }).click();
  await expect(page.getByRole("heading", { name: "Hipertrofia — fase 2" })).toBeVisible();
  await expect(page.getByText("Este plano é um rascunho")).toBeVisible();
});

test("@supabase comments, last-time hints, body data and the report", async ({ browser, page }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/training/history");
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
  await studentPage.getByLabel("Escreva um comentário").fill("Senti o joelho no fim.");
  await studentPage.getByRole("button", { name: "Comentar" }).click();
  await expect(studentPage.getByText("Senti o joelho no fim.")).toBeVisible();

  // Starting again shows what was done last time.
  await studentPage.goto("/training");
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
  await studentPage.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(studentPage.getByText(/Última vez \(/).first()).toBeVisible();
  await studentPage.getByRole("button", { name: "Descartar treino" }).click();
  await studentPage.getByRole("alertdialog").getByRole("button", { name: /Descartar/ }).click();

  // The student keeps their own body data.
  await studentPage.goto("/settings");
  await studentPage.getByLabel("Altura (cm)").fill("166");
  await studentPage.getByRole("button", { name: "Salvar dados" }).click();
  await expect(studentPage.getByText("Dados atualizados.").filter({ visible: true })).toBeVisible();

  // LGPD export.
  const exported = await studentPage.request.get("/settings/export");
  expect(exported.headers()["content-disposition"]).toContain("attachment");
  const data = await exported.json();
  expect(data.account.email).toBe(student.email);
  expect(data.consents.map((c: { document: string }) => c.document).sort()).toEqual(["health_data", "privacy", "terms"]);
  expect(data.profile.height_cm).toBe(166);
  await studentPage.context().close();

  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await page.getByRole("link", { name: student.name }).first().click();
  await page.getByRole("link", { name: "Relatório PDF" }).click();
  await expect(page.getByRole("heading", { name: "Relatório de evolução" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar em PDF ou imprimir" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Antes e depois" })).toBeVisible();
});

test("@supabase TACO foods import into the library with their source", async ({ page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/foods/taco");
  await page.getByLabel("Buscar alimento").fill("arroz, integral, cozido");
  await page.getByLabel(/Arroz, integral, cozido/).check();
  await page.getByRole("button", { name: "Importar selecionados" }).click();
  await expect(page.getByText("1 alimento importado.").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Na biblioteca").first()).toBeVisible();
  await page.goto("/foods");
  await expect(page.getByText("Arroz, integral, cozido").first()).toBeVisible();
});

// WCAG 2.2 AA checks on the signed-in screens, in the dark default theme.
async function expectAccessible(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => `${path}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
}

test("@supabase signed-in screens pass automated accessibility checks", async ({ browser, page }) => {
  // Fifteen screens, each fully analysed.
  test.setTimeout(180_000);
  await login(page, trainer.email, trainer.password);
  for (const path of ["/dashboard", "/students", "/workouts", planUrl, "/exercises", "/assessments", "/foods/taco", "/settings"]) {
    await expectAccessible(page, path);
  }
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  for (const path of ["/dashboard", "/training", "/progress", "/hydration", "/meals", "/anamnese", "/settings"]) {
    await expectAccessible(studentPage, path);
  }
  await studentPage.context().close();
});

test("@supabase starter templates and the getting-started checklist", async ({ page }) => {
  await login(page, trainer.email, trainer.password);
  const checklist = page.getByRole("region", { name: "Primeiros passos" });
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText("Convide seu primeiro aluno")).toBeVisible();

  await page.goto("/workouts?status=templates");
  await page.getByRole("button", { name: "Adicionar modelos prontos" }).first().click();
  await expect(page.getByText("3 modelos adicionados. Ajuste ao seu estilo antes de usar.").filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  for (const name of ["Modelo inicial — Iniciante full body 3x", "Modelo inicial — Hipertrofia ABC", "Modelo inicial — Condicionamento e cardio"]) {
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  // The ABC template keeps its tricep bi-set; adding again does not duplicate.
  await page.getByRole("link", { name: /Modelo inicial — Hipertrofia ABC/ }).click();
  await expect(page.getByText("Bi-set", { exact: true }).filter({ visible: true })).toHaveCount(2);
  await page.goto("/workouts?status=templates");
  await expect(page.getByRole("button", { name: "Adicionar modelos prontos" })).toHaveCount(0);
});

test("@supabase students reach their trainer on WhatsApp", async ({ browser, page }) => {
  await login(page, trainer.email, trainer.password);
  await page.goto("/settings");
  await page.getByLabel("WhatsApp (opcional)").fill("123");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Use DDD e número, ex.: (11) 98765-4321.").filter({ visible: true })).toBeVisible();
  await page.getByLabel("WhatsApp (opcional)").fill("(11) 98765-4321");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Perfil atualizado.").filter({ visible: true })).toBeVisible();

  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  const link = studentPage.getByRole("region", { name: "Seu personal" }).getByRole("link", { name: /WhatsApp/ });
  await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/5511987654321\?text=/);
  await studentPage.context().close();
});

test("@supabase sets marked offline are kept on the phone and sent when back online", async ({ browser }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/training");
  await studentPage.getByRole("link", { name: /Treino A/ }).first().click();
  await studentPage.getByRole("button", { name: "Iniciar treino" }).click();
  await expect(studentPage).toHaveURL(/\/training\/log\/[0-9a-f-]{36}$/);

  await studentPage.context().setOffline(true);
  await studentPage.getByLabel("Repetições — Agachamento livre, série 1").fill("10");
  await studentPage.getByRole("button", { name: "Concluir Agachamento livre, série 1" }).click();
  await expect(studentPage.getByRole("button", { name: "Desmarcar Agachamento livre, série 1" })).toBeVisible();
  await expect(studentPage.getByText(/Sem conexão: 1 registro guardado no celular/)).toBeVisible();
  await expect(studentPage.getByRole("button", { name: "Concluir treino" })).toBeDisabled();

  await studentPage.context().setOffline(false);
  await expect(studentPage.getByText(/Sem conexão:/)).toHaveCount(0, { timeout: 15_000 });
  await studentPage.reload();
  await expect(studentPage.getByRole("button", { name: "Desmarcar Agachamento livre, série 1" })).toBeVisible();
  await studentPage.getByRole("button", { name: "Descartar treino" }).click();
  await studentPage.getByRole("alertdialog").getByRole("button", { name: /Descartar/ }).click();
  await studentPage.context().close();
});

test("@supabase a student deletes their account", async ({ browser, page }) => {
  const studentPage = await newPage(browser, "mobile");
  await login(studentPage, student.email, student.password);
  await studentPage.goto("/settings");
  await studentPage.getByRole("button", { name: "Excluir minha conta" }).click();
  await studentPage.getByLabel("Digite EXCLUIR para confirmar").fill("EXCLUIR");
  await studentPage.getByRole("alertdialog").getByRole("button", { name: "Excluir conta" }).click();
  await expect(studentPage).toHaveURL(/\/login\?conta=excluida$/);
  await expect(studentPage.getByText("Sua conta e seus dados foram excluídos.")).toBeVisible();
  await studentPage.getByLabel("E-mail").fill(student.email);
  await studentPage.getByLabel("Senha", { exact: true }).fill(student.password);
  await studentPage.getByRole("button", { name: "Entrar" }).click();
  await expect(studentPage).toHaveURL(/\/login/);
  await studentPage.context().close();

  await login(page, trainer.email, trainer.password);
  await page.goto("/students");
  await expect(page.getByRole("link", { name: student.name })).toHaveCount(0);
});
