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
    5: ["Apagar invernadero", "Apagar MOXIE"], 7: ["Salir del refugio", "Explorar"],
    10: ["Limpiar paneles", "Encender MOXIE"], 11: ["Encender invernadero"],
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


test("la previsión fallida bloquea confirmar, se recupera y mantiene el foco", async ({page}) => {
  await start(page);
  await page.route("**/api/mission/missions/*/preview", route => route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"BACKEND_UNAVAILABLE",message:"Fallo de previsión de prueba"}})}),{times:1});
  const mobile=page.getByRole("button",{name:"Acciones",exact:true});
  if(await mobile.isVisible()) { await mobile.click(); await page.getByRole("dialog").getByRole("button",{name:/^Explorar/}).click(); }
  else await page.getByRole("button",{name:"Explorar",exact:true}).click();
  const preview=page.getByTestId("preview");
  await expect(preview.getByRole("alert")).toBeVisible();
  await expect(preview.getByRole("button",{name:"¡Hazlo!",exact:true})).toBeDisabled();
  for(let i=0;i<6;i++){await page.keyboard.press("Tab");expect(await preview.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await preview.getByRole("button",{name:"Recalcular",exact:true}).click();
  await expect(preview.getByRole("table")).toBeVisible();
  await expect(preview.getByRole("button",{name:"¡Hazlo!",exact:true})).toBeEnabled();
  await checkWidth(page);
  await preview.getByRole("button",{name:"Mejor no",exact:true}).click();
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-version","1");
});

test("el inglés traduce la procedencia y el siguiente turno conserva el archivo", async ({page}) => {
  await start(page,"Marte");
  await page.getByRole("button",{name:"☰ Menú",exact:true}).click();
  await page.getByRole("button",{name:"EN",exact:true}).click();
  await page.getByRole("button",{name:"NASA sources",exact:true}).click();
  await expect(page.getByRole("heading",{name:"RadLab · Curiosity on Mars",exact:true})).toBeVisible();
  await expect(page.getByText("2024-05-20",{exact:false}).first()).toBeVisible();
  await checkWidth(page);
});

test("un reinicio compara las decisiones del intento anterior", async ({page}) => {
  await start(page);
  await action(page,"Explorar");
  const abort = async () => {
    await page.getByRole("button",{name:"☰ Menú",exact:true}).click();
    await page.getByRole("button",{name:"Abandonar misión",exact:true}).click();
    await expect(page.getByTestId("narration")).toBeVisible();
    await dismissNarration(page);
    await expect(page.getByRole("button",{name:"Jugar otra vez",exact:true})).toBeVisible();
  };
  await abort();
  const previousId = await page.getByTestId("mission-hud").getAttribute("data-mission-id");
  await page.getByRole("button",{name:"Jugar otra vez",exact:true}).click();
  await expect(page.getByTestId("mission-hud")).not.toHaveAttribute("data-mission-id",previousId!);
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn","0");
  await dismissNarration(page);
  await abort();
  await expect(page.getByRole("heading",{name:"Comparación con tu intento anterior",exact:true})).toBeVisible();
  await page.getByText("Decisiones distintas",{exact:true}).click();
  await expect(page.getByRole("dialog").getByText(/Turno 0: Explorar/)).toBeVisible();
  await checkWidth(page);
});

test("25 visitantes independientes pueden iniciar sesión detrás del proxy", async ({browser}) => {
  for(let i=0;i<25;i++){
    const context=await browser.newContext();
    try{
      const response=await context.request.post("http://localhost:3100/api/mission/sessions",{headers:{Origin:"http://localhost:3100"}});
      expect(response.status()).toBe(201);
      expect((await response.json()).access_token).toBeUndefined();
      expect(response.headers()["set-cookie"]).toContain("orbita_visitor");
    }finally{await context.close();}
  }
});

test("la consola explica bloqueos y refleja el estado real al encender o apagar", async ({page}, info) => {
  await start(page);
  const openConsole = async () => {
    const mobile=page.getByRole("button",{name:"Acciones",exact:true});
    if(await mobile.isVisible()) await mobile.click();
    return page.locator('[data-testid="action-console"]:visible');
  };
  const console = await openConsole();
  await expect(console.getByRole("heading",{name:"Ciencia y comunicación",exact:true})).toBeVisible();
  await expect(console.getByRole("heading",{name:"Sistemas de la base",exact:true})).toBeVisible();
  await expect(console.getByRole("heading",{name:"Cuidado de la tripulación",exact:true})).toBeVisible();
  await expect(console.getByText(/El circuito está bien: no hay fuga/)).toBeVisible();
  const repair=console.getByRole("button",{name:"Reparar agua",exact:true});
  await expect(repair).toBeDisabled();
  await expect(console.getByRole("button",{name:"Salir del refugio",exact:true})).toHaveCount(0);
  await page.screenshot({path:info.outputPath("consola-acciones.png"),fullPage:true});
  await checkWidth(page);
  if(await page.getByRole("dialog").count()) await page.getByRole("dialog").getByRole("button",{name:"Cerrar",exact:true}).click();
  await action(page,"Apagar generador O₂");
  const updated=await openConsole();
  await expect(updated.getByRole("button",{name:"Encender generador O₂",exact:true})).toBeVisible();
  await expect(updated.getByText("Detenido",{exact:false})).toBeVisible();
  await checkWidth(page);
});

test("el tutorial permite completar una decisión usando el teclado", async ({page}) => {
  await page.goto("/mision");
  await page.getByRole("button",{name:"Jugar",exact:true}).click();
  await page.getByRole("button",{name:"Siguiente",exact:true}).click();
  await expect(page.getByTestId("narration")).toBeVisible();
  await dismissNarration(page);
  const habitat=page.getByRole("button",{name:/^Hábitat:/});
  await habitat.focus(); await page.keyboard.press("Enter");
  await expect(page.getByText(/Elige la acción «Explorar»/).first()).toBeVisible();
  const mobile=page.getByRole("button",{name:"Acciones",exact:true});
  if(await mobile.isVisible()) {await mobile.focus();await page.keyboard.press("Enter");}
  const explore=page.getByRole("button",{name:"Explorar",exact:true});
  await explore.focus(); await page.keyboard.press("Enter");
  const confirm=page.getByTestId("preview").getByRole("button",{name:"¡Hazlo!",exact:true});
  await expect(confirm).toBeEnabled(); await confirm.focus(); await page.keyboard.press("Enter");
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-version","2");
  await dismissNarration(page);
  await page.getByRole("button",{name:"Avanzar 2 horas",exact:true}).focus(); await page.keyboard.press("Enter");
  await expect(page.getByTestId("mission-hud")).toHaveAttribute("data-turn","1");
  await expect(page.getByTestId("narration")).toBeVisible(); await dismissNarration(page);
  await page.getByRole("button",{name:"Siguiente",exact:true}).click();
  await page.getByRole("button",{name:"¡Terminé!",exact:true}).click();
  await expect(page.getByTestId("narration")).toBeVisible();
  await dismissNarration(page);
  await expect(page.getByRole("button",{name:"Avanzar 2 horas",exact:true})).toBeEnabled();
});

test("el menú y las zonas de familias y vestidor funcionan con teclado", async ({page}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"RockieOS",exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath("menu-principal.png"),fullPage:true});
  await checkWidth(page);
  await page.getByRole("button",{name:/^Vestidor/}).click();
  const wardrobe=page.getByRole("dialog",{name:"Vestidor",exact:true});
  const crew=wardrobe.getByRole("radio");
  await crew.first().focus(); await page.keyboard.press("ArrowRight");
  await expect(crew.nth(1)).toHaveAttribute("aria-checked","true");
  await expect(crew.nth(1)).toBeFocused();
  await wardrobe.getByRole("button",{name:"Cerrar",exact:true}).click();
  await page.getByRole("button",{name:/^Para familias/}).click();
  const family=page.getByRole("dialog",{name:"Para familias",exact:true});
  const numbers=(await family.locator('p[aria-live="polite"]').innerText()).match(/\d+/g)!;
  await family.getByRole("textbox",{name:"Respuesta",exact:true}).fill(String(Number(numbers[0])*Number(numbers[1])));
  await family.getByRole("button",{name:"Entrar",exact:true}).click();
  await family.getByRole("tab",{name:"Pase de Familia",exact:true}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(family.getByRole("tab",{name:"Diploma",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(family.getByRole("tabpanel")).toContainText("diploma");
  await checkWidth(page);
});
