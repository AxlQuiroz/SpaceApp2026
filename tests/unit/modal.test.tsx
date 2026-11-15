import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Modal } from "@/components/hud/Overlays";
import { Providers } from "@/lib/providers";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);
it("cerrar un modal mediante estado no ejecuta una salida al menú", () => {
  const onClose = vi.fn();
  const tree = (open: boolean) => <Providers><Modal open={open} title="Resultado" onClose={onClose}>Misión</Modal></Providers>;
  const view = render(tree(true));
  expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  view.rerender(tree(false));
  expect(onClose).not.toHaveBeenCalled();
});
it("Escape solicita el cierre al controlador y conserva un modal bloqueado", () => {
  const onClose = vi.fn();
  render(<Providers><Modal open title="Resultado" onClose={onClose}>Misión</Modal></Providers>);
  const dialog = screen.getByRole("dialog");
  expect(fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }))).toBe(false);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(dialog.hasAttribute("open")).toBe(true);
});

it("el espacio interior no cierra una ventana; el fondo exterior sí", () => {
  const onClose=vi.fn();
  render(<Providers><Modal open title="Fuentes" onClose={onClose}>Datos</Modal></Providers>);
  const dialog=screen.getByRole("dialog");
  vi.spyOn(dialog,"getBoundingClientRect").mockReturnValue({left:100,right:500,top:100,bottom:600} as DOMRect);
  fireEvent.click(dialog,{clientX:120,clientY:120});
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(dialog,{clientX:20,clientY:120});
  expect(onClose).toHaveBeenCalledOnce();
});

it("cerrar una de dos ventanas mantiene bloqueado el fondo de la otra", () => {
  document.body.style.overflow="auto";
  const tree=(first:boolean)=><Providers><Modal open={first} title="Uno" onClose={()=>{}}>A</Modal><Modal open title="Dos" onClose={()=>{}}>B</Modal></Providers>;
  const view=render(tree(true));expect(document.body.style.overflow).toBe("hidden");
  view.rerender(tree(false));expect(document.body.style.overflow).toBe("hidden");
  view.unmount();expect(document.body.style.overflow).toBe("auto");
  document.body.style.overflow="";
});
