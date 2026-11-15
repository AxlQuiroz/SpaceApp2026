import { test, expect, type Page } from "@playwright/test";

async function checkWidth(page: Page) {
  const viewport = page.viewportSize()!.width;
  const layout = await page.evaluate(width => ({
    width: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll("body *")].map(el => ({
      tag: el.tagName, class: el.getAttribute("class"), right: Math.round(el.getBoundingClientRect().right),
    })).filter(el => el.right > width + 1).slice(0, 12),
  }), viewport);
  // En móvil, innerWidth puede ensancharse y ocultar el fallo mediante un zoom automático.
  expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(viewport + 1);
}
async function dismissNarration(page: Page) {
  const box = page.getByTestId("narration");
  // Mensajes, palabras nuevas, preguntas, medallas e informe: una tarjeta por clic (dos en las preguntas).
  for (let i = 0; i < 16 && await box.count(); i++) {
    const previous = await box.innerText();
    await box.getByRole("button").last().click();
    await expect.poll(async () => await box.count() ? box.innerText() : "").not.toBe(previous);
  }
  await expect(box).toHaveCount(0);
}
async function start(page: Page, destination: "Luna" | "Marte" = "Luna") {
  await page.goto("/mision");
  if (destination === "Marte") await page.getByText("Marte", { exact: true }).click();
  await page.getByRole("button", { name: "Jugar", exact: true }).click();
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn", "0");
  await checkWidth(page);
  await page.getByRole("button", { name: "Saltar tutorial", exact: true }).click();
  await expect(page.getByTestId("narration")).toBeVisible();
  await dismissNarration(page);
}
async function action(page: Page, name: string) {
  await dismissNarration(page);
  const mobile = page.getByRole("button", { name: "Acciones", exact: true });
  if (await mobile.isVisible()) {
    await mobile.click();
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${name}`) }).click();
  } else await page.getByRole("button", { name, exact: true }).click();
  // "¿Qué pasaría si…?": la orden sólo se envía al confirmar.
  const confirmation = page.getByTestId("preview").getByRole("button", { name: "¡Hazlo!", exact: true });
  await expect(confirmation).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/commands") && response.request().method() === "POST", { timeout: 15_000 }),
    confirmation.click(),
  ]);
  expect(response.ok()).toBe(true);
  const result = await response.json();
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-version", String(result.mission.state.version));
  await dismissNarration(page);
}
async function advance(page: Page, turn: number) {
  await page.getByRole("button", { name: "Avanzar 2 horas", exact: true }).click();
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn", String(turn));
  await expect(page.getByTestId("narration")).toBeVisible();
  await dismissNarration(page);
}
test("misión real completa, fuentes, recarga y menú", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  const id = await page.getByTestId("mission-hud").getAttribute("data-mission-id");
  await page.screenshot({ path: info.outputPath("base-selene.png"), fullPage: true });
  await checkWidth(page);
  await page.getByRole("button", { name: "☰ Menú", exact: true }).click();
  await page.getByRole("button", { name: "Fuentes NASA", exact: true }).click();
  const sources = page.getByRole("dialog", { name: "Fuentes y créditos", exact: true });
  await expect(sources.getByRole("link", { name: "Abrir fuente original NASA", exact: true })).toHaveCount(3);
  await sources.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "☰ Menú", exact: true }).click();
  await page.getByRole("button", { name: "Pausar misión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Avanzar 2 horas", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "☰ Menú", exact: true }).click();
  await page.getByRole("button", { name: "Reanudar misión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Avanzar 2 horas", exact: true })).toBeEnabled();
  await action(page, "Explorar");
  await action(page, "Explorar");
  for (let turn = 0; turn < 12; turn++) {
    const name = ({ 2: "Reparar agua", 5: "Ir al refugio", 6: "Salir del refugio", 8: "Reparar paneles" } as Record<number, string>)[turn];
    if (name) await action(page, name);
    await advance(page, turn + 1);
    if (turn === 2) {
      await page.reload();
      await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-mission-id", id!);
      await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn", "3");
    }
  }
  const end = page.getByRole("dialog", { name: "¡Misión exitosa!", exact: true });
  await expect(end).toBeVisible();
  await page.route("**/api/mission/missions/*/restart", async route => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "BACKEND_UNAVAILABLE", message: "Reinicio temporal de prueba" } }) });
  }, { times: 1 });
  await end.getByRole("button", { name: "Jugar otra vez", exact: true }).click();
  await expect(end.getByRole("alert")).toContainText("Reinicio temporal de prueba");
  await end.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByTestId("mission-hud")).not.toHaveAttribute("data-mission-id", id!);
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn", "0");
  await page.getByRole("button", { name: "☰ Menú", exact: true }).click();
  await page.getByRole("button", { name: "Salir al menú", exact: true }).click();
  await expect(page.getByRole("button", { name: /Continuar misión · Luna · Turno 12/ })).toBeVisible();
  expect(errors).toEqual([]);
});
test("503 al reanudar conserva la partida", async ({ page }) => {
  await start(page);
  const id = await page.getByTestId("mission-hud").getAttribute("data-mission-id");
  await page.route(`**/api/mission/missions/${id}`, async route => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "DATABASE_UNAVAILABLE", message: "Error temporal de prueba" } }) });
  }, { times: 1 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sin conexión con la base", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-mission-id", id!);
});
test("misión de Marte completa con datos reales, llamadas y tormenta de polvo", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page, "Marte");
  const id = await page.getByTestId("mission-hud").getAttribute("data-mission-id");
  await page.screenshot({ path: info.outputPath("base-marte.png"), fullPage: true });
  await checkWidth(page);
  const plan: Record<number, string[]> = {
    0: ["Explorar", "Llamar a la Tierra"], 2: ["Ir al refugio"],
    5: ["Invernadero", "MOXIE"], 7: ["Salir del refugio", "Explorar"],
    10: ["Limpiar paneles", "MOXIE"], 11: ["Invernadero"],
  };
  for (let turn = 0; turn < 12; turn++) {
    for (const name of plan[turn] ?? []) await action(page, name);
    await advance(page, turn + 1);
    if (turn === 6) {
      await page.reload();
      await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-mission-id", id!);
      await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn", "7");
    }
  }
  await expect(page.getByRole("dialog", { name: "¡Misión exitosa!", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("503 en una orden reintenta exactamente la misma intención", async ({ page }) => {
  await start(page);
  let failedBody: string | null = null;
  let failedKey: string | undefined;
  await page.route("**/api/mission/missions/*/commands", async route => {
    failedBody = route.request().postData(); failedKey = route.request().headers()["idempotency-key"];
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "BACKEND_UNAVAILABLE", message: "Error temporal de prueba" } }) });
  }, { times: 1 });
  await page.getByRole("button", { name: "Avanzar 2 horas", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Error temporal de prueba" })).toBeVisible();
  const requestPromise = page.waitForRequest(r => r.url().endsWith("/commands"));
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  const retried = await requestPromise;
  expect(retried.postData()).toBe(failedBody);
  expect(retried.headers()["idempotency-key"]).toBe(failedKey);
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn", "1");
});
