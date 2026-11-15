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
